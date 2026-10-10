"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutForm } from "@/components/sign-out";

// 타이틀바 오른쪽 프로필: 누르면 계정 정보와 로그아웃 메뉴가 열린다.
export function ProfileMenu({ name, email, variant }: { name: string; email: string; variant: "child" | "parent" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${name} 계정 메뉴`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`flex size-9 items-center justify-center rounded-full text-callout font-semibold ${
          variant === "parent" ? "bg-ink text-white" : "bg-accent-soft text-accent-strong"
        }`}
      >
        {name.trim()[0] ?? "?"}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-60 rounded-2xl border border-line bg-surface p-2 shadow-[0_8px_24px_rgba(21,23,26,0.12)]"
        >
          <div className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-1.5">
            <span className="text-body font-semibold">
              {name} · {variant === "parent" ? "부모" : "아이"}
            </span>
            <span className="truncate text-meta text-sub">{email}</span>
          </div>
          <SignOutForm className="border-t border-line-soft pt-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex h-11 w-full items-center rounded-xl px-2.5 text-left text-control font-semibold text-danger-ink hover:bg-bg"
            >
              로그아웃
            </button>
          </SignOutForm>
        </div>
      ) : null}
    </div>
  );
}
