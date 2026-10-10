"use client";

import type { ReactNode } from "react";

// 로그아웃하면 이 탭에 보관한 검색 결과(chdam.search.*)를 지운다. 다시 로그인하면 빈 검색 화면에서 시작한다.
export function clearSearchCache() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("chdam.search.")) sessionStorage.removeItem(key);
    }
  } catch {}
}

export function SignOutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form action="/auth/signout" method="post" onSubmit={clearSearchCache} className={className}>
      {children}
    </form>
  );
}
