import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getProfiles(familyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_profiles")
    .select("id, display_name, approval_mode, member_id, created_at")
    .eq("family_id", familyId)
    .order("created_at");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.display_name as string, approvalMode: p.approval_mode as boolean }));
}
