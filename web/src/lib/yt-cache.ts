import "server-only";
import { SEARCH_DAILY_LIMIT } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { QuotaExceededError, getChannels, getPlaylistPage, getVideos, splitPlaylistIds, type VideoDetail } from "@/lib/youtube";

const HOUR = 3600_000;
const STALE_MS = 6 * HOUR; // 승인 채널 영상 갱신 주기
const MAX_AGE_MS = 30 * 24 * HOUR; // 정책상 최대 보관 기간(이 안에 다시 확인하거나 지운다)
const RECHECK_MS = 7 * 24 * HOUR; // 저장 영상·채널 정보를 다시 확인하는 주기

const ago = (iso: string | null | undefined) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);

// isShort: 채널 재생목록으로 판정한 값(true/false), 기존 값 유지(null이 아닌 boolean 전달), 없으면 길이·비율 추정값.
function videoRow(v: VideoDetail, isShort?: boolean) {
  return {
    video_id: v.videoId,
    channel_id: v.channelId,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    published_at: v.publishedAt,
    duration_seconds: v.durationSeconds,
    made_for_kids: v.madeForKids,
    embeddable: v.embeddable,
    playable: v.playable,
    is_vertical: v.isVertical,
    is_short: isShort ?? v.isShortGuess,
    fetched_at: new Date().toISOString(),
  };
}

export async function ensureChannels(channelIds: string[]) {
  const admin = createAdminClient();
  const ids = [...new Set(channelIds)];
  if (ids.length === 0) return;
  const { data: cached } = await admin.from("yt_channel_cache").select("channel_id, fetched_at").in("channel_id", ids);
  const fresh = new Set((cached ?? []).filter((c) => ago(c.fetched_at) < RECHECK_MS).map((c) => c.channel_id));
  const missing = ids.filter((id) => !fresh.has(id));
  if (missing.length === 0) return;
  const infos = await getChannels(missing);
  if (infos.length === 0) return;
  await admin.from("yt_channel_cache").upsert(
    infos.map((c) => ({
      channel_id: c.channelId,
      title: c.title,
      thumbnail_url: c.thumbnailUrl,
      uploads_playlist_id: c.uploadsPlaylistId,
      fetched_at: new Date().toISOString(),
    })),
  );
}

