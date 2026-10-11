import Link from "next/link";
import { BrandMark, IconBack, IconInfo } from "@/components/icons";
import { ProfileMenu } from "@/components/profile-menu";

// 1뎁스 타이틀바: 로고 + 채널담 + 프로필
export function BrandHeader({ name, email, variant = "child" }: { name: string; email: string; variant?: "child" | "parent" }) {
  return (
    <header className="flex flex-none items-center justify-between px-5 pb-2 pt-5">
      <div className="flex items-center gap-2">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent">
          <BrandMark />
        </span>
        <h1 className="text-heading font-bold tracking-[-0.3px]">채널담</h1>
      </div>
      <ProfileMenu name={name} email={email} variant={variant} />
    </header>
  );
}

// 2뎁스 이상 타이틀바: 뒤로 + 이전 메뉴명
export function BackHeader({ href, label }: { href: string; label: string }) {
  return (
    <header className="flex flex-none items-center gap-1 px-2 py-2.5">
      <Link href={href} aria-label="뒤로" className="flex size-11 items-center justify-center rounded-xl text-ink">
        <IconBack />
      </Link>
      <span className="text-body font-semibold">{label}</span>
    </header>
  );
}

// 탭별 한 줄 안내. 재생 제한이 YouTube가 아닌 가족 설정이라는 설명(정책 III.C.7)은 요청 시트에서 한다.
const BANNER_COPY = {
  feed: { on: "부모님이 승인한 채널의 영상만 모아 보여줘요.", off: "부모님이 승인한 채널의 영상만 모아 보여줘요." },
  search: { on: "보고 싶은 영상을 검색하고 부모님께 요청해요.", off: "지금은 부모님 설정으로 검색한 영상을 바로 볼 수 있어요." },
} as const;

export function ModeBanner({ approvalMode, tab }: { approvalMode: boolean; tab: "feed" | "search" }) {
  return (
    <p className="mx-5 mt-0.5 flex flex-none items-center gap-1 text-label leading-[1.4] text-sub">
      <IconInfo size={13} />
      <span>{BANNER_COPY[tab][approvalMode ? "on" : "off"]}</span>
    </p>
  );
}

export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[11px] font-bold text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
