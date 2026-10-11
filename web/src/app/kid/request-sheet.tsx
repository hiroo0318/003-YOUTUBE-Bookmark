"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestChannelAction, type SearchResultItem } from "@/app/actions";
import { IconClock, IconPlus } from "@/components/icons";
import { ChannelAvatar, RowTag, Thumb, VideoRowBody } from "@/components/video";

// 검색 결과·채널 화면 공통 영상 카드. 승인 채널(또는 승인 모드 꺼짐)은 재생, 미승인은 요청 시트, 대기·거절은 상태만 보여준다.
export function VideoResultRow({
  item: r,
  approvalMode,
  from,
  onRequest,
}: {
  item: SearchResultItem;
  approvalMode: boolean;
  from: "search" | "channel";
  onRequest: () => void;
}) {
  const playable = !approvalMode || r.status === "approved";
  if (playable) {
    return (
      <Link href={`/kid/watch/${r.videoId}?from=${from}`} className="flex gap-3 text-ink">
        <VideoRowBody
          thumbnailUrl={r.thumbnailUrl}
          duration={r.durationSeconds}
          playable
          title={r.title}
          meta={r.channelTitle}
          tag={approvalMode ? <RowTag tone="accent">승인 채널</RowTag> : null}
        />
      </Link>
    );
  }
  // 미승인 카드는 재생 표시 없이, 카드 전체를 누르면 채널 추가 요청 시트가 열린다.
  if (r.status === "none") {
    return (
      <button type="button" onClick={onRequest} className="flex gap-3 text-left text-ink">
        <VideoRowBody
          thumbnailUrl={r.thumbnailUrl}
          duration={r.durationSeconds}
          title={r.title}
          meta={r.channelTitle}
          tag={
            <RowTag tone="outline">
              <IconPlus size={12} />
              요청
            </RowTag>
          }
        />
      </button>
    );
  }
  return (
    <div className="flex gap-3">
      <VideoRowBody
        thumbnailUrl={r.thumbnailUrl}
        duration={r.durationSeconds}
        title={r.title}
        meta={r.channelTitle}
        dimTitle={r.status === "rejected"}
        tag={
          r.status === "pending" ? (
            <RowTag tone="warn">
              <IconClock size={11} />
              확인 중
            </RowTag>
          ) : (
            <RowTag tone="muted">거절됨</RowTag>
          )
        }
      />
    </div>
  );
}

export function RequestSheet({ item, onClose, onSent }: { item: SearchResultItem; onClose: () => void; onSent: () => void }) {
  const [state, setState] = useState<"ask" | "sent" | "error">("ask");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const r = await requestChannelAction(item.channelId, item.videoId);
      if (!r.ok) {
        setMessage(r.error);
        setState("error");
        return;
      }
      if (r.result === "rejected") {
        setMessage("부모님이 거절한 채널이라 다시 요청할 수 없어요.");
        setState("error");
        return;
      }
      onSent();
      setState("sent");
    });
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-[480px] flex-col justify-end">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-[rgba(21,23,26,0.45)]" />
      <section role="dialog" aria-modal="true" aria-labelledby="sheetTitle" className="relative flex flex-col gap-[18px] rounded-t-[20px] bg-surface px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-2.5">
        <div className="h-1 w-10 self-center rounded-full bg-[#d5d9e0]" />
        {state === "sent" ? (
          <div className="flex flex-col items-center gap-3.5 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-warn-bg text-warn-ink">
              <IconClock size={26} />
            </span>
            <h2 id="sheetTitle" className="text-heading font-bold">
              요청을 보냈어요
            </h2>
            <p className="text-body text-ink-2">
              부모님이 승인하면 ‘채널 영상’ 탭에서
              <br />
              이 채널 영상을 볼 수 있어요. 결과는 ‘내 요청’에서 확인해요.
            </p>
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-ink text-control font-semibold text-white">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ChannelAvatar title={item.channelTitle} size={52} />
              <div className="flex flex-col gap-0.5">
                <h2 id="sheetTitle" className="text-heading font-bold">
                  {item.channelTitle}
                </h2>
                <span className="text-caption text-sub">아직 승인 전이라 볼 수 없어요. YouTube가 아닌 우리 가족 설정이에요.</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption font-medium text-sub">요청하는 계기가 된 영상</span>
              <div className="flex items-center gap-2.5 rounded-xl bg-bg p-2.5">
                <Thumb url={item.thumbnailUrl} className="h-[54px] w-24" />
                <span className="line-clamp-2 text-callout font-semibold leading-[1.4]">{item.title}</span>
              </div>
            </div>
            {state === "error" ? (
              <p role="alert" className="rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">
                {message}
              </p>
            ) : (
              <p className="text-body text-ink-2">
                부모님께 이 채널을 추가해 달라고 요청할까요? 승인되면 이 채널의 영상을 모두 볼 수 있어요.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} className="h-12 rounded-xl border border-line bg-surface text-control font-semibold text-ink">
                취소
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending || state === "error"}
                className="h-12 rounded-xl bg-accent text-control font-semibold text-white disabled:opacity-60"
              >
                {pending ? "보내는 중…" : "요청하기"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