export async function ensureVideos(videoIds: string[]): Promise<VideoDetail[]> {
  const admin = createAdminClient();
  const ids = [...new Set(videoIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const { data: cached } = await admin.from("yt_video_cache").select("video_id, fetched_at").in("video_id", ids);
  const fresh = new Set((cached ?? []).filter((c) => ago(c.fetched_at) < MAX_AGE_MS).map((c) => c.video_id));
  const missing = ids.filter((id) => !fresh.has(id));
  if (missing.length === 0) return [];
  const details = await getVideos(missing);
  if (details.length) await admin.from("yt_video_cache").upsert(details.map((d) => videoRow(d)));
  return details;
}

type Kind = "video" | "short";
type ListSource = { playlistId: string; kind: Kind | "all" };
const MAX_NEW_PAGES = 4; // 새 영상 빈틈 메우기: 저장된 영상을 만날 때까지 최대 200개까지 이어 받는다
const MAX_OLDER_SKIP_PAGES = 6; // 이전 영상: 이미 가진 쪽을 건너뛰며 찾는 최대 쪽 수

// 채널의 목록 출처: 쇼츠/일반 재생목록(비공식 관행)을 우선 쓰고, 안 되면 전체 업로드 목록 하나로 대신한다.
async function listSources(channelId: string, uploadsPlaylistId: string): Promise<ListSource[]> {
  const split = splitPlaylistIds(channelId);
  if (split) {
    try {
      await getPlaylistPage(split.videos); // 접근 가능한지 확인(실패하면 대체)
      return [
        { playlistId: split.videos, kind: "video" },
        { playlistId: split.shorts, kind: "short" },
      ];
    } catch (e) {
      if (e instanceof QuotaExceededError) throw e;
      console.warn("shorts split playlists unavailable", channelId, e);
    }
  }
  return [{ playlistId: uploadsPlaylistId, kind: "all" }];
}

async function knownIds(ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const { data } = await createAdminClient().from("yt_video_cache").select("video_id").in("video_id", ids);
  return new Set((data ?? []).map((d) => d.video_id as string));
}

async function addVideos(ids: string[], kind: Kind | "all") {
  if (ids.length === 0) return 0;
  const details = await getVideos(ids);
  if (details.length) {
    await createAdminClient()
      .from("yt_video_cache")
      .upsert(details.map((d) => videoRow(d, kind === "all" ? undefined : kind === "short")));
  }
  return details.length;
}

const tokenCols = (kind: Kind | "all") =>
  kind === "short" ? { token: "older_shorts_token", done: "older_shorts_done" } : { token: "older_videos_token", done: "older_videos_done" };

async function saveOlderToken(channelId: string, kind: Kind | "all", next: string | null) {
  const c = tokenCols(kind);
  // 마이그레이션(20261010000003) 전이면 칸이 없어 실패하므로 결과를 무시한다.
  await createAdminClient()
    .from("yt_channel_cache")
    .update({ [c.token]: next, [c.done]: next == null })
    .eq("channel_id", channelId);
}

// 누적 방식 갱신: 처음 승인 때는 목록마다 최신 50개를 받고 다음 쪽 위치를 기억한다(이전 영상 더 보기용).
// 이후에는 최신 쪽부터 받아 **처음 보는 영상만** 추가하고, 한 쪽이 전부 새 영상이면 저장된 영상을 만날 때까지 다음 쪽을 이어 받는다.
// 기존 영상은 지우지 않는다(삭제·비공개 확인은 recheckVideos).
export async function refreshChannelVideos(channelId: string, opts: { force?: boolean } = {}) {
  const admin = createAdminClient();
  await ensureChannels([channelId]);
  const { data: ch } = await admin
    .from("yt_channel_cache")
    .select("uploads_playlist_id, videos_fetched_at")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!ch?.uploads_playlist_id) return;
  if (!opts.force && ago(ch.videos_fetched_at) < STALE_MS) return;

  for (const src of await listSources(channelId, ch.uploads_playlist_id)) {
    let q = admin.from("yt_video_cache").select("video_id", { count: "exact", head: true }).eq("channel_id", channelId);
    if (src.kind !== "all") q = q.eq("is_short", src.kind === "short");
    const { count } = await q;
    const first = (count ?? 0) === 0;

    let token: string | null = null;
    for (let page = 0; page < (first ? 1 : MAX_NEW_PAGES); page++) {
      const { ids, next } = await getPlaylistPage(src.playlistId, token);
      const known = await knownIds(ids);
      const fresh = ids.filter((id) => !known.has(id));
      await addVideos(fresh, src.kind);
      if (first) await saveOlderToken(channelId, src.kind, next);
      if (first || fresh.length < ids.length || !next) break; // 저장된 영상을 만났거나 끝
      token = next;
    }
  }

  await admin.from("yt_channel_cache").update({ videos_fetched_at: new Date().toISOString() }).eq("channel_id", channelId);
}

// 이전 영상 더 보기: 기억해 둔 다음 쪽부터 받아 처음 보는 영상 최대 50개를 추가한다.
// 그사이 새 영상이 올라와 쪽이 밀리면 이미 가진 영상이 다시 나오므로 건너뛴다. 토큰이 없으면 처음부터 건너뛰며 찾는다.
export async function loadOlderVideos(channelId: string, kind: Kind): Promise<{ added: number; done: boolean }> {
  const admin = createAdminClient();
  const { data: ch, error } = await admin
    .from("yt_channel_cache")
    .select("uploads_playlist_id, older_videos_token, older_shorts_token, older_videos_done, older_shorts_done")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) throw new Error("older tokens unavailable (migration 20261010000003?)");
  if (!ch?.uploads_playlist_id) return { added: 0, done: true };

  const sources = await listSources(channelId, ch.uploads_playlist_id);
  const src = sources.find((x) => x.kind === kind) ?? sources[0];
  const cols = tokenCols(src.kind);
  const row = ch as Record<string, unknown>;
  if (row[cols.done]) return { added: 0, done: true };

  let token = (row[cols.token] as string | null) ?? null;
  let added = 0;
  for (let page = 0; page < MAX_OLDER_SKIP_PAGES; page++) {
    const { ids, next } = await getPlaylistPage(src.playlistId, token);
    const known = await knownIds(ids);
    const fresh = ids.filter((id) => !known.has(id));
    added = await addVideos(fresh, src.kind);
    token = next;
    if (added > 0 || !next) break;
  }
  await saveOlderToken(channelId, src.kind, token);
  return { added, done: token == null };
}

