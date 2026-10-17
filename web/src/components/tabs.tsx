"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CountBadge } from "@/components/chrome";
import { IconClock, IconFamily, IconInbox, IconList, IconSearch, IconSettings, IconVideos } from "@/components/icons";

type Tab = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean };

function TabBar({ label, tabs }: { label: string; tabs: Tab[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label={label}
      className="sticky bottom-0 z-10 grid flex-none border-t border-line bg-surface px-2 pb-[max(18px,env(safe-area-inset-bottom))] pt-1.5"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-[3px] py-1.5 text-label ${
              active ? "font-semibold text-accent" : "font-medium text-sub"
            }`}
          >
            {t.icon}
            {t.badge ? <CountBadge count={t.badge} className="absolute left-1/2 top-0.5 ml-2" /> : null}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function KidTabs({ requestBadge = 0 }: { requestBadge?: number }) {
  return (
    <TabBar
      label="아이 메뉴"
      tabs={[
        { href: "/kid", label: "승인 채널 영상", icon: <IconVideos />, exact: true },
        { href: "/kid/search", label: "검색", icon: <IconSearch /> },
        { href: "/kid/requests", label: "내 요청", icon: <IconList />, badge: requestBadge },
      ]}
    />
  );
}

export function ParentTabs({ inboxBadge = 0 }: { inboxBadge?: number }) {
  return (
    <TabBar
      label="부모 메뉴"
      tabs={[
        { href: "/parent", label: "대기함", icon: <IconInbox />, badge: inboxBadge, exact: true },
        { href: "/parent/channels", label: "채널 관리", icon: <IconVideos /> },
        { href: "/parent/watch", label: "시청", icon: <IconClock size={22} /> },
        { href: "/parent/family", label: "가족", icon: <IconFamily /> },
        { href: "/parent/settings", label: "설정", icon: <IconSettings /> },
      ]}
    />
  );
}
