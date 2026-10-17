import Link from "next/link";
import { BrandHeader } from "@/components/chrome";
import { ChannelAvatar, Thumb } from "@/components/video";
import { requireMe } from "@/lib/auth";
import { getChannelLites, getVideoLites } from "@/lib/data";
import { formatMinutes } from "@/lib/format";
import { getProfiles } from "@/lib/parent-data";
import { getWatchSummary, type WatchPeriod } from "@/lib/watch";
import { BonusButtons, LimitForm } from "./watch-controls";

const DOW = ["", "월", "화", "수", "목", "금", "토", "일"];
const PERIODS: [WatchPeriod, string][] = [
  ["today", "오늘"],
  ["7d", "7일"],
  ["30d", "30일"],
];

// 부모 '시청' 탭: 아이별 오늘 시청 시간·한도·보너스, 주간·월간 누적, 하루 한도 설정, 많이 본 영상·채널.
export default async function WatchPage({ searchParams }: PageProps<"/parent/watch">) {
  const me = await requireMe("parent");
  const sp = await searchParams;
  const profiles = await getProfiles(me.familyId);
  const kid = profiles.find((p) => p.id === sp.kid) ?? profiles[0];
  const period: WatchPeriod = sp.period === "today" || sp.period === "30d" ? sp.period : "7d";

  if (!kid) {
    return (
      <>
        <BrandHeader name={me.displayName} email={me.email} variant="parent" />
        <p className="px-8 py-16 text-center text-subhead font-semibold">아직 등록된 아이가 없어요</p>
      </>
    );
  }

  const s = await getWatchSummary(kid.id, period);
  const [videos, channels] = await Promise.all([
    getVideoLites(s.topVideos.map((v) => v.videoId)),
    getChannelLites([...s.topChannels.map((c) => c.channelId), ...s.topVideos.map((v) => v.channelId)]),
  ]);
  const href = (k: string, p: WatchPeriod) => `/parent/watch?kid=${k}&period=${p}`;
  const limit = s.todayLimitSeconds;
  const ratio = limit ? Math.min(1, s.todaySeconds / limit) : 0;
  const maxDay = Math.max(1, ...s.last7.map((d) => d.seconds));
  const baseMinutes = s.isWeekend ? s.limits.weekend : s.limits.weekday;

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} variant="parent" />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        <div role="tablist" aria-label="아이 선택" className="no-scrollbar flex gap-2 overflow-x-auto">
          {profiles.map((p) => (
            <Link
              key={p.id}
              role="tab"
              aria-selected={p.id === kid.id}
              href={href(p.id, period)}
              className={`flex h-10 flex-none items-center rounded-full border px-4 text-callout ${
                p.id === kid.id ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface font-medium text-ink"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>

        <section aria-labelledby="today" className="flex flex-col gap-2.5">
          <h2 id="today" className="text-subhead font-bold">
            오늘 시청 시간
          </h2>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-title font-bold">{formatMinutes(s.todaySeconds)}</span>
              <span className="text-caption text-sub">
                {limit == null
                  ? `${s.isWeekend ? "주말" : "평일"} 제한 없음`
                  : `하루 ${formatMinutes(limit)}${s.todayBonusMinutes ? ` (보너스 ${s.todayBonusMinutes}분 포함)` : ""}`}
              </span>
            </div>
            {limit != null ? (
              <div className="h-2 overflow-hidden rounded-full bg-track">
                <div className={`h-2 ${ratio >= 1 ? "bg-warn-ink" : "bg-accent"}`} style={{ width: `${ratio * 100}%` }} />
              </div>
            ) : null}
            {baseMinutes != null ? (
              <BonusButtons profileId={kid.id} bonus={s.todayBonusMinutes} />
            ) : (
              <p className="text-caption text-sub">한도를 정하면 오늘 보너스 시간을 줄 수 있어요.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="sum" className="flex flex-col gap-2.5">
          <h2 id="sum" className="text-subhead font-bold">
            누적
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ["이번 주", s.week],
                ["이번 달", s.month],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
                <span className="text-caption text-sub">{label}</span>
                <span className="text-heading font-bold">{formatMinutes(v.seconds)}</span>
                <span className="text-label text-sub">하루 평균 {formatMinutes(v.seconds / v.days)}</span>
              </div>
            ))}
          </div>
          <div className="flex h-36 items-end gap-2 rounded-2xl border border-line bg-surface px-3.5 pb-3 pt-4" aria-label="최근 7일 시청 시간">
            {s.last7.map((d) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-sub">{d.seconds ? formatMinutes(d.seconds) : ""}</span>
                <div
                  className={`w-full rounded-t-md ${d.day === s.today ? "bg-accent" : "bg-accent-line"}`}
                  style={{ height: `${Math.max(2, (d.seconds / maxDay) * 70)}%` }}
                />
                <span className={`text-label ${d.dow >= 6 ? "text-warn-ink" : "text-sub"}`}>{DOW[d.dow]}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="limit" className="flex flex-col gap-2.5">
          <h2 id="limit" className="text-subhead font-bold">
            하루 시청 한도
          </h2>
          <LimitForm key={kid.id} profileId={kid.id} weekday={s.limits.weekday} weekend={s.limits.weekend} />
          <p className="px-1 text-caption leading-normal text-sub">
            한도를 다 쓰면 채널담에서 영상이 멈추고, 한국 시간 자정에 다시 볼 수 있어요. YouTube 앱 등 다른 곳에서 보는 시간은 포함되지 않아요.
          </p>
        </section>

        <section aria-labelledby="top" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 id="top" className="text-subhead font-bold">
              많이 본 영상
            </h2>
            <div className="flex gap-1 rounded-xl bg-track p-1">
              {PERIODS.map(([p, label]) => (
                <Link
                  key={p}
                  href={href(kid.id, p)}
                  className={`flex h-8 items-center rounded-[9px] px-3 text-caption ${
                    p === period ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {s.topVideos.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-caption text-sub">아직 재생 기록이 없어요.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {s.topVideos.map((v, i) => {
                const info = videos.get(v.videoId);
                return (
                  <li key={v.videoId} className="flex items-center gap-3">
                    <span className="w-4 flex-none text-center text-caption font-bold text-sub">{i + 1}</span>
                    <Thumb url={info?.thumbnailUrl ?? null} className="h-[54px] w-24" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-caption font-semibold leading-[1.35]">{info?.title ?? "볼 수 없는 영상"}</span>
                      <span className="truncate text-meta text-sub">{channels.get(v.channelId)?.title ?? ""}</span>
                    </div>
                    <span className="flex-none text-caption font-semibold text-accent-strong">{v.count}회</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {s.topChannels.length > 0 ? (
          <section aria-labelledby="ch" className="flex flex-col gap-2.5">
            <h2 id="ch" className="text-subhead font-bold">
              많이 본 채널
            </h2>
            <div className="flex flex-col divide-y divide-line-soft rounded-2xl border border-line bg-surface">
              {s.topChannels.map((c) => {
                const ch = channels.get(c.channelId);
                return (
                  <div key={c.channelId} className="flex items-center gap-3 px-3.5 py-2.5">
                    <ChannelAvatar title={ch?.title ?? "?"} url={ch?.thumbnailUrl} size={36} />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">{ch?.title ?? "채널"}</span>
                    <span className="flex-none text-caption font-semibold text-accent-strong">{c.count}회</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <p className="px-1 text-label text-sub">시청 시간과 재생 횟수는 채널담에서 기록한 값이에요(YouTube 수치 아님).</p>
      </main>
    </>
  );
}
