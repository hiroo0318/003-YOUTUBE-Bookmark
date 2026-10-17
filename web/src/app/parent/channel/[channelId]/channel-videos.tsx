"use client";

import { useState } from "react";
import { Player } from "@/components/player";
import { Thumb, VideoRowBody } from "@/components/video";
import { timeAgo } from "@/lib/format";

type V = { videoId: string; title: string; thumbnailUrl: string | null; publishedAt: string | null; durationSeconds: number | null; isShort: boolean };
const PAGE = 60;

// 저장된 영상/쇼츠 목록. 누르면 위쪽 플레이어에서 바로 재생한다(부모 재생은 시청 기록에 넣지 않음).
export function ParentChannelVideos({ videos }: { videos: V[] }) {
  const [kind, setKind] = useState<"video" | "short">("video");
  const [playing, setPlaying] = useState<V | null>(null);
  const [shown, setShown] = useState(PAGE);
  const list = videos.filter((v) => (kind === "short" ? v.isShort : !v.isShort));
  const play = (v: V) => {
    setPlaying(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {playing ? (
        <div className="flex flex-col gap-2">
          <Player key={playing.videoId} videoId={playing.videoId} autoplay />
          <p className="line-clamp-2 px-5 text-body font-semibold">{playing.title}</p>
        </div>
      ) : null}

      <div role="tablist" aria-label="영상 종류" className="mx-5 grid grid-cols-2 rounded-xl bg-track p-1">
        {(
          [
            ["video", "영상"],
            ["short", "쇼츠"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setShown(PAGE);
            }}
            className={`h-9 rounded-[9px] text-body ${kind === k ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="px-5 text-caption text-sub">아이 ‘채널 영상’ 탭에 보이는 것과 같은 목록이에요. 저장된 {list.length}개</p>

      {list.length === 0 ? (
        <p className="px-5 py-10 text-center text-caption text-sub">
          {kind === "short" ? "저장된 쇼츠가 없어요." : "저장된 영상이 없어요. 승인하면 최근 영상을 가져와요."}
        </p>
      ) : kind === "video" ? (
        <div className="flex flex-col gap-3.5 px-5">
          {list.slice(0, shown).map((v) => (
            <button key={v.videoId} type="button" onClick={() => play(v)} className="flex gap-3 text-left text-ink">
              <VideoRowBody thumbnailUrl={v.thumbnailUrl} duration={v.durationSeconds} playable title={v.title} meta={timeAgo(v.publishedAt)} />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-3 px-5">
          {list.slice(0, shown).map((v) => (
            <button key={v.videoId} type="button" onClick={() => play(v)} className="flex min-w-0 flex-col gap-1.5 text-left text-ink">
              <Thumb url={v.thumbnailUrl} duration={v.durationSeconds} className="aspect-[9/16] w-full" />
              <span className="line-clamp-2 text-meta font-semibold leading-[1.35]">{v.title}</span>
            </button>
          ))}
        </div>
      )}
      {shown < list.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mx-5 h-12 rounded-xl border border-line bg-surface text-control font-semibold text-ink"
        >
          더 보기 ({list.length - shown}개 남음)
        </button>
      ) : null}
    </>
  );
}
