import Link from "next/link";
import { BackHeader } from "@/components/chrome";
import { Player } from "@/components/player";
import { ChannelAvatar, VideoRowBody } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites, getChannelStatusMap, getVideoLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ensureChannels, ensureVideos } from "@/lib/yt-cache";

export default async function WatchPage({ params, searchParams }: PageProps<"/kid/watch/[videoId]">) {
  const me = await requireMe("child");
  const { videoId } = await params;
  const { autoplay, from } = await searchParams;
  const back = from === "search" ? { href: "/kid/search", label: "검색" } : { href: "/kid", label: "승인 채널 영상" };

  await ensureVideos([videoId]).catch(() => undefined);
  // 채널 확인 전이라 서버 권한으로 읽고, 아래에서 승인 여부를 직접 확인한다.
  const video = (await getVideoLites([videoId], { admin: true })).get(videoId);
  if (!video) {
    return (
      <>
        <BackHeader {...back} />
        <p className="mx-5 mt-4 rounded-xl bg-danger-bg px-3.5 py-3 text-body text-danger-ink">영상을 찾을 수 없어요.</p>
      </>
    );
  }

  const status = (await getChannelStatusMap(me.profileId!, [video.channelId])).get(video.channelId) ?? "none";
  const allowed = status === "approved" || !me.approvalMode;
  await ensureChannels([video.channelId]).catch(() => undefined);
  const channel = (await getChannelLites([video.channelId], { admin: true })).get(video.channelId);

  if (!allowed) {
    return (
      <>
        <BackHeader {...back} />
        <div className="mx-5 mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-body">부모님이 승인한 채널의 영상만 볼 수 있어요.</p>
          <Link href="/kid/search" className="flex h-12 items-center justify-center rounded-xl bg-accent text-control font-semibold text-white">
            검색에서 채널 추가 요청하기
          </Link>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: more } =
    status === "approved"
      ? await supabase
          .from("yt_video_cache")
          .select("video_id, title, thumbnail_url, published_at, duration_seconds")
          .eq("channel_id", video.channelId)
          .eq("playable", true)
          .neq("video_id", videoId)
          .order("published_at", { ascending: false })
          .limit(10)
      : { data: [] };

  return (
    <div className="flex flex-col bg-surface pb-6">
      <BackHeader {...back} />
      <Player videoId={videoId} autoplay={autoplay === "1"} />
      <div className="flex flex-col gap-[18px] px-5 pt-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-heading font-bold">{video.title}</h1>
          <div className="flex items-center gap-2.5">
            <ChannelAvatar title={channel?.title ?? "?"} url={channel?.thumbnailUrl} size={36} />
            <span className="text-body font-semibold">{channel?.title}</span>
            {status === "approved" ? (
              <span className="ml-auto rounded-full bg-accent-soft px-2 py-[3px] text-label font-semibold text-accent-strong">승인 채널</span>
            ) : null}
          </div>
        </div>
        {more && more.length > 0 ? (
          <section aria-labelledby="more" className="flex flex-col gap-3">
            <h2 id="more" className="text-subhead font-bold">
              이 채널의 다른 영상
            </h2>
            {more.map((m) => (
              <Link key={m.video_id} href={`/kid/watch/${m.video_id}`} className="flex gap-3 text-ink">
                <VideoRowBody
                  thumbnailUrl={m.thumbnail_url}
                  duration={m.duration_seconds}
                  playable
                  title={m.title}
                  meta={timeAgo(m.published_at)}
                />
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
