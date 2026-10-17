import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/chrome";
import { ChannelAvatar } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getProfiles } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { StateButton } from "@/app/parent/(tabs)/channels/state-button";
import { ParentChannelVideos } from "./channel-videos";

// 부모용 채널 화면: 아이가 보는 것과 같은 저장 목록(영상/쇼츠)을 확인하고 바로 재생한다.
// 부모 재생은 아이 시청 기록에 넣지 않는다. 전체 채널은 YouTube 링크로 본다.
export default async function ParentChannelPage({ params, searchParams }: PageProps<"/parent/channel/[channelId]">) {
  const me = await requireMe("parent");
  const { channelId } = await params;
  const sp = await searchParams;
  const profiles = await getProfiles(me.familyId);
  const kid = profiles.find((p) => p.id === sp.kid);
  if (!kid) redirect("/parent/channels");
  const tab = sp.tab === "rejected" ? "rejected" : "approved";

  const supabase = await createClient();
  const [channels, { data: state }, { data: rows }] = await Promise.all([
    getChannelLites([channelId]),
    supabase.from("channel_states").select("status, decided_at").eq("profile_id", kid.id).eq("channel_id", channelId).maybeSingle(),
    supabase
      .from("yt_video_cache")
      .select("video_id, title, thumbnail_url, published_at, duration_seconds, is_short")
      .eq("channel_id", channelId)
      .eq("playable", true)
      .order("published_at", { ascending: false })
      .limit(1000),
  ]);
  const channel = channels.get(channelId);
  if (!channel) notFound();
  const status = (state?.status as "approved" | "rejected" | undefined) ?? "none";
  const videos = (rows ?? []).map((v) => ({
    videoId: v.video_id as string,
    title: v.title as string,
    thumbnailUrl: v.thumbnail_url as string | null,
    publishedAt: v.published_at as string | null,
    durationSeconds: v.duration_seconds as number | null,
    isShort: v.is_short === true,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <BackHeader href={`/parent/channels?kid=${kid.id}&tab=${tab}`} label="채널 관리" />
      <main className="flex flex-1 flex-col gap-4 pb-6 pt-1">
        <div className="flex items-center gap-3 px-5">
          <ChannelAvatar title={channel.title} url={channel.thumbnailUrl} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="truncate text-heading font-bold">{channel.title}</h1>
            <span className="text-caption text-sub">
              {kid.name} ·{" "}
              {status === "approved" ? `${timeAgo(state?.decided_at)} 승인` : status === "rejected" ? `${timeAgo(state?.decided_at)} 거절` : "승인 전"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5">
          {status === "approved" ? (
            <StateButton profileId={kid.id} channelId={channelId} label="승인 취소" confirmText={`${kid.name}의 '${channel.title}' 승인을 취소할까요?`} />
          ) : status === "rejected" ? (
            <StateButton profileId={kid.id} channelId={channelId} label="거절 풀기" />
          ) : (
            <StateButton profileId={kid.id} channelId={channelId} label="다시 승인" status="approved" primary />
          )}
          <a
            href={`https://www.youtube.com/channel/${channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex h-9 items-center rounded-[10px] border border-line px-3 text-caption font-semibold text-ink"
          >
            YouTube에서 보기 ↗
          </a>
        </div>
        <ParentChannelVideos videos={videos} />
      </main>
    </div>
  );
}
