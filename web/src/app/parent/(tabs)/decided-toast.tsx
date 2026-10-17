"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@/components/icons";

// 요청 상세에서 승인·거절 후 대기함으로 돌아오면 결과를 3초 동안 알린다.
export function DecidedToast({ decided, kid, cleanUrl = "/parent" }: { decided: "approved" | "rejected"; kid: string; cleanUrl?: string }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 다시 렌더링하지 않고 주소에서 결과 표시만 지운다(새로고침해도 다시 뜨지 않게).
    window.history.replaceState(null, "", cleanUrl);
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, [cleanUrl]);

  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-[480px] justify-center px-5">
      <p className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-body font-medium text-white shadow-[0_8px_24px_rgba(21,23,26,0.2)]">
        <IconCheck size={18} />
        {decided === "approved" ? `승인했어요. ${kid}의 ‘채널 영상’에 추가됐어요.` : "거절했어요."}
      </p>
    </div>
  );
}
