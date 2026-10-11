"use client";

import { useEffect, useRef, useState } from "react";
import { IconHeart } from "@/components/icons";
import { ChannelAvatar } from "@/components/video";
import type { ChannelLite } from "@/lib/data";

// 승인 채널 로고 가로 줄. 맨 앞 '좋아요'는 좋아요한 영상만, 채널은 그 채널만 보여주고 다시 누르면 해제(전체).
// 끝의 '전체 보기'는 모든 채널을 격자로 연다.
export function ChannelRail({
  channels,
  selected,
  onToggle,
}: {
  channels: ChannelLite[];
  selected: string;
  onToggle: (channelId: string) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const anySelected = selected !== "all";

  // 전체 보기에서 고른 채널이 줄 밖에 있으면 보이도록 스크롤한다(순서는 바꾸지 않는다).
  useEffect(() => {
    if (!anySelected) return;
    railRef.current?.querySelector(`[data-ch="${selected}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected, anySelected]);

  return (
    <>
      <div ref={railRef} className="no-scrollbar flex flex-none items-start gap-1 overflow-x-auto px-4 pb-1 pt-3">
        <button
          type="button"
          aria-pressed={selected === "liked"}
          data-ch="liked"
          onClick={() => onToggle("liked")}
          className={`flex w-[64px] flex-none flex-col items-center gap-1.5 pt-0.5 transition-opacity ${anySelected && selected !== "liked" ? "opacity-45" : ""}`}
        >
          <span className={`rounded-full p-[2px] ${selected === "liked" ? "ring-2 ring-like" : ""}`}>
            {/* 채널 썸네일과 같은 48px 꽉 찬 원 */}
            <span className="flex size-12 items-center justify-center rounded-full bg-like text-white">
              <IconHeart size={24} filled />
            </span>
          </span>
          <span className={`text-label ${selected === "liked" ? "font-bold text-ink" : "text-sub"}`}>좋아요</span>
        </button>
        {channels.map((c) => (
          <ChannelButton key={c.channelId} channel={c} on={selected === c.channelId} dim={anySelected && selected !== c.channelId} onClick={() => onToggle(c.channelId)} />
        ))}
        {channels.length > 5 ? (
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="flex w-[64px] flex-none flex-col items-center gap-1.5 pt-0.5"
          >
            <span className="flex size-[52px] items-center justify-center rounded-full border border-line bg-surface text-accent-strong">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="4" y="4" width="6" height="6" rx="1.5" />
                <rect x="14" y="4" width="6" height="6" rx="1.5" />
                <rect x="4" y="14" width="6" height="6" rx="1.5" />
                <rect x="14" y="14" width="6" height="6" rx="1.5" />
              </svg>
            </span>
            <span className="text-label font-semibold text-accent-strong">전체 보기</span>
          </button>
        ) : null}
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-[480px] flex-col justify-end">
          <button type="button" aria-label="닫기" onClick={() => setSheet(false)} className="absolute inset-0 bg-[rgba(21,23,26,0.45)]" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="allCh"
            className="relative flex max-h-[75dvh] flex-col gap-3 rounded-t-[20px] bg-surface px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5"
          >
            <div className="h-1 w-10 flex-none self-center rounded-full bg-[#d5d9e0]" />
            <div className="flex flex-none items-center justify-between px-1">
              <h2 id="allCh" className="text-subhead font-bold">
                승인 채널 {channels.length}개
              </h2>
              <button type="button" onClick={() => setSheet(false)} className="h-9 px-2 text-body font-semibold text-sub">
                닫기
              </button>
            </div>
            <div className="grid min-h-0 grid-cols-4 gap-x-1 gap-y-3 overflow-y-auto pb-2">
              {channels.map((c) => (
                <ChannelButton
                  key={c.channelId}
                  channel={c}
                  on={selected === c.channelId}
                  dim={false}
                  onClick={() => {
                    onToggle(c.channelId);
                    setSheet(false);
                  }}
                  fill
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ChannelButton({
  channel,
  on,
  dim,
  onClick,
  fill = false,
}: {
  channel: ChannelLite;
  on: boolean;
  dim: boolean;
  onClick: () => void;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-ch={channel.channelId}
      onClick={onClick}
      className={`flex flex-none flex-col items-center gap-1.5 pt-0.5 transition-opacity ${fill ? "w-full" : "w-[64px]"} ${dim ? "opacity-45" : ""}`}
    >
      <span className={`rounded-full p-[2px] ${on ? "ring-2 ring-accent" : ""}`}>
        <ChannelAvatar title={channel.title} url={channel.thumbnailUrl} size={48} />
      </span>
      <span className={`line-clamp-1 w-full break-all text-center text-label ${on ? "font-bold text-ink" : "text-sub"}`}>{channel.title}</span>
    </button>
  );
}
