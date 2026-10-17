"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addWatchSecondsAction, recordPlayAction } from "@/app/actions";
import { IconClock } from "@/components/icons";
import { Player, type PlayerControl } from "@/components/player";

const FLUSH_EVERY = 30; // 재생 중 30초마다 서버에 더한다
const WARN_UNDER = 5 * 60; // 남은 시간이 5분 이하일 때만 아이에게 보여준다

// 아이 재생 화면: 재생 시작 1회 기록, 재생 중 시청 시간 누적, 하루 한도를 다 쓰면 멈추고 안내로 바꾼다.
// 플레이어 위에 아무것도 덮지 않는다(한도 초과 시 플레이어를 내리고 안내를 보여준다).
export function WatchPlayer({
  videoId,
  autoplay,
  initialUsed,
  initialLimit,
}: {
  videoId: string;
  autoplay: boolean;
  initialUsed: number;
  initialLimit: number | null;
}) {
  const [used, setUsed] = useState(initialUsed); // 서버에 반영된 오늘 사용 초
  const [limit, setLimit] = useState(initialLimit);
  const [pendingShown, setPendingShown] = useState(0); // 아직 보내지 않은 초(남은 시간 표시용)
  const [exhausted, setExhausted] = useState(initialLimit != null && initialUsed >= initialLimit);

  const playing = useRef(false);
  const pending = useRef(0);
  const played = useRef(false);
  const control = useRef<PlayerControl | null>(null);
  const usedRef = useRef(initialUsed);
  const limitRef = useRef(initialLimit);

  const flush = useCallback(async () => {
    const s = pending.current;
    pending.current = 0;
    setPendingShown(0);
    const r = await addWatchSecondsAction(s);
    if (!r.ok) {
      pending.current += s; // 실패하면 다음에 다시 보낸다
      return;
    }
    usedRef.current = r.used;
    limitRef.current = r.limit;
    setUsed(r.used);
    setLimit(r.limit);
    if (r.limit != null && r.used >= r.limit) {
      control.current?.pause();
      setExhausted(true);
    }
  }, []);

  // 화면을 닫거나 다른 앱으로 갈 때는 요청이 끊기지 않도록 sendBeacon으로 보낸다.
  const beacon = useCallback(() => {
    const s = pending.current;
    if (s <= 0) return;
    pending.current = 0;
    usedRef.current += s;
    navigator.sendBeacon?.("/api/watch/beat", new Blob([JSON.stringify({ seconds: s })], { type: "application/json" }));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!playing.current || document.visibilityState !== "visible") return;
      pending.current += 1;
      setPendingShown(pending.current);
      const lim = limitRef.current;
      if (lim != null && usedRef.current + pending.current >= lim) {
        playing.current = false;
        control.current?.pause();
        void flush();
        return;
      }
      if (pending.current >= FLUSH_EVERY) void flush();
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") beacon();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", beacon);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", beacon);
      beacon(); // 다른 화면으로 이동
    };
  }, [flush, beacon]);

  const onState = useCallback(
    (state: number, ctl: PlayerControl) => {
      control.current = ctl;
      if (state === 1) {
        playing.current = true;
        if (!played.current) {
          played.current = true;
          void recordPlayAction(videoId);
        }
      } else if (state === 0 || state === 2) {
        playing.current = false;
        if (pending.current > 0) void flush();
      }
    },
    [videoId, flush],
  );

  if (exhausted) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2.5 bg-track px-6 text-center">
        <span className="text-sub">
          <IconClock size={28} />
        </span>
        <p className="text-subhead font-bold">오늘 볼 수 있는 시간을 다 썼어요</p>
        <p className="text-caption text-sub">내일 다시 볼 수 있어요. 더 보고 싶으면 부모님께 말씀드려요.</p>
        <Link href="/kid" className="mt-1 text-caption font-semibold text-accent-strong">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const remaining = limit == null ? null : Math.max(0, limit - used - pendingShown);
  return (
    <>
      <Player videoId={videoId} autoplay={autoplay} onState={onState} />
      {remaining != null && remaining <= WARN_UNDER ? (
        <p role="status" className="mx-5 mt-3 flex items-center gap-1.5 rounded-xl bg-warn-bg px-3.5 py-2.5 text-caption font-semibold text-warn-ink">
          <IconClock size={14} />
          오늘 {Math.max(1, Math.ceil(remaining / 60))}분 남았어요
        </p>
      ) : null}
    </>
  );
}
