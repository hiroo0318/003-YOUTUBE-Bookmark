import "server-only";

// YouTube Data API v3 (서버 전용). search.list는 별도 한도(하루 100회, 호출당 1), 나머지는 하루 10,000단위.
const API = "https://www.googleapis.com/youtube/v3";

export class QuotaExceededError extends Error {}
// 재생목록이 없음(예: 쇼츠를 한 번도 올리지 않은 채널의 쇼츠 목록 UUSH…)
export class NotFoundError extends Error {}

async function call<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY ?? "");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason;
    if (res.status === 403 && (reason === "quotaExceeded" || reason === "dailyLimitExceeded")) {
      throw new QuotaExceededError("YouTube 검색 한도를 다 썼어요");
    }
    if (res.status === 404) throw new NotFoundError(`YouTube API ${path} 404 ${reason ?? ""}`);
    throw new Error(`YouTube API ${path} ${res.status} ${reason ?? ""}`);
  }
  return res.json() as Promise<T>;
}

type Thumbs = { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
const thumb = (t?: Thumbs) => t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? null;

export type SearchVideo = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  durationSeconds?: number | null;
};

export async function searchVideos(q: string, pageToken?: string, channelId?: string) {
  const data = await call<{
    nextPageToken?: string;
    items: { id: { videoId: string }; snippet: { title: string; channelId: string; channelTitle: string; thumbnails: Thumbs } }[];
  }>("search", {
    part: "snippet",
    type: "video",
    q,
    maxResults: 50, // 한도는 호출당 1회라 최대치로 받아 "더 보기" 호출을 줄인다
    videoEmbeddable: "true",
    safeSearch: "strict",
    regionCode: "KR",
    relevanceLanguage: "ko",
    pageToken,
    channelId,
  });
  // YouTube 검색은 한 쪽 안에 같은 영상을 두 번 돌려줄 때가 있어 영상 번호로 중복을 뺀다.
  const seen = new Set<string>();
  const unique = data.items.filter((it) => it.id.videoId && !seen.has(it.id.videoId) && !!seen.add(it.id.videoId));
  // 검색 API에는 쇼츠를 빼는 옵션이 없어, 영상 정보(videos.list, 50개당 일반 할당량 1단위)를 한 번 더 조회해
  // 쇼츠로 추정되는 영상(3분 이하 + 세로)과 재생할 수 없는 영상을 뺀다. 조회에 실패하면 거르지 않고 그대로 보여준다.
  let details: Map<string, VideoDetail> | null = null;
  try {
    details = new Map((await getVideos(unique.map((it) => it.id.videoId))).map((d) => [d.videoId, d]));
  } catch (e) {
    console.error("search detail lookup failed", e);
  }
  const kept = details
    ? unique.filter((it) => {
        const d = details.get(it.id.videoId);
        return !!d && d.playable && !d.isShortGuess;
      })
    : unique;
  const items: SearchVideo[] = kept.map((it) => ({
    videoId: it.id.videoId,
    title: decodeEntities(it.snippet.title),
    channelId: it.snippet.channelId,
    channelTitle: decodeEntities(it.snippet.channelTitle),
    thumbnailUrl: thumb(it.snippet.thumbnails),
    durationSeconds: details?.get(it.id.videoId)?.durationSeconds ?? null,
  }));
  return { items, nextPageToken: data.nextPageToken ?? null };
}

export type SearchChannel = { channelId: string; title: string; thumbnailUrl: string | null; description: string };

export async function searchChannels(q: string) {
  const data = await call<{
    items: { id: { channelId: string }; snippet: { title: string; description: string; thumbnails: Thumbs } }[];
  }>("search", { part: "snippet", type: "channel", q, maxResults: 50, safeSearch: "strict", regionCode: "KR" });
  return data.items.map<SearchChannel>((it) => ({
    channelId: it.id.channelId,
    title: decodeEntities(it.snippet.title),
    description: decodeEntities(it.snippet.description),
    thumbnailUrl: thumb(it.snippet.thumbnails),
  }));
}

export type ChannelInfo = { channelId: string; title: string; thumbnailUrl: string | null; uploadsPlaylistId: string | null };

