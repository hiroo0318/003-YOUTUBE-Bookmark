"use client";

import { useState, useTransition } from "react";
import { setApprovalModeAction } from "@/app/actions";

export function ModeSwitch({ profileId, name, initial }: { profileId: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    if (!next && !window.confirm(`${name}의 승인 모드를 끌까요? 검색한 영상을 승인 없이 바로 볼 수 있게 돼요.`)) return;
    setOn(next);
    start(async () => {
      const r = await setApprovalModeAction(profileId, next);
      if (!r.ok) setOn(!next);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-line-soft p-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">{name}</span>
          <span className="text-caption text-sub">{on ? "켜짐 · 승인한 채널만 재생" : "꺼짐 · 검색한 영상 바로 재생"}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${name} 승인 모드`}
          disabled={pending}
          onClick={toggle}
          className={`flex h-8 w-[52px] flex-none rounded-full p-[3px] transition-colors ${on ? "justify-end bg-accent" : "justify-start bg-[#c9ced6]"}`}
        >
          <span className="size-[26px] rounded-full bg-white" />
        </button>
      </div>
      {!on ? (
        <span className="text-caption leading-normal text-warn-ink">검색한 영상을 승인 없이 바로 볼 수 있어요. 다시 켜면 기존 승인·거절 목록을 그대로 써요.</span>
      ) : null}
    </div>
  );
}
