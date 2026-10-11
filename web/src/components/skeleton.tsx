import { BrandMark } from "@/components/icons";

// 화면을 서버에서 그리는 동안 바로 보여주는 뼈대(탭 이동·상세 진입 시). 하단 탭은 레이아웃에 있어 그대로 남는다.
const Bar = ({ className }: { className: string }) => <div className={`animate-pulse rounded-md bg-track ${className}`} />;

export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" }) {
  return (
    <div role="status" aria-label="불러오는 중" className="flex flex-1 flex-col">
      {variant === "list" ? (
        <header className="flex items-center justify-between px-5 pb-2 pt-5">
          <div className="flex items-center gap-2">
            <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent">
              <BrandMark />
            </span>
            <span className="text-heading font-bold tracking-[-0.3px]">채널담</span>
          </div>
          <Bar className="size-9 rounded-full" />
        </header>
      ) : (
        <div className="flex items-center gap-2 px-4 py-4">
          <Bar className="h-5 w-24" />
        </div>
      )}

      {variant === "detail" ? <Bar className="aspect-video w-full rounded-none" /> : <Bar className="mx-5 mt-3 h-12 rounded-xl" />}

      <div className="flex flex-col gap-3.5 px-5 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Bar className="h-[79px] w-[140px] flex-none rounded-[10px]" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Bar className="h-3.5 w-full" />
              <Bar className="h-3.5 w-2/3" />
              <Bar className="mt-auto h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
