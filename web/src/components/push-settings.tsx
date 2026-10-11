"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "@/app/actions";
import { IconBell } from "@/components/icons";

type State = "checking" | "unsupported" | "ios-install" | "not-ready" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

// 로그아웃할 때 이 기기의 알림 구독을 지운다(같은 기기를 다른 가족이 쓸 때 알림이 섞이지 않게).
export async function unsubscribeThisDevice() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager?.getSubscription();
  if (!sub) return;
  await removePushSubscriptionAction(sub.endpoint);
  await sub.unsubscribe();
}

const COPY = {
  parent: { title: "요청 알림", desc: "아이가 채널 추가를 요청하면 알려 드려요." },
  child: { title: "결과 알림", desc: "부모님이 요청을 승인하거나 거절하면 알려줘요." },
};

// 이 기기에서 웹 푸시를 켜고 끈다. 부모는 설정(PAR-05), 아이는 내 요청(KID-05)에 둔다.
export function PushSettings({ role }: { role: "parent" | "child" }) {
  const [state, setState] = useState<State>("checking");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      if (!VAPID_PUBLIC_KEY) return setState("not-ready");
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (Notification.permission === "denied") return setState("denied");
        if (sub) {
          // 서버 기록이 지워졌을 수 있어 다시 저장한다(이미 있으면 그대로).
          await savePushSubscriptionAction(sub.toJSON() as never, navigator.userAgent);
          return setState("on");
        }
        setState("off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  const enable = () =>
    start(async () => {
      setNote("");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
        const r = await savePushSubscriptionAction(sub.toJSON() as never, navigator.userAgent);
        if (!r.ok) return setNote("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
        setState("on");
      } catch {
        setNote("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });

  const disable = () =>
    start(async () => {
      setNote("");
      await unsubscribeThisDevice().catch(() => undefined);
      setState("off");
    });

  const test = () =>
    start(async () => {
      const r = await testPushAction();
      setNote(r.ok ? "테스트 알림을 보냈어요. 잠시 뒤 도착해요." : "보내지 못했어요. 알림을 껐다가 다시 켜 주세요.");
    });

  const copy = COPY[role];
  const guide: Partial<Record<State, string>> = {
    "ios-install": "iPhone·iPad는 Safari 아래쪽 공유 버튼 → '홈 화면에 추가'를 한 뒤, 홈 화면의 채널담에서 알림을 켤 수 있어요(iOS 16.4 이상).",
    unsupported: "이 브라우저에서는 알림을 받을 수 없어요.",
    "not-ready": "알림 설정이 아직 준비되지 않았어요.",
    denied: "이 기기에서 채널담 알림이 차단돼 있어요. 기기나 브라우저 설정에서 알림을 허용해 주세요.",
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 flex-none items-center justify-center rounded-full ${state === "on" ? "bg-accent-soft text-accent-strong" : "bg-track text-sub"}`}>
          <IconBell size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">
            {copy.title}
            {state === "on" ? <span className="ml-1.5 text-label font-semibold text-accent-strong">켜짐</span> : null}
          </span>
          <span className="text-caption text-sub">{guide[state] ?? copy.desc}</span>
        </div>
        {state === "off" ? (
          <button type="button" disabled={pending} onClick={enable} className="h-10 flex-none rounded-[10px] bg-accent px-3.5 text-callout font-semibold text-white disabled:opacity-60">
            {pending ? "켜는 중…" : "알림 켜기"}
          </button>
        ) : null}
        {state === "on" ? (
          <button type="button" disabled={pending} onClick={disable} className="h-10 flex-none rounded-[10px] border border-line px-3.5 text-callout font-semibold disabled:opacity-60">
            끄기
          </button>
        ) : null}
      </div>
      {state === "on" ? (
        <button type="button" disabled={pending} onClick={test} className="self-start text-caption font-semibold text-accent-strong disabled:opacity-60">
          테스트 알림 보내기
        </button>
      ) : null}
      {note ? <p className="text-caption text-sub">{note}</p> : null}
    </div>
  );
}
