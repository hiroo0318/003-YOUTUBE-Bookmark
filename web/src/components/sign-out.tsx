"use client";

import type { FormEvent, ReactNode } from "react";
import { unsubscribeThisDevice } from "@/components/push-settings";

// 로그아웃하면 이 탭에 보관한 검색 결과(chdam.search.*)를 지운다. 다시 로그인하면 빈 검색 화면에서 시작한다.
export function clearSearchCache() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("chdam.search.")) sessionStorage.removeItem(key);
    }
  } catch {}
}

// 로그아웃 전에 이 기기의 알림 구독도 지운다(같은 기기를 다른 가족이 쓸 때 알림이 섞이지 않게). 최대 3초만 기다린다.
async function beforeSignOut(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const form = e.currentTarget;
  clearSearchCache();
  await Promise.race([unsubscribeThisDevice().catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
  form.submit();
}

export function SignOutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form action="/auth/signout" method="post" onSubmit={beforeSignOut} className={className}>
      {children}
    </form>
  );
}
