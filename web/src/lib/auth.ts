import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type Me = {
  userId: string;
  email: string;
  memberId: string;
  familyId: string;
  role: "parent" | "child";
  displayName: string;
  profileId: string | null;
  approvalMode: boolean;
};

type Lookup = { status: "anonymous" } | { status: "notRegistered"; email: string } | { status: "noProfile" } | { status: "ok"; me: Me };

// 로그인 사용자 → 가족 구성원 → (아이면) 프로필. 요청 안에서 한 번만 조회한다.
export const lookupMe = cache(async (): Promise<Lookup> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return { status: "anonymous" };
  const userId = claims.sub;
  const email = String(claims.email ?? "");

  let { data: member } = await supabase
    .from("members")
    .select("id, family_id, role, display_name")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!member) {
    await supabase.rpc("link_my_member");
    ({ data: member } = await supabase
      .from("members")
      .select("id, family_id, role, display_name")
      .eq("auth_user_id", userId)
      .maybeSingle());
  }
  if (!member) return { status: "notRegistered", email };

  let profileId: string | null = null;
  let approvalMode = true;
  if (member.role === "child") {
    const { data: profile } = await supabase
      .from("child_profiles")
      .select("id, approval_mode")
      .eq("member_id", member.id)
      .maybeSingle();
    if (!profile) return { status: "noProfile" };
    profileId = profile.id;
    approvalMode = profile.approval_mode;
  }

  return {
    status: "ok",
    me: {
      userId,
      email,
      memberId: member.id,
      familyId: member.family_id,
      role: member.role,
      displayName: member.display_name,
      profileId,
      approvalMode,
    },
  };
});

export async function requireMe(role?: "parent" | "child"): Promise<Me> {
  const result = await lookupMe();
  if (result.status === "anonymous") redirect("/login");
  if (result.status === "notRegistered") redirect("/no-access?reason=notRegistered");
  if (result.status === "noProfile") redirect("/no-access?reason=noProfile");
  const me = result.me;
  if (role && me.role !== role) redirect(me.role === "parent" ? "/parent" : "/kid");
  return me;
}

// 배포 설정의 FIRST_PARENT_EMAIL로 처음 로그인하면, 가족이 하나도 없을 때만 가족과 최초 부모를 만든다.
export async function bootstrapFirstParent(userId: string, email: string, name: string) {
  const first = (process.env.FIRST_PARENT_EMAIL ?? "").trim().toLowerCase();
  if (!first || email.toLowerCase() !== first) return;

  const admin = createAdminClient();
  const { count } = await admin.from("members").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  const { data: family, error } = await admin.from("families").insert({ name: "우리 가족" }).select("id").single();
  if (error || !family) throw error ?? new Error("가족을 만들지 못했어요");
  await admin.from("members").insert({
    family_id: family.id,
    email: first,
    role: "parent",
    display_name: name || "부모",
    is_owner: true,
    auth_user_id: userId,
  });
}
