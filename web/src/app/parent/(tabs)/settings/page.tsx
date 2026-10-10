import { BrandHeader } from "@/components/chrome";
import { SignOutForm } from "@/components/sign-out";
import { requireMe } from "@/lib/auth";
import { getProfiles } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { quotaDay } from "@/lib/yt-cache";
import { ModeSwitch } from "./mode-switch";

export default async function SettingsPage() {
  const me = await requireMe("parent");
  const supabase = await createClient();
  const [profiles, { data: usage }] = await Promise.all([
    getProfiles(me.familyId),
    supabase.from("search_usage").select("count").eq("day", quotaDay()).maybeSingle(),
  ]);
  const used = usage?.count ?? 0;

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} variant="parent" />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        <section aria-labelledby="mode" className="flex flex-col gap-2.5">
          <h2 id="mode" className="text-subhead font-bold">
            아이별 승인 모드
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {profiles.length === 0 ? <p className="p-3.5 text-caption text-sub">등록된 아이가 없어요.</p> : null}
            {profiles.map((p) => (
              <ModeSwitch key={p.id} profileId={p.id} name={p.name} initial={p.approvalMode} />
            ))}
          </div>
        </section>

        <section aria-labelledby="noti" className="flex flex-col gap-2.5">
          <h2 id="noti" className="text-subhead font-bold">
            알림
          </h2>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
            <span className="text-body font-semibold">요청 알림(웹 푸시)</span>
            <span className="text-caption text-sub">다음 업데이트에서 켤 수 있어요. 그전까지는 대기함 배지로 요청을 확인해 주세요.</span>
          </div>
        </section>

        <section aria-labelledby="use" className="flex flex-col gap-2.5">
          <h2 id="use" className="text-subhead font-bold">
            오늘 검색 사용량
          </h2>
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex justify-between text-body font-semibold">
              <span>가족 전체</span>
              <span>{used} / 100회</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div className="h-2 bg-accent" style={{ width: `${Math.min(100, used)}%` }} />
            </div>
            <span className="text-caption leading-normal text-sub">
              YouTube 검색은 가족 전체가 하루 100회를 나눠 써요(태평양 시간 자정에 초기화). 승인 채널 영상 탭의 검색은 횟수를 쓰지 않아요.
            </span>
          </div>
        </section>

        <section aria-labelledby="acc" className="flex flex-col gap-2.5">
          <h2 id="acc" className="text-subhead font-bold">
            계정
          </h2>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-semibold">{me.displayName} · 부모</span>
              <span className="truncate text-caption text-sub">{me.email}</span>
            </div>
            <SignOutForm>
              <button className="h-10 flex-none rounded-[10px] border border-line px-3.5 text-callout font-semibold">로그아웃</button>
            </SignOutForm>
          </div>
        </section>
      </main>
    </>
  );
}
