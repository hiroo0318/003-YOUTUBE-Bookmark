import { SEARCH_DAILY_LIMIT } from "@/lib/format";

// 오늘 남은 YouTube 검색 횟수(가족 공유). 10회 이하면 주의 색으로 보여준다.
export function SearchQuota({ remaining, className = "" }: { remaining: number; className?: string }) {
  return (
    <p className={`text-label ${remaining <= 10 ? "font-semibold text-warn-ink" : "text-sub"} ${className}`}>
      오늘 남은 검색 {remaining}/{SEARCH_DAILY_LIMIT}회 · 가족 함께 써요
    </p>
  );
}
