"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

// 상단(타이틀·검색·탭)은 고정하고 목록만 스크롤하는 영역.
// 창 전체가 아니라 이 영역이 스크롤되므로, 재생 화면에 갔다 돌아왔을 때 위치를 직접 기억해 되돌린다(이 탭 sessionStorage).
// resetKey가 바뀌면(채널·영상/쇼츠 전환 등) 맨 위로 올린다.
export function ScrollArea({ children, className = "", resetKey }: { children: ReactNode; className?: string; resetKey?: string }) {
  const ref = useRef<HTMLElement>(null);
  const path = usePathname();
  const storeKey = `chdam.scroll.${path}${resetKey ? `.${resetKey}` : ""}`;

  // 저장된 위치로 되돌린다. 목록이 늦게 채워질 수 있어(검색 결과 복원 등) 1초 동안 높이가 충분해질 때까지 다시 시도한다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let target = 0;
    try {
      target = Number(sessionStorage.getItem(storeKey) ?? 0);
    } catch {}
    if (!target) {
      el.scrollTop = 0;
      return;
    }
    const until = Date.now() + 1000;
    let frame = 0;
    const tryRestore = () => {
      if (el.scrollHeight - el.clientHeight >= target || Date.now() > until) {
        el.scrollTop = target;
        return;
      }
      frame = requestAnimationFrame(tryRestore);
    };
    tryRestore();
    return () => cancelAnimationFrame(frame);
  }, [storeKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(storeKey, String(Math.round(el.scrollTop)));
        } catch {}
      }, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, [storeKey]);

  return (
    <main ref={ref} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </main>
  );
}
