export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  if (day < 365) return `${Math.floor(day / 30)}달 전`;
  return `${Math.floor(day / 365)}년 전`;
}

// 서버(Node)와 브라우저의 Intl 결과가 달라 하이드레이션 오류가 나므로 한국 시간을 직접 계산해 같은 문자열을 만든다.
export function clockTime(iso: string | null | undefined) {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const h = kst.getUTCHours();
  const m = String(kst.getUTCMinutes()).padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${String(h12).padStart(2, "0")}:${m}`;
}

export const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
