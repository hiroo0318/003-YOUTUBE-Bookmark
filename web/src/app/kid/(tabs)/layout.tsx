import { KidTabs } from "@/components/tabs";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function KidLayout({ children }: LayoutProps<"/kid">) {
  const me = await requireMe("child");
  const supabase = await createClient();
  const { count } = await supabase
    .from("channel_requests")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", me.profileId!)
    .eq("seen_by_child", false);

  return (
    // 화면 높이에 고정: 상단(타이틀·검색·탭)과 하단 탭은 그대로 두고, 각 화면의 목록 영역(ScrollArea)만 스크롤한다.
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <KidTabs requestBadge={count ?? 0} />
    </div>
  );
}
