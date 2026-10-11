// 화면을 서버에서 그리는 동안 보여주는 공통 로딩 표시(모든 탭·상세 화면 동일). 하단 탭은 레이아웃에 있어 그대로 남는다.
export function PageLoading() {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <span className="size-8 animate-spin rounded-full border-[3px] border-track border-t-accent" aria-hidden />
      <span className="text-caption text-sub">불러오는 중이에요</span>
    </div>
  );
}
