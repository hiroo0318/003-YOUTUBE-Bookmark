import Link from "next/link";
import { BrandHeader } from "@/components/chrome";
import { IconChevron, IconClock } from "@/components/icons";
import { ChannelAvatar } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function KidRequestsPage() {
  const me = await requireMe("child");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("channel_requests")
    .select("id, channel_id, status, trigger_video_ids, last_trigger_video_id, created_at, decided_at, seen_by_child")
    .eq("profile_id", me.profileId!)
    .order("updated_at", { ascending: false })
    .limit(50);
  const requests = rows ?? [];
  const channels = await getChannelLites(requests.map((r) => r.channel_id));
  if (requests.some((r) => !r.seen_by_child)) await supabase.rpc("mark_requests_seen");

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} />
      <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        <h2 className="mt-2 text-subhead font-bold">내가 보낸 요청</h2>
        {requests.length === 0 ? (
          <p className="py-10 text-center text-caption text-sub">아직 보낸 요청이 없어요. 검색에서 보고 싶은 채널을 요청해 보세요.</p>
        ) : null}
        {requests.map((r) => {
          const title = channels.get(r.channel_id)?.title ?? "채널";
          const thumb = channels.get(r.channel_id)?.thumbnailUrl;
          const isNew = !r.seen_by_child;
          if (r.status === "approved") {
            // 영상 보기는 '채널 영상' 탭의 역할이다. 카드를 누르면 그 채널이 선택된 채널 영상 탭으로 간다.
            return (
              <Link
                key={r.id}
                href={`/kid?channel=${r.channel_id}`}
                className={`flex items-center gap-2.5 rounded-2xl border bg-surface p-3.5 text-ink ${isNew ? "border-accent-line" : "border-line"}`}
              >
                <ChannelAvatar title={title} url={thumb} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-semibold">{title}</span>
                  <span className="text-caption text-sub">{timeAgo(r.decided_at)} 승인됐어요</span>
                </div>
                <span className="rounded-full bg-accent-soft px-2 py-[3px] text-label font-semibold text-accent-strong">승인</span>
                <span className="flex-none text-sub">
                  <IconChevron size={18} />
                </span>
              </Link>
            );
          }
          return (
            <div key={r.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
              <ChannelAvatar title={title} url={thumb} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`text-body font-semibold ${r.status === "rejected" ? "text-sub" : ""}`}>{title}</span>
                <span className="text-caption text-sub">
                  {r.status === "pending"
                    ? `${timeAgo(r.created_at)} 요청${r.trigger_video_ids.length > 1 ? ` · 영상 ${r.trigger_video_ids.length}개` : ""}`
                    : `${timeAgo(r.decided_at)} · 다시 요청할 수 없어요`}
                </span>
              </div>
              {r.status === "pending" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-[3px] text-label font-semibold text-warn-ink">
                  <IconClock />
                  확인 중
                </span>
              ) : (
                <span className="rounded-full bg-muted-bg px-2 py-[3px] text-label font-semibold text-muted-ink">거절</span>
              )}
            </div>
          );
        })}
      </main>
    </>
  );
}
