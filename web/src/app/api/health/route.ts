// 서버를 깨워 두기 위한 가벼운 주소(Supabase 예약 작업이 주기적으로 부른다). 로그인 없이 응답하고 DB·YouTube를 부르지 않는다.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
