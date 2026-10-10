"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleLoginButton() {
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true);
    const supabase = createClient();
    // Site URL은 같은 프로젝트의 다른 앱과 공유하므로 돌아올 주소를 직접 지정한다.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) setBusy(false);
  }
  return (
    <button
      type="button"
      onClick={login}
      disabled={busy}
      className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#d5d9e0] bg-surface text-control font-semibold text-ink disabled:opacity-60"
    >
      <span aria-hidden className="flex size-[22px] items-center justify-center rounded-full border border-[#d5d9e0] text-label font-bold text-sub">
        G
      </span>
      {busy ? "Google로 이동 중…" : "Google 계정으로 계속하기"}
    </button>
  );
}
