import { ParentTabs } from "@/components/tabs";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentTabsLayout({ children }: LayoutProps<"/parent">) {
  const me = await requireMe("parent");
  const supabase = await createClient();
  const { count } = await supabase
    .from("channel_requests")
    .select("id", { count: "exact", head: true })
    .eq("family_id", me.familyId)
    .eq("status", "pending");

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <ParentTabs inboxBadge={count ?? 0} />
    </div>
  );
}
