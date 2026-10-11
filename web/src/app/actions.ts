"use server";

import { revalidatePath } from "next/cache";
import { requireMe } from "@/lib/auth";
import { getChannelStatusMap, type ChannelStatus } from "@/lib/data";
import { notifyChild, notifyMember, notifyParents } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { QuotaExceededError, searchChannels, searchVideos, type SearchChannel, type SearchVideo } from "@/lib/youtube";
import { addSearchUsage, ensureChannels, ensureVideos, loadOlderVideos, refreshChannelVideos, refreshProfileChannels } from "@/lib/yt-cache";

type Fail = { ok: false; error: string; remaining?: number };
const QUOTA_MSG = "오늘 검색 횟수를 다 썼어요. 승인 채널 영상은 계속 볼 수 있어요.";

// ───── 아이 ─────

export type SearchResultItem = SearchVideo & { status: ChannelStatus };

export async function searchAction(
  q: string,
  pageToken?: string | null,
): Promise<{ ok: true; items: SearchResultItem[]; nextPageToken: string | null; remaining?: number } | Fail> {
  const me = await requireMe("child");
  const query = q.trim();
  if (!query) return { ok: true, items: [], nextPageToken: null };
  try {
    const res = await searchVideos(query, pageToken ?? undefined);
    const remaining = await addSearchUsage();
    const statuses = await getChannelStatusMap(me.profileId!, res.items.map((i) => i.channelId));
    return {
      ok: true,
      remaining,
      nextPageToken: res.nextPageToken,
      items: res.items.map((i) => ({ ...i, status: statuses.get(i.channelId) ?? "none" })),
    };
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false, error: QUOTA_MSG, remaining: 0 };
    console.error(e);
    return { ok: false, error: "검색하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}

// 승인 채널 안에서 YouTube 검색(채널 하나를 골랐을 때만, 검색 한도 1회)
export async function searchInChannelAction(channelId: string, q: string) {
  const me = await requireMe("child");
  const statuses = await getChannelStatusMap(me.profileId!, [channelId]);
  if (statuses.get(channelId) !== "approved") return { ok: false as const, error: "승인된 채널만 찾을 수 있어요." };
  try {
    const res = await searchVideos(q.trim(), undefined, channelId);
    const remaining = await addSearchUsage();
    return { ok: true as const, items: res.items, remaining };
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false as const, error: QUOTA_MSG, remaining: 0 };
    return { ok: false as const, error: "검색하지 못했어요." };
  }
}

export async function requestChannelAction(channelId: string, videoId: string) {
  const me = await requireMe("child");
  // 계기 영상이 실제로 그 채널의 영상인지 YouTube에서 확인한다(부모가 다른 영상을 보고 승인하지 않도록).
  try {
    await ensureChannels([channelId]);
    await ensureVideos([videoId]);
  } catch (e) {
    console.error("cache for request failed", e);
    return { ok: false as const, error: "영상 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  const { data: video } = await createAdminClient()
    .from("yt_video_cache")
    .select("channel_id")
    .eq("video_id", videoId)
    .maybeSingle();
  if (!video || video.channel_id !== channelId) {
    return { ok: false as const, error: "영상 정보를 확인하지 못했어요." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_channel", { p_channel_id: channelId, p_video_id: videoId });
  if (error) return { ok: false as const, error: "요청을 보내지 못했어요." };
  const row = (data as { request_id: string | null; result: string }[])[0];
  if (row?.result === "created") {
    const { data: ch } = await createAdminClient().from("yt_channel_cache").select("title").eq("channel_id", channelId).maybeSingle();
    await notifyParents(me.familyId, {
      title: "채널 추가 요청",
      body: `${me.displayName}이(가) '${ch?.title ?? "새"}' 채널 추가를 요청했어요`,
      url: `/parent/requests/${row.request_id}`,
      tag: `request-${row.request_id}`,
    });
  }
  revalidatePath("/kid/search");
  revalidatePath("/kid/requests");
  return { ok: true as const, result: row?.result ?? "created" };
}

// 저장해 둔 검색 결과를 복원할 때 승인 상태만 다시 조회한다(검색 한도를 쓰지 않음).
export async function channelStatusesAction(channelIds: string[]): Promise<Record<string, ChannelStatus>> {
  const me = await requireMe("child");
  const map = await getChannelStatusMap(me.profileId!, channelIds.slice(0, 200));
  return Object.fromEntries(channelIds.map((id) => [id, map.get(id) ?? "none"]));
}

// 이전 영상 더 보기: 고른 승인 채널 하나의 영상(또는 쇼츠)을 50개 더 받는다(일반 할당량 약 2단위).
export async function loadOlderAction(channelId: string, kind: "video" | "short") {
  const me = await requireMe("child");
  const statuses = await getChannelStatusMap(me.profileId!, [channelId]);
  if (statuses.get(channelId) !== "approved") return { ok: false as const, error: "승인된 채널만 불러올 수 있어요." };
  try {
    const r = await loadOlderVideos(channelId, kind);
    revalidatePath("/kid");
    return { ok: true as const, added: r.added, done: r.done };
  } catch (e) {
    console.error("load older failed", e);
    return { ok: false as const, error: "이전 영상을 불러오지 못했어요." };
  }
}

// 좋아요 켜기/끄기: 승인 채널의 저장된 영상에만 누를 수 있다. YouTube API는 부르지 않는다.
export async function toggleLikeAction(videoId: string, on: boolean) {
  const me = await requireMe("child");
  const supabase = await createClient();
  if (!on) {
    const { error } = await supabase.from("video_likes").delete().eq("profile_id", me.profileId!).eq("video_id", videoId);
    if (error) return { ok: false as const, error: "좋아요를 취소하지 못했어요." };
  } else {
    // 캐시 읽기 정책상 아이는 승인 채널의 영상만 읽을 수 있다. 읽히면 승인 채널 영상이다.
    const { data: video } = await supabase.from("yt_video_cache").select("video_id").eq("video_id", videoId).maybeSingle();
    if (!video) return { ok: false as const, error: "승인된 채널의 영상만 좋아요할 수 있어요." };
    const { error } = await supabase.from("video_likes").insert({ profile_id: me.profileId!, video_id: videoId });
    if (error && error.code !== "23505") return { ok: false as const, error: "좋아요를 누르지 못했어요." };
  }
  revalidatePath("/kid");
  return { ok: true as const };
}

export async function refreshFeedAction() {
  const me = await requireMe("child");
  await refreshProfileChannels(me.profileId!, { force: true });
  revalidatePath("/kid");
}

// ───── 부모 ─────

export async function decideRequestAction(requestId: string, decision: "approved" | "rejected") {
  await requireMe("parent");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_request", { p_request_id: requestId, p_decision: decision });
  if (error) {
    return { ok: false as const, error: error.message.includes("ALREADY_DECIDED") ? "이미 처리된 요청이에요." : "처리하지 못했어요." };
  }
  const req = data as { profile_id: string; channel_id: string; last_trigger_video_id: string | null };
  if (decision === "approved") {
    try {
      await refreshChannelVideos(req.channel_id, { force: true });
    } catch (e) {
      console.error("refresh after approve failed", e);
    }
  }
  const { data: ch } = await supabase.from("yt_channel_cache").select("title").eq("channel_id", req.channel_id).maybeSingle();
  const title = ch?.title ?? "채널";
  // 승인 알림을 누르면 요청할 때 보던 영상을 바로 재생한다(계기 영상이 없으면 그 채널로 거른 채널 영상 탭).
  const approvedUrl = req.last_trigger_video_id
    ? `/kid/watch/${req.last_trigger_video_id}?autoplay=1&from=push&channel=${req.channel_id}`
    : `/kid?channel=${req.channel_id}`;
  await notifyChild(
    req.profile_id,
    decision === "approved"
      ? { title: "채널이 승인됐어요", body: `'${title}' 채널이 승인됐어요. 지금 볼 수 있어요`, url: approvedUrl, tag: `result-${requestId}` }
      : { title: "요청 결과", body: `'${title}' 채널은 부모님이 허락하지 않았어요`, url: "/kid/requests", tag: `result-${requestId}` },
  );
  revalidatePath("/parent");
  revalidatePath("/parent/channels");
  return { ok: true as const };
}

export async function setChannelStateAction(profileId: string, channelId: string, status: "approved" | "rejected" | "none") {
  await requireMe("parent");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_channel_state", { p_profile_id: profileId, p_channel_id: channelId, p_status: status });
  if (error) return { ok: false as const, error: "바꾸지 못했어요." };
  if (status === "approved") {
    try {
      await refreshChannelVideos(channelId, { force: true });
    } catch (e) {
      console.error(e);
    }
  }
  revalidatePath("/parent/channels");
  revalidatePath("/parent");
  return { ok: true as const };
}

export async function searchChannelsAction(q: string): Promise<{ ok: true; items: SearchChannel[]; remaining?: number } | Fail> {
  await requireMe("parent");
  if (!q.trim()) return { ok: true, items: [] };
  try {
    const items = await searchChannels(q.trim());
    const remaining = await addSearchUsage();
    await ensureChannels(items.map((i) => i.channelId)).catch(() => undefined);
    return { ok: true, items, remaining };
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false, error: "오늘 검색 횟수를 다 썼어요.", remaining: 0 };
    return { ok: false, error: "검색하지 못했어요." };
  }
}

export async function addMemberAction(_: unknown, form: FormData) {
  const me = await requireMe("parent");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const displayName = String(form.get("displayName") ?? "").trim();
  const role = form.get("role") === "parent" ? "parent" : "child";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "이메일 형식을 확인해 주세요." };
  if (!displayName) return { ok: false, error: "표시 이름을 입력해 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({ family_id: me.familyId, email, role, display_name: displayName });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "이미 등록된 이메일이에요." : "등록하지 못했어요." };
  }
  revalidatePath("/parent/family");
  return { ok: true, error: "" };
}

export async function removeMemberAction(memberId: string) {
  await requireMe("parent");
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { ok: false as const, error: error.message.includes("LAST_PARENT") ? "마지막 부모는 삭제할 수 없어요." : "삭제하지 못했어요." };
  revalidatePath("/parent/family");
  return { ok: true as const };
}

export async function setApprovalModeAction(profileId: string, on: boolean) {
  await requireMe("parent");
  const supabase = await createClient();
  const { error } = await supabase.from("child_profiles").update({ approval_mode: on }).eq("id", profileId);
  if (error) return { ok: false as const };
  revalidatePath("/parent/settings");
  return { ok: true as const };
}

// ───── 웹 푸시 구독 (부모·아이 공통) ─────

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

// 이 기기의 구독을 내 계정에 저장한다. 같은 기기를 다른 가족이 쓰던 구독은 먼저 지운다(기기당 한 명).
export async function savePushSubscriptionAction(sub: PushSub, userAgent: string) {
  const me = await requireMe();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false as const };
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint).neq("member_id", me.memberId);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
  if (existing) return { ok: true as const };
  const { error } = await supabase.from("push_subscriptions").insert({
    member_id: me.memberId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) console.error("save push subscription failed", error.message);
  return { ok: !error };
}

export async function removePushSubscriptionAction(endpoint: string) {
  await requireMe();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true as const };
}

export async function testPushAction() {
  const me = await requireMe();
  const sent = await notifyMember(me.memberId, {
    title: "채널담 알림 테스트",
    body: "알림이 잘 도착했어요.",
    url: me.role === "parent" ? "/parent/settings" : "/kid/requests",
    tag: "test",
  });
  return { ok: sent > 0 };
}
