import type { ReactNode } from "react";
import { IconPlayFill } from "@/components/icons";
import { formatDuration } from "@/lib/format";

// 재생 표시(▶)는 누르면 반드시 재생되는 카드에만 쓴다(정책 표시 규칙).
export function Thumb({
  url,
  duration,
  playable,
  className = "w-[140px] h-[79px]",
}: {
  url: string | null;
  duration?: number | null;
  playable?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-none items-center justify-center overflow-hidden rounded-[10px] bg-track ${className}`}>
      {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : null}
      {playable ? (
        <span className="relative flex size-[34px] items-center justify-center rounded-full bg-[rgba(21,23,26,0.72)] text-white">
          <IconPlayFill />
        </span>
      ) : null}
      {duration ? (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-[rgba(21,23,26,0.8)] px-[5px] py-px text-label font-semibold text-white">
          {formatDuration(duration)}
        </span>
      ) : null}
    </div>
  );
}

// 목록 카드 본문: 오른쪽 영역 높이를 썸네일(79px)에 맞춘다. 제목은 위, 채널명·상태는 아래 한 줄.
export function VideoRowBody({
  thumbnailUrl,
  duration,
  playable,
  title,
  meta,
  tag,
  dimTitle = false,
}: {
  thumbnailUrl: string | null;
  duration?: number | null;
  playable?: boolean;
  title: string;
  meta: string;
  tag?: ReactNode;
  dimTitle?: boolean;
}) {
  return (
    <>
      <Thumb url={thumbnailUrl} duration={duration} playable={playable} />
      <div className="flex h-[79px] min-w-0 flex-1 flex-col justify-between">
        <span className={`line-clamp-2 text-caption font-semibold leading-[1.35] ${dimTitle ? "text-sub" : ""}`}>{title}</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-meta text-sub">{meta}</span>
          {tag}
        </div>
      </div>
    </>
  );
}

export function RowTag({ tone, children }: { tone: "accent" | "warn" | "muted" | "outline"; children: ReactNode }) {
  const tones = {
    accent: "bg-accent-soft text-accent-strong",
    warn: "bg-warn-bg text-warn-ink",
    muted: "bg-muted-bg text-muted-ink",
    outline: "border border-accent-line bg-surface text-accent-strong",
  };
  return (
    <span className={`inline-flex h-6 flex-none items-center gap-0.5 rounded-full px-2 text-label font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ChannelAvatar({ title, url, size = 40 }: { title: string; url?: string | null; size?: number }) {
  return (
    <span
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-accent-soft font-bold text-accent-strong"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" /> : title.trim()[0]}
    </span>
  );
}
