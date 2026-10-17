import Link from "next/link";
import { RefreshButton } from "@/components/auto-refresh";
import { BrandHeader } from "@/components/chrome";
import { IconChevron } from "@/components/icons";
import { Thumb } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites, getVideoLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getProfiles } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { DecidedToast } from "./decided-toast";

export default async function ParentInbox({ searchParams }: PageProps<"/parent">) {
  const me = await requireMe("parent");
  const { decided, kid: decidedKid, who: whoParam } = await searchParams;
  const supabase = await createClient();
  // 아이별로 보기: who = 아이 프로필 ID(없으면 전체). 대기 건수는 아이별로 세야 해서 전체를 받아 거르고, 최근 처리는 DB에서 거른다.
  const profiles = await getProfiles(me.familyId);
  const who = profiles.some((p) => p.id === whoParam) ? (whoParam as string) : null;
  let doneQuery = supabase
    .from("channel_requests")
    .select("id, profile_id, channel_id, status, decided_at")
    .eq("family_id", me.familyId)
    .neq("status", "pending");
  if (who) doneQuery = doneQuery.eq("profile_id", who);
  const [{ data: allPending }, { data: done }] = await Promise.all([
    supabase
      .from("channel_requests")
      .select("id, profile_id, channel_id, trigger_video_ids, last_trigger_video_id, updated_at")
      .eq("family_id", me.familyId)
      .eq("status", "pending")
      .order("updated_at", { ascending: false }),
    doneQuery.order("decided_at", { ascending: false }).limit(10),
  ]);
  const pending = (allPending ?? []).filter((r) => !who || r.profile_id === who);
  const pendingBy = new Map<string, number>();
  for (const r of allPending ?? []) pendingBy.set(r.profile_id, (pendingBy.get(r.profile_id) ?? 0) + 1);
  const filters: { id: string | null; name: string; count: number }[] = [
    { id: null, name: "전체", count: allPending?.length ?? 0 },
    ...profiles.map((p) => ({ id: p.id, name: p.name, count: pendingBy.get(p.id) ?? 0 })),
  ];
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const all = [...pending, ...(done ?? [])];
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

        {(done ?? []).length > 0 ? <h2 className="mt-3 text-subhead font-bold">최근 처리</h2> : null}
        {(done ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold">{channels.get(r.channel_id)?.title ?? "채널"}</span>
              <span className="text-caption text-sub">
                {names.get(r.profile_id) ?? "아이"} · {timeAgo(r.decided_at)}
              </span>
            </div>
            {r.status === "approved" ? (
              <span className="rounded-full bg-accent-soft px-2 py-[3px] text-label font-semibold text-accent-strong">승인</span>
            ) : (
              <span className="rounded-full bg-muted-bg px-2 py-[3px] text-label font-semibold text-muted-ink">거절</span>
            )}
          </div>
        ))}
      </main>
    </>
  );
}
