"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { IconRefresh } from "@/components/icons";

const POLL_MS = 30_000;
const MIN_GAP_MS = 3_000; // 같은 계기가 겹쳐도 3초 안에는 한 번만
const MIN_HIDDEN_MS = 2_000; // 2초 넘게 가려졌다가 돌아올 때만(잠깐 가려진 것은 무시)

// 열려 있는 화면의 서버 데이터를 다시 받는다(화면 상태·스크롤은 유지). DB만 조회하고 YouTube API는 부르지 않는다.
// - 알림을 받으면(서비스 워커 메시지) 바로
// - 다른 앱에서 돌아와 화면이 다시 보이면
// - pollPaths 화면이 보이는 동안 30초마다
export function AutoRefresh({ pollPaths }: { pollPaths: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const last = useRef(0);
  const hiddenAt = useRef(0);
  const poll = pollPaths.includes(path);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current < MIN_GAP_MS) return;
      last.current = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      if (hiddenAt.current && Date.now() - hiddenAt.current >= MIN_HIDDEN_MS) refresh();
      hiddenAt.current = 0;
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "push") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    navigator.serviceWorker?.startMessages?.(); // addEventListener만으로는 메시지 전달이 시작되지 않는 브라우저 대비
    const timer = poll ? setInterval(refresh, POLL_MS) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [router, poll]);

  return null;
}

// 제목 옆 작은 새로고침 버튼(바로 확인하고 싶을 때).
export function RefreshButton({ label = "새로고침" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => start(() => router.refresh())}
      className="flex size-9 flex-none items-center justify-center rounded-full text-sub disabled:opacity-60"
    >
      <IconRefresh className={pending ? "animate-spin" : ""} />
    </button>
  );
}
