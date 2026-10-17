import { createClient } from "@/lib/supabase/server";

// 화면을 닫거나 다른 앱으로 갈 때 남은 시청 초를 보내는 곳(navigator.sendBeacon용). 로그인한 아이만 기록된다.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { seconds?: number } | null;
  const seconds = Math.round(Number(body?.seconds ?? 0));
  if (!(seconds > 0)) return new Response(null, { status: 204 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_watch_seconds", { p_seconds: seconds });
  if (error) console.error("watch beat failed", error.message);
  return new Response(null, { status: 204 });
}
