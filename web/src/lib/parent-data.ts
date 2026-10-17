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

export type StateAction = "approved" | "rejected" | "approval_cancelled" | "rejection_cleared";
export const STATE_ACTION_LABEL: Record<StateAction, string> = {
  approved: "승인",
  rejected: "거절",
  approval_cancelled: "승인 취소",
  rejection_cleared: "거절 풀기",
};

// 채널 상태 변경 이력(승인·거절·승인 취소·거절 풀기). 누가 했는지(부모 이름)도 함께 돌려준다.
export async function getStateLog(familyId: string, opts: { profileId?: string | null; channelId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("channel_state_log")
    .select("id, profile_id, channel_id, action, actor_member_id, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 15);
  if (opts.profileId) q = q.eq("profile_id", opts.profileId);
  if (opts.channelId) q = q.eq("channel_id", opts.channelId);
  const [{ data: rows }, { data: members }] = await Promise.all([
    q,
    supabase.from("members").select("id, display_name").eq("family_id", familyId),
  ]);
  const names = new Map((members ?? []).map((m) => [m.id as string, m.display_name as string]));
  return (rows ?? []).map((r) => ({
    id: r.id as number,
    profileId: r.profile_id as string,
    channelId: r.channel_id as string,
    action: r.action as StateAction,
    actor: r.actor_member_id ? (names.get(r.actor_member_id) ?? null) : null,
    at: r.created_at as string,
  }));
}
