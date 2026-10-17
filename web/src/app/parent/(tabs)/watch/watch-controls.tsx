"use client";

import { useState, useTransition } from "react";
import { setTodayBonusAction, setWatchLimitsAction } from "@/app/actions";

const OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "제한 없음" },
  ...[5, 15, 30, 45, 60, 90, 120, 150, 180, 240].map((m) => ({
    value: String(m),
    label: m < 60 ? `${m}분` : m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`,
  })),
];

// 하루 한도(평일·주말). 엄마·아빠 누가 바꿔도 같은 값이 적용된다.
export function LimitForm({ profileId, weekday, weekend }: { profileId: string; weekday: number | null; weekend: number | null }) {
  const [wd, setWd] = useState(weekday == null ? "" : String(weekday));
  const [we, setWe] = useState(weekend == null ? "" : String(weekend));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const opts = (cur: string) => (OPTIONS.some((o) => o.value === cur) ? OPTIONS : [...OPTIONS, { value: cur, label: `${cur}분` }]);
  const changed = wd !== (weekday == null ? "" : String(weekday)) || we !== (weekend == null ? "" : String(weekend));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5">
      {(
        [
          ["평일(월~금)", wd, setWd, "wd"],
          ["주말(토·일)", we, setWe, "we"],
        ] as const
      ).map(([label, value, set, id]) => (
        <label key={id} htmlFor={`limit-${id}`} className="flex items-center justify-between gap-3">
          <span className="text-body font-semibold">{label}</span>
          <span className="relative">
            <select
              id={`limit-${id}`}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="h-12 w-40 appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 text-control outline-none focus:border-accent"
            >
              {opts(value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sub" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </span>
        </label>
      ))}
      <button
        type="button"
        disabled={!changed || pending}
        onClick={() =>
          start(async () => {
            const r = await setWatchLimitsAction(profileId, wd ? Number(wd) : null, we ? Number(we) : null);
            setMsg(r.ok ? "저장했어요. 바로 적용돼요." : r.error);
          })
        }
        className="h-12 rounded-xl bg-accent text-control font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "한도 저장"}
      </button>
      {msg ? <p className="text-caption text-sub">{msg}</p> : null}
    </div>
  );
}

// 오늘 보너스 시간: 오늘 한도에만 더해지고 자정에 끝난다.
export function BonusButtons({ profileId, bonus }: { profileId: string; bonus: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (add: number) =>
    start(async () => {
      const r = await setTodayBonusAction(profileId, add);
      setMsg(r.ok ? "" : r.error);
    });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {[10, 30].map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => run(m)}
            className="h-10 rounded-[10px] border border-accent-line bg-surface px-3.5 text-callout font-semibold text-accent-strong disabled:opacity-50"
          >
            오늘 +{m}분
          </button>
        ))}
        {bonus > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(0)}
            className="h-10 rounded-[10px] border border-line bg-surface px-3.5 text-callout font-semibold text-sub disabled:opacity-50"
          >
            보너스 취소
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-caption text-danger-ink">{msg}</p> : null}
    </div>
  );
}
