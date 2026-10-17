"use client";

import { useEffect, useRef, useState } from "react";

type YTPlayer = { destroy(): void; pauseVideo(): void };
// 재생 상태: -1 시작 전, 0 끝남, 1 재생 중, 2 일시정지, 3 버퍼링, 5 준비됨
export type PlayerControl = { pause(): void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: { onError?: (e: { data: number }) => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

// YouTube 기본 플레이어를 그대로 쓴다: 위에 아무것도 덮지 않고, rel=0으로 종료 후 같은 채널 영상만 추천.
// onState: 재생 상태가 바뀔 때마다 알린다(시청 시간 기록용). 바뀌어도 플레이어를 다시 만들지 않도록 ref로 둔다.
export function Player({
  videoId,
  autoplay = false,
  rounded = false,
  onState,
}: {
  videoId: string;
  autoplay?: boolean;
  rounded?: boolean;
  onState?: (state: number, control: PlayerControl) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current?.appendChild(mount);
    loadApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, playsinline: 1, autoplay: autoplay ? 1 : 0 },
        events: {
          onError: () => setFailed(true),
          onStateChange: (e) => onStateRef.current?.(e.data, { pause: () => player?.pauseVideo() }),
        },
      });
    });
    return () => {
      cancelled = true;
      player?.destroy();
      mount.remove();
    };
  }, [videoId, autoplay]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={hostRef}
        className={`aspect-video w-full overflow-hidden bg-player [&_iframe]:size-full ${rounded ? "rounded-xl" : ""}`}
      />
      {failed ? (
        <p role="status" className="mx-5 rounded-xl bg-danger-bg px-3.5 py-3 text-body text-danger-ink">
          이 영상은 여기서 재생할 수 없어요. 목록으로 돌아가 다른 영상을 골라 주세요.
        </p>
      ) : null}
    </div>
  );
}
