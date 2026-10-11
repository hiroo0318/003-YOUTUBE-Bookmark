"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";
import { IconHeart } from "@/components/icons";

// 좋아요 하트. 카드 링크 밖에 두어(링크 안에 버튼을 넣지 않음) 누르면 재생 화면으로 넘어가지 않는다.
export function LikeToggle({
  liked,
  onToggle,
  variant = "row",
  disabled = false,
}: {
  liked: boolean;
  onToggle: () => void;
  variant?: "row" | "overlay";
  disabled?: boolean;
}) {
  const look =
    variant === "overlay"
      ? `size-8 rounded-full bg-[rgba(21,23,26,0.55)] ${liked ? "text-like" : "text-white"}`
      : `size-9 rounded-full ${liked ? "text-like" : "text-sub"}`;
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      disabled={disabled}
      onClick={onToggle}
      className={`flex flex-none items-center justify-center disabled:opacity-60 ${look}`}
    >
      <IconHeart size={variant === "overlay" ? 18 : 20} filled={liked} />
    </button>
  );
}

// 재생 화면용: 상태를 스스로 갖고 먼저 바꾼 뒤 저장한다(실패하면 되돌림).
export function WatchLikeButton({ videoId, initial }: { videoId: string; initial: boolean }) {
  const [liked, setLiked] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={liked}
        disabled={pending}
        onClick={() => {
          const next = !liked;
          setLiked(next);
          setError("");
          start(async () => {
            const r = await toggleLikeAction(videoId, next);
            if (!r.ok) {
              setLiked(!next);
              setError(r.error);
            }
          });
        }}
        className={`flex h-9 items-center gap-1 rounded-full border px-3 text-body font-semibold ${
          liked ? "border-like bg-like-soft text-like" : "border-line bg-surface text-ink"
        }`}
      >
        <IconHeart size={18} filled={liked} />
        좋아요
      </button>
      {error ? <p className="text-label text-danger-ink">{error}</p> : null}
    </div>
  );
}
