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
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <KidTabs requestBadge={count ?? 0} />
    </div>
  );
}
