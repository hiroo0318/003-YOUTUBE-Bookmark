import { notFound } from "next/navigation";
import { BackHeader } from "@/components/chrome";
import { Player } from "@/components/player";
import { ChannelAvatar } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites, getVideoLites } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DecideButtons } from "./decide-buttons";

export default async function RequestDetail({ params }: PageProps<"/parent/requests/[id]">) {
  const me = await requireMe("parent");
  const { id } = await params;
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("channel_requests")
    .select("id, profile_id, channel_id, status, last_trigger_video_id, created_at")
    .eq("id", id)
    .eq("family_id", me.familyId)
    .maybeSingle();
  if (!req) notFound();

  const [{ data: profile }, channels, videos] = await Promise.all([
    supabase.from("child_profiles").select("display_name").eq("id", req.profile_id).maybeSingle(),
    getChannelLites([req.channel_id]),
    getVideoLites([req.last_trigger_video_id ?? ""]),
  ]);
  const kid = profile?.display_name ?? "아이";
  const channel = channels.get(req.channel_id);
  const video = videos.get(req.last_trigger_video_id ?? "");
  const when = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(req.created_at));

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <BackHeader href="/parent" label="대기함" />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-1">
        <div className="flex items-center gap-2 text-caption text-sub">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-strong">{kid[0]}</span>
          <span>
            <b className="font-semibold text-ink">{kid}</b> · {when} 요청
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
          <ChannelAvatar title={channel?.title ?? "?"} url={channel?.thumbnailUrl} size={56} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-heading font-bold">{channel?.title ?? "채널"}</h1>
            <a
              href={`https://www.youtube.com/channel/${req.channel_id}`}
              target="_blank"
              rel="noopener"
              className="text-caption font-semibold text-accent-strong"
            >
              YouTube에서 채널 둘러보기
            </a>
          </div>
        </div>
        {req.last_trigger_video_id ? (
          <section aria-labelledby="trig" className="flex flex-col gap-2.5">
            <h2 id="trig" className="text-subhead font-bold">
              {kid}이(가) 보려던 영상
            </h2>
            <Player videoId={req.last_trigger_video_id} rounded />
            <span className="text-body font-semibold">{video?.title}</span>
          </section>
        ) : null}
      </main>
      <DecideButtons requestId={req.id} kid={kid} status={req.status as "pending" | "approved" | "rejected"} />
    </div>
  );
}
