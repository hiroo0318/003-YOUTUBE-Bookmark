"use client";

import { useTransition } from "react";
import { setChannelStateAction } from "@/app/actions";

export function StateButton({
  profileId,
  channelId,
  label,
  status = "none",
  primary = false,
  confirmText,
}: {
  profileId: string;
  channelId: string;
  label: string;
  status?: "approved" | "rejected" | "none";
  primary?: boolean;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          await setChannelStateAction(profileId, channelId, status);
        });
      }}
      className={`h-9 flex-none rounded-[10px] px-3 text-caption font-semibold disabled:opacity-50 ${
        primary ? "bg-accent text-white" : "border border-line bg-surface text-ink"
      }`}
    >
      {pending ? "…" : label}
    </button>
  );
}
