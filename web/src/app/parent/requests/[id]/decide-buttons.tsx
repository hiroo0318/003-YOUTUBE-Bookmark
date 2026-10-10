"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideRequestAction } from "@/app/actions";

// 승인·거절하면 바로 대기함으로 돌아가 결과를 짧게 알린다(별도 "대기함으로" 버튼 없음).
export function DecideButtons({ requestId, kid, status }: { requestId: string; kid: string; status: "pending" | "approved" | "rejected" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function decide(decision: "approved" | "rejected") {
    start(async () => {
      const r = await decideRequestAction(requestId, decision);
      if (!r.ok) return setError(r.error);
      router.replace(`/parent?decided=${decision}&kid=${encodeURIComponent(kid)}`);
    });
  }

  if (status !== "pending") {
    return (
      <div className="sticky bottom-0 border-t border-line bg-surface px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3">
        <p className="rounded-xl bg-muted-bg px-3.5 py-3 text-body text-ink-2">이미 {status === "approved" ? "승인" : "거절"}한 요청이에요.</p>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3">
      {confirming ? (
        <p role="alert" className="rounded-xl bg-warn-bg px-3.5 py-3 text-body text-warn-ink">
          거절하면 {kid}은(는) 이 채널을 다시 요청할 수 없어요. 나중에 채널 관리의 거절 목록에서 풀어 줄 수 있어요.
        </p>
      ) : (
        <p className="rounded-xl bg-info-bg px-3.5 py-3 text-body text-info-ink">
          승인하면 이 채널에 <b>앞으로 올라올 영상도</b> {kid}이(가) 볼 수 있어요. 채널 관리에서 언제든 승인을 취소할 수 있어요.
        </p>
      )}
      {error ? <p className="text-caption text-danger-ink">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {confirming ? (
          <>
            <button type="button" onClick={() => setConfirming(false)} className="h-12 rounded-xl border border-line bg-surface text-control font-semibold">
              돌아가기
            </button>
            <button type="button" disabled={pending} onClick={() => decide("rejected")} className="h-12 rounded-xl bg-ink text-control font-semibold text-white disabled:opacity-60">
              {pending ? "처리 중…" : "거절하기"}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirming(true)} className="h-12 rounded-xl border border-line bg-surface text-control font-semibold">
              거절
            </button>
            <button type="button" disabled={pending} onClick={() => decide("approved")} className="h-12 rounded-xl bg-accent text-control font-semibold text-white disabled:opacity-60">
              {pending ? "처리 중…" : "승인"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
