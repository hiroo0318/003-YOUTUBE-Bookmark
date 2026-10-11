import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// admin: 서버에서 권한 확인을 마친 뒤 RLS 밖의 캐시를 읽을 때만 쓴다(예: 승인 모드 꺼짐 재생 화면).
type ReadOpts = { admin?: boolean };
const reader = async (o?: ReadOpts) => (o?.admin ? createAdminClient() : await createClient());

export type ChannelStatus = "approved" | "rejected" | "pending" | "none";

export type FeedVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isShort: boolean;
  playable: boolean;
};

export type ChannelLite = { channelId: string; title: string; thumbnailUrl: string | null };

export async function getChannelLites(channelIds: string[], opts?: ReadOpts): Promise<Map<string, ChannelLite>> {
  const map = new Map<string, ChannelLite>();
  if (channelIds.length === 0) return map;
  const supabase = await reader(opts);
  const { data } = await supabase
    .from("yt_channel_cache")
    .select("channel_id, title, thumbnail_url")
    .in("channel_id", [...new Set(channelIds)]);
  for (const c of data ?? []) map.set(c.channel_id, { channelId: c.channel_id, title: c.title, thumbnailUrl: c.thumbnail_url });
  return map;
}

export async function getApprovedChannelIds(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_states")
    .select("channel_id, decided_at")
    .eq("profile_id", profileId)
    .eq("status", "approved")
    .order("decided_at", { ascending: false });
  return (data ?? []).map((s) => s.channel_id as string);
}

// 승인 채널 영상: 프로필의 승인 채널 × 공유 캐시(재생 가능 판정 통과분만)
export async function getApprovedFeed(profileId: string) {
  const supabase = await createClient();
  const channelIds = await getApprovedChannelIds(profileId);
  if (channelIds.length === 0)
    return { videos: [] as FeedVideo[], channels: [] as ChannelLite[], lastFetchedAt: null as string | null, likedIds: [] as string[] };

  const [{ data: vids }, { data: chans }, { data: likes }] = await Promise.all([
    supabase
      .from("yt_video_cache")
      .select("video_id, channel_id, title, thumbnail_url, published_at, duration_seconds, is_short")
      .in("channel_id", channelIds)
      .eq("playable", true)
      .order("published_at", { ascending: false })
      .limit(3000),
    supabase.from("yt_channel_cache").select("channel_id, title, thumbnail_url, videos_fetched_at").in("channel_id", channelIds),
    supabase.from("video_likes").select("video_id").eq("profile_id", profileId).order("created_at", { ascending: false }),
  ]);

  // 좋아요한 영상 중 위 목록에 없는 것(오래됐거나 재생 불가로 바뀐 것)을 더 읽는다.
  // 캐시 읽기 정책상 승인이 취소된 채널의 영상은 나오지 않으므로 좋아요 목록에서도 빠진다.
  const likedAll = (likes ?? []).map((l) => l.video_id as string);
  const have = new Set((vids ?? []).map((v) => v.video_id as string));
  const missing = likedAll.filter((id) => !have.has(id));
  const { data: extra } = missing.length
    ? await supabase
        .from("yt_video_cache")
        .select("video_id, channel_id, title, thumbnail_url, published_at, duration_seconds, is_short, playable")
        .in("video_id", missing)
        .in("channel_id", channelIds)
    : { data: [] };

  const chanMap = new Map((chans ?? []).map((c) => [c.channel_id as string, c]));
  const channels: ChannelLite[] = channelIds
    .filter((id) => chanMap.has(id))
    .map((id) => ({ channelId: id, title: chanMap.get(id)!.title, thumbnailUrl: chanMap.get(id)!.thumbnail_url }));
  const fetchedTimes = (chans ?? []).map((c) => c.videos_fetched_at).filter(Boolean) as string[];
  const lastFetchedAt = fetchedTimes.sort().at(-1) ?? null;

  const toFeed = (v: NonNullable<typeof extra>[number] | NonNullable<typeof vids>[number], playable: boolean): FeedVideo => ({
    videoId: v.video_id,
    channelId: v.channel_id,
    channelTitle: chanMap.get(v.channel_id)?.title ?? "",
    title: v.title,
    thumbnailUrl: v.thumbnail_url,
    publishedAt: v.published_at,
    durationSeconds: v.duration_seconds,
    isShort: v.is_short === true,
    playable,
  });
  // 좋아요 목록 전용 영상(재생 불가 포함)은 뒤에 붙인다. 화면에서 채널·전체 목록은 재생 가능한 것만 쓴다.
  const videos: FeedVideo[] = [
    ...(vids ?? []).map((v) => toFeed(v, true)),
    ...(extra ?? []).map((v) => toFeed(v, (v as { playable: boolean }).playable === true)),
  ];
  const known = new Set(videos.map((v) => v.videoId));
  const likedIds = likedAll.filter((id) => known.has(id));
  return { videos, channels, lastFetchedAt, likedIds };
}

// 검색 결과 표시용: 채널별 상태(승인/거절/대기/없음)
export async function getChannelStatusMap(profileId: string, channelIds: string[]) {
  const supabase = await createClient();
  const ids = [...new Set(channelIds)];
  const map = new Map<string, ChannelStatus>();
  if (ids.length === 0) return map;
  const [{ data: states }, { data: pending }] = await Promise.all([
    supabase.from("channel_states").select("channel_id, status").eq("profile_id", profileId).in("channel_id", ids),
    supabase
      .from("channel_requests")
      .select("channel_id")
      .eq("profile_id", profileId)
      .eq("status", "pending")
      .in("channel_id", ids),
  ]);
  for (const p of pending ?? []) map.set(p.channel_id, "pending");
  for (const s of states ?? []) map.set(s.channel_id, s.status as ChannelStatus);
  return map;
}

export async function getVideoLites(videoIds: string[], opts?: ReadOpts) {
  const supabase = await reader(opts);
  const ids = [...new Set(videoIds)].filter(Boolean);
  const map = new Map<string, { title: string; thumbnailUrl: string | null; channelId: string; durationSeconds: number | null }>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("yt_video_cache")
    .select("video_id, title, thumbnail_url, channel_id, duration_seconds")
    .in("video_id", ids);
  for (const v of data ?? [])
    map.set(v.video_id, { title: v.title, thumbnailUrl: v.thumbnail_url, channelId: v.channel_id, durationSeconds: v.duration_seconds });
  return map;
}

export async function isLiked(profileId: string, videoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("video_likes").select("video_id").eq("profile_id", profileId).eq("video_id", videoId).maybeSingle();
  return !!data;
}