export async function getChannels(ids: string[]): Promise<ChannelInfo[]> {
  if (ids.length === 0) return [];
  const data = await call<{
    items?: { id: string; snippet: { title: string; thumbnails: Thumbs }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  }>("channels", { part: "snippet,contentDetails", id: ids.slice(0, 50).join(","), maxResults: 50 });
  return (data.items ?? []).map((c) => ({
    channelId: c.id,
    title: c.snippet.title,
    thumbnailUrl: thumb(c.snippet.thumbnails),
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
  }));
}

// 재생목록 한 쪽(최대 50개)과 다음 쪽 토큰.
export async function getPlaylistPage(playlistId: string, pageToken?: string | null): Promise<{ ids: string[]; next: string | null }> {
  const data = await call<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>("playlistItems", {
    part: "contentDetails",
    playlistId,
    maxResults: 50,
    pageToken: pageToken ?? undefined,
  });
  return { ids: (data.items ?? []).map((i) => i.contentDetails.videoId), next: data.nextPageToken ?? null };
}

// 채널의 쇼츠/일반 재생목록 ID(비공식 관행). UC로 시작하지 않으면 null.
export function splitPlaylistIds(channelId: string) {
  if (!channelId.startsWith("UC")) return null;
  const rest = channelId.slice(2);
  return { videos: `UULF${rest}`, shorts: `UUSH${rest}` };
}

// 채널 화면용: 최근 일반 영상 최대 50개(쇼츠·재생 불가 제외). 일반 할당량 약 2단위, 저장하지 않는다.
export async function getChannelRecentVideos(channelId: string, uploadsPlaylistId: string | null) {
  const split = splitPlaylistIds(channelId);
  let ids: string[] = [];
  if (split) {
    try {
      ids = (await getPlaylistPage(split.videos)).ids;
    } catch (e) {
      if (e instanceof QuotaExceededError) throw e;
    }
  }
  if (ids.length === 0 && uploadsPlaylistId) ids = (await getPlaylistPage(uploadsPlaylistId)).ids;
  const details = await getVideos(ids);
  return details.filter((d) => d.playable && !d.isShortGuess);
}

export type VideoDetail = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  madeForKids: boolean | null;
  embeddable: boolean | null;
  playable: boolean;
  isVertical: boolean | null;
  // 길이·비율로 추정한 쇼츠 여부(재생목록 판정이 없을 때 쓴다). 쇼츠는 최대 3분, 세로 영상.
  isShortGuess: boolean;
};

// 재생 가능 판정: 삭제·비공개·임베드 불가·처리 미완·한국 지역 제한·예정 실시간은 제외한다.
export async function getVideos(ids: string[]): Promise<VideoDetail[]> {
  const out: VideoDetail[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await call<{
      items?: {
        id: string;
        snippet: { channelId: string; title: string; thumbnails: Thumbs; publishedAt: string; liveBroadcastContent?: string };
        contentDetails?: { duration?: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } };
        status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string; madeForKids?: boolean };
        player?: { embedWidth?: string | number; embedHeight?: string | number };
      }[];
    }>("videos", { part: "snippet,contentDetails,status,player", id: chunk.join(","), maxResults: 50, maxWidth: 480 });
    for (const v of data.items ?? []) {
      const rr = v.contentDetails?.regionRestriction;
      const regionBlocked = !!(rr?.blocked?.includes("KR") || (rr?.allowed && !rr.allowed.includes("KR")));
      const w = Number(v.player?.embedWidth ?? 0);
      const h = Number(v.player?.embedHeight ?? 0);
      const vertical = w > 0 && h > 0 ? h > w : null;
      const duration = parseDuration(v.contentDetails?.duration);
      const playable =
        v.status?.privacyStatus !== "private" &&
        v.status?.embeddable !== false &&
        (v.status?.uploadStatus ?? "processed") === "processed" &&
        !regionBlocked &&
        v.snippet.liveBroadcastContent !== "upcoming";
      out.push({
        videoId: v.id,
        channelId: v.snippet.channelId,
        title: decodeEntities(v.snippet.title),
        thumbnailUrl: thumb(v.snippet.thumbnails),
        publishedAt: v.snippet.publishedAt ?? null,
        durationSeconds: duration,
        madeForKids: v.status?.madeForKids ?? null,
        embeddable: v.status?.embeddable ?? null,
        playable,
        isVertical: vertical,
        isShortGuess: vertical === true && duration != null && duration <= 180,
      });
    }
  }
  return out;
}

function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const [, d, h, mi, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
