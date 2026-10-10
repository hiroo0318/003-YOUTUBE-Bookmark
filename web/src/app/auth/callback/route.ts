import { NextResponse } from "next/server";
import { bootstrapFirstParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=1`);

  const user = data.user;
  const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
  try {
    await bootstrapFirstParent(user.id, user.email ?? "", name);
  } catch (e) {
    console.error("bootstrap first parent failed", e);
  }
  await supabase.rpc("link_my_member");

  return NextResponse.redirect(`${origin}/`);
}
