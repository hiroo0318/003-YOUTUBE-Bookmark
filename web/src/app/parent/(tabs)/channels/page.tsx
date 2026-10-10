import Link from "next/link";
import { BrandHeader } from "@/components/chrome";
import { IconPlus } from "@/components/icons";
import { ChannelAvatar } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getProfiles } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { StateButton } from "./state-button";

export default async function ChannelsPage({ searchParams }: PageProps<"/parent/channels">) {
  const me = await requireMe("parent");
  const sp = await searchParams;
  const profiles = await getProfiles(me.familyId);
  const kid = profiles.find((p) => p.id === sp.kid) ?? profiles[0];
  const tab = sp.tab === "rejected" ? "rejected" : "approved";

  if (!kid) {
    return (
      <>
        <BrandHeader name={me.displayName} email={me.email} variant="parent" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-subhead font-semibold">아직 등록된 아이가 없어요</p>
          <Link href="/parent/family" className="flex h-12 items-center rounded-xl bg-accent px-5 text-control font-semibold text-white">
            가족 관리에서 등록하기
          </Link>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: states } = await supabase
    .from("channel_states")
    .select("channel_id, status, decided_at")
    .eq("profile_id", kid.id)
    .order("decided_at", { ascending: false });
  const approved = (states ?? []).filter((s) => s.status === "approved");
  const rejected = (states ?? []).filter((s) => s.status === "rejected");
  const rows = tab === "approved" ? approved : rejected;
  const channels = await getChannelLites(rows.map((r) => r.channel_id));
  const href = (k: string, t: string) => `/parent/channels?kid=${k}&tab=${t}`;

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} variant="parent" />
      <div className="flex flex-col gap-3 px-5 pt-2">
        <div role="tablist" aria-label="아이 선택" className="no-scrollbar flex gap-2 overflow-x-auto">
          {profiles.map((p) => (
            <Link
              key={p.id}
              role="tab"
              aria-selected={p.id === kid.id}
              href={href(p.id, tab)}
              className={`flex h-10 flex-none items-center rounded-full border px-4 text-callout ${
                p.id === kid.id ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface font-medium text-ink"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 rounded-xl bg-track p-1">
          {(["approved", "rejected"] as const).map((t) => (
            <Link
              key={t}
              href={href(kid.id, t)}
              aria-current={tab === t ? "page" : undefined}
              className={`flex h-10 items-center justify-center rounded-[9px] text-callout ${
                tab === t ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"
              }`}
            >
              {t === "approved" ? `승인 ${approved.length}` : `거절 ${rejected.length}`}
            </Link>
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-2.5 px-5 pb-5 pt-3.5">
        {tab === "approved" ? (
          <Link
            href={`/parent/add-channel?kid=${kid.id}`}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#a9b7e8] bg-surface text-control font-semibold text-accent-strong"
          >
            <IconPlus size={18} />
            채널 찾아서 직접 승인
          </Link>
        ) : null}
        {rows.map((r) => {
          const c = channels.get(r.channel_id);
          return (
            <div key={r.channel_id} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
              <ChannelAvatar title={c?.title ?? "?"} url={c?.thumbnailUrl} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body font-semibold">{c?.title ?? r.channel_id}</span>
                <span className="text-caption text-sub">
                  {timeAgo(r.decided_at)} {tab === "approved" ? "승인" : "거절"}
                </span>
              </div>
              <StateButton profileId={kid.id} channelId={r.channel_id} label={tab === "approved" ? "승인 취소" : "거절 풀기"} />
            </div>
          );
        })}
        <p className="mt-1.5 px-0.5 text-caption leading-normal text-sub">
          {tab === "approved"
            ? "승인을 취소하면 그 채널 영상이 아이 목록에서 빠지고, 아이는 다시 요청할 수 있어요."
            : rows.length
              ? "거절을 풀면 아이가 그 채널을 다시 요청할 수 있어요."
              : "거절한 채널이 없어요."}
        </p>
      </main>
    </>
  );
}
