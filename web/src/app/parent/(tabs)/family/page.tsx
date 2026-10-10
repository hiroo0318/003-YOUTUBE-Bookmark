import { BrandHeader } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm, RemoveMemberButton } from "./family-client";

export default async function FamilyPage() {
  const me = await requireMe("parent");
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, email, role, display_name, is_owner, auth_user_id, created_at")
    .eq("family_id", me.familyId)
    .order("created_at");

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} variant="parent" />
      <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        <h2 className="text-subhead font-bold">가족 구성원</h2>
        {(members ?? []).map((m) => {
          const parent = m.role === "parent";
          const linked = !!m.auth_user_id;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
              <span
                className={`flex size-10 flex-none items-center justify-center rounded-full text-callout font-bold ${
                  parent ? "bg-ink text-white" : "bg-accent-soft text-accent-strong"
                }`}
              >
                {m.display_name[0]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body font-semibold">
                  {m.display_name}
                  {m.id === me.memberId ? " (나)" : ""}
                </span>
                <span className="truncate text-caption text-sub">{m.email}</span>
                <span className={`text-caption ${linked ? "text-ok-ink" : "text-warn-ink"}`}>
                  {m.is_owner ? "최초 부모 · " : ""}
                  {linked ? (parent ? "연결됨" : "프로필 연결됨") : "아직 로그인하지 않았어요"}
                </span>
              </div>
              <span
                className={`flex-none rounded-full px-2 py-[3px] text-label font-semibold ${
                  parent ? "bg-ink text-white" : "bg-accent-soft text-accent-strong"
                }`}
              >
                {parent ? "부모" : "아이"}
              </span>
              {!m.is_owner && m.id !== me.memberId ? <RemoveMemberButton memberId={m.id} name={m.display_name} /> : null}
            </div>
          );
        })}
        <AddMemberForm />
      </main>
    </>
  );
}