// 저장한 영상 중 마지막 확인 후 7일 지난 것을 오래된 순으로 다시 확인한다(50개씩 묶어 호출, 50개당 1단위).
// 삭제·비공개로 응답에 없으면 지운다. 단 요청의 계기 영상(부모 확인용)과 좋아요한 영상(아이 목록용)은 남기고 재생 불가로 표시한다.
export async function recheckVideos(maxVideos = 500) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RECHECK_MS).toISOString();
  const { data: rows } = await admin
    .from("yt_video_cache")
    .select("video_id, is_short")
    .lt("fetched_at", cutoff)
    .order("fetched_at", { ascending: true })
    .limit(maxVideos);
  if (!rows?.length) return 0;
  const shortMap = new Map(rows.map((r) => [r.video_id as string, r.is_short as boolean | null]));
  const ids = [...shortMap.keys()];
  const details = await getVideos(ids);
  if (details.length) {
    await admin.from("yt_video_cache").upsert(details.map((d) => videoRow(d, shortMap.get(d.videoId) ?? undefined)));
  }
  const returned = new Set(details.map((d) => d.videoId));
  const gone = ids.filter((id) => !returned.has(id));
  if (gone.length) {
    const [{ data: reqs }, { data: likes }] = await Promise.all([
      admin.from("channel_requests").select("trigger_video_ids").overlaps("trigger_video_ids", gone),
      admin.from("video_likes").select("video_id").in("video_id", gone),
    ]);
    const referenced = new Set([
      ...(reqs ?? []).flatMap((r) => r.trigger_video_ids as string[]),
      ...(likes ?? []).map((l) => l.video_id as string),
    ]);
    const del = gone.filter((id) => !referenced.has(id));
    const keep = gone.filter((id) => referenced.has(id));
    if (del.length) await admin.from("yt_video_cache").delete().in("video_id", del);
    if (keep.length) {
      await admin.from("yt_video_cache").update({ playable: false, fetched_at: new Date().toISOString() }).in("video_id", keep);
    }
  }
  return ids.length;
}

// 모든 프로필의 승인 채널을 갱신한다(정기 실행용).
export async function refreshAllApprovedChannels() {
  const admin = createAdminClient();
  const { data: states } = await admin.from("channel_states").select("channel_id").eq("status", "approved");
  const channelIds = [...new Set((states ?? []).map((s) => s.channel_id as string))];
  for (const id of channelIds) {
    try {
      await refreshChannelVideos(id);
    } catch (e) {
      console.error("refresh channel failed", id, e);
    }
  }
  return channelIds.length;
}

// 한 프로필의 승인 채널 중 오래된 것만 갱신한다. minGapMs로 수동 새로고침 남용을 막는다.
export async function refreshProfileChannels(profileId: string, opts: { force?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: states } = await admin
    .from("channel_states")
    .select("channel_id")
    .eq("profile_id", profileId)
    .eq("status", "approved");
  const channelIds = (states ?? []).map((s) => s.channel_id);
  if (channelIds.length === 0) return;
  await ensureChannels(channelIds);
  const { data: chans } = await admin
    .from("yt_channel_cache")
    .select("channel_id, videos_fetched_at")
    .in("channel_id", channelIds);
  const minGap = opts.force ? 10 * 60_000 : STALE_MS; // 수동 새로고침도 같은 채널은 10분에 한 번
  for (const c of chans ?? []) {
    if (ago(c.videos_fetched_at) >= minGap) {
      try {
        await refreshChannelVideos(c.channel_id, { force: true });
      } catch (e) {
        console.error("refresh channel failed", c.channel_id, e);
      }
    }
  }
}

// 30일 동안 다시 확인하지 못한 캐시를 지운다(정책 III.E.4.d). 정상이라면 recheckVideos가 7일마다 확인해 여기까지 오지 않는다.
export async function purgeCache() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();
  await admin.from("yt_video_cache").delete().lt("fetched_at", cutoff);
  await admin.from("yt_channel_cache").delete().lt("fetched_at", cutoff);
}

// 검색 한도 집계(태평양 시간 날짜 기준, 한도 초기화 시점과 맞춘다)
export function quotaDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

// 검색 한 번을 기록하고 오늘 남은 횟수를 돌려준다.
export async function addSearchUsage() {
  const admin = createAdminClient();
  const day = quotaDay();
  const { data } = await admin.from("search_usage").select("count").eq("day", day).maybeSingle();
  const count = (data?.count ?? 0) + 1;
  await admin.from("search_usage").upsert({ day, count });
  return Math.max(0, SEARCH_DAILY_LIMIT - count);
}

// 오늘 남은 검색 횟수(가족 공유). 아이는 사용량 표를 읽을 수 없어 서버 권한으로 읽는다.
export async function getSearchRemaining() {
  const { data } = await createAdminClient().from("search_usage").select("count").eq("day", quotaDay()).maybeSingle();
  return Math.max(0, SEARCH_DAILY_LIMIT - (data?.count ?? 0));
}
