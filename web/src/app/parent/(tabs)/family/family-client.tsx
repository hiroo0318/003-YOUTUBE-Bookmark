"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addMemberAction, removeMemberAction } from "@/app/actions";

export function AddMemberForm() {
  const [role, setRole] = useState<"child" | "parent">("child");
  const [state, action, pending] = useActionState(addMemberAction, { ok: false, error: "" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-2 flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-subhead font-bold">구성원 등록</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="em" className="text-caption font-semibold">
          Google 이메일
        </label>
        <input
          id="em"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@gmail.com"
          className="h-12 rounded-xl border border-line bg-surface px-3.5 text-control outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nm" className="text-caption font-semibold">
          표시 이름
        </label>
        <input
          id="nm"
          name="displayName"
          type="text"
          required
          placeholder="예: 지민"
          className="h-12 rounded-xl border border-line bg-surface px-3.5 text-control outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="rl" className="text-caption font-semibold">
          권한
        </span>
        <input type="hidden" name="role" value={role} />
        <div role="radiogroup" aria-labelledby="rl" className="grid grid-cols-2 rounded-xl bg-track p-1">
          {(["child", "parent"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={`h-10 rounded-[9px] text-callout ${
                role === r ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"
              }`}
            >
              {r === "child" ? "아이" : "부모"}
            </button>
          ))}
        </div>
        <span className="text-caption leading-normal text-sub">
          {role === "child"
            ? "아이 프로필이 함께 만들어지고, 승인 모드가 켜진 상태로 시작해요."
            : "부모는 요청 승인, 채널 관리, 가족 관리, 설정을 모두 할 수 있어요."}
        </span>
      </div>
      {state.error ? <p className="text-caption text-danger-ink">{state.error}</p> : null}
      {state.ok ? <p className="text-caption text-ok-ink">등록했어요.</p> : null}
      <button type="submit" disabled={pending} className="h-12 rounded-xl bg-accent text-control font-semibold text-white disabled:opacity-60">
        {pending ? "등록 중…" : "등록하기"}
      </button>
      <p className="text-caption leading-normal text-sub">등록한 이메일로 Google 로그인하면 자동으로 가족에 연결돼요.</p>
    </form>
  );
}

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <button
      type="button"
      disabled={pending}
      title={error || undefined}
      onClick={() => {
        if (!window.confirm(`${name}을(를) 가족에서 삭제할까요? 아이라면 승인 채널과 요청 기록도 함께 지워져요.`)) return;
        start(async () => {
          const r = await removeMemberAction(memberId);
          if (!r.ok) {
            setError(r.error);
            window.alert(r.error);
          }
        });
      }}
      className="h-9 flex-none rounded-[10px] border border-line px-2.5 text-caption font-semibold text-sub disabled:opacity-50"
    >
      삭제
    </button>
  );
}
