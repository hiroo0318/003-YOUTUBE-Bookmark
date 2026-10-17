import Link from "next/link";
import { RefreshButton } from "@/components/auto-refresh";
import { BrandHeader } from "@/components/chrome";
import { IconChevron } from "@/components/icons";
import { Thumb } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites, getVideoLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getProfiles, getStateLog, STATE_ACTION_LABEL, type StateAction } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { DecidedToast } from "./decided-toast";

export default async function ParentInbox({ searchParams }: PageProps<"/parent">) {
  const me = await requireMe("parent");
  const { decided, kid: decidedKid, who: whoParam } = await searchParams;
  const supabase = await createClient();
  // 아이별로 보기: who = 아이 프로필 ID(없으면 전체). 대기 건수는 아이별로 세야 해서 전체를 받아 거르고, 최근 처리는 DB에서 거른다.
  const profiles = await getProfiles(me.familyId);
  const who = profiles.some((p) => p.id === whoParam) ? (whoParam as string) : null;
  const [{ data: allPending }, done] = await Promise.all([
    supabase
      .from("channel_requests")
      .select("id, profile_id, channel_id, trigger_video_ids, last_trigger_video_id, updated_at")
      .eq("family_id", me.familyId)
      .eq("status", "pending")
      .order("updated_at", { ascending: false }),
    getStateLog(me.familyId, { profileId: who, limit: 15 }),
  ]);
  const pending = (allPending ?? []).filter((r) => !who || r.profile_id === who);
  const pendingBy = new Map<string, number>();
  for (const r of allPending ?? []) pendingBy.set(r.profile_id, (pendingBy.get(r.profile_id) ?? 0) + 1);
  const filters: { id: string | null; name: string; count: number }[] = [
    { id: null, name: "전체", count: allPending?.length ?? 0 },
    ...profiles.map((p) => ({ id: p.id, name: p.name, count: pendingBy.get(p.id) ?? 0 })),
  ];
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const all = [...pending.map((r) => ({ channel_id: r.channel_id })), ...done.map((d) => ({ channel_id: d.channelId }))];
  const channels = await getChannelLites(all.map((r) => r.channel_id));
  const videos = await getVideoLites(pending.map((r) => r.last_trigger_video_id ?? ""));

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} variant="parent" />
      {decided === "approved" || decided === "rejected" ? (
        <DecidedToast decided={decided} kid={typeof decidedKid === "string" ? decidedKid : "아이"} cleanUrl={who ? `/parent?who=${who}` : "/parent"} />
      ) : null}
      <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        {profiles.length > 1 ? (
          <div role="tablist" aria-label="아이별 보기" className="no-scrollbar flex gap-2 overflow-x-auto">
            {filters.map((c) => {
              const on = c.id === who;
              return (
                <Link
                  key={c.id ?? "all"}
                  role="tab"
                  aria-selected={on}
                  href={c.id ? `/parent?who=${c.id}` : "/parent"}
                  className={`flex h-10 flex-none items-center gap-1.5 rounded-full border px-4 text-callout ${
                    on ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface font-medium text-ink"
                  }`}
                >
                  {c.name}
                  {c.count > 0 ? (
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label font-bold ${on ? "bg-white text-ink" : "bg-badge text-white"}`}>
                      {c.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <h2 className="text-subhead font-bold">승인 대기 {pending.length}건</h2>
          <RefreshButton label="대기함 새로고침" />
        </div>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-caption text-sub">
            {who ? `${profiles.find((p) => p.id === who)?.name ?? "아이"}의 대기 중인 요청이 없어요.` : "대기 중인 요청이 없어요."}
          </p>
        ) : null}
        {pending.map((r) => {
          const kid = names.get(r.profile_id) ?? "아이";
          const v = videos.get(r.last_trigger_video_id ?? "");
          return (
            <Link key={r.id} href={`/parent/requests/${r.id}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 text-ink">
              <div className="flex items-center gap-2 text-caption text-sub">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-label font-bold text-accent-strong">{kid[0]}</span>
                <span>
                  <b className="font-semibold text-ink">{kid}</b>이(가) 채널 추가를 요청했어요
                </span>
                <span className="ml-auto flex-none">{timeAgo(r.updated_at)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Thumb url={v?.thumbnailUrl ?? null} className="h-[63px] w-28" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-subhead font-bold">{channels.get(r.channel_id)?.title ?? "채널"}</span>
                  <span className="line-clamp-2 text-caption text-sub">
                    {v?.title ?? ""}
                    {r.trigger_video_ids.length > 1 ? ` 외 ${r.trigger_video_ids.length - 1}개 영상` : ""}
                  </span>
                </div>
                <span className="flex-none text-sub">
                  <IconChevron size={18} />
                </span>
              </div>
            </Link>
          );
        })}

        {done.length > 0 ? <h2 className="mt-3 text-subhead font-bold">최근 처리</h2> : null}
        {done.map((d) => (
          <Link
            key={d.id}
            href={`/parent/channel/${d.channelId}?kid=${d.profileId}`}
            className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-ink"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">{channels.get(d.channelId)?.title ?? "채널"}</span>
              <span className="text-caption text-sub">
                {names.get(d.profileId) ?? "아이"}
                {d.actor ? ` · ${d.actor}` : ""} · {timeAgo(d.at)}
              </span>
            </div>
            <ActionTag action={d.action} />
          </Link>
        ))}
      </main>
    </>
  );
}

// 처리 종류 표시: 승인(파랑), 거절(회색), 승인 취소(주황), 거절 풀기(테두리)
function ActionTag({ action }: { action: StateAction }) {
  const tone: Record<StateAction, string> = {
    approved: "bg-accent-soft text-accent-strong",
    rejected: "bg-muted-bg text-muted-ink",
    approval_cancelled: "bg-warn-bg text-warn-ink",
    rejection_cleared: "border border-line bg-surface text-sub",
  };
  return <span className={`flex-none rounded-full px-2 py-[3px] text-label font-semibold ${tone[action]}`}>{STATE_ACTION_LABEL[action]}</span>;
}
