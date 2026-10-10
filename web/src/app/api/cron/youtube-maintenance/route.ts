import { NextResponse } from "next/server";
import { purgeCache, recheckVideos, refreshAllApprovedChannels } from "@/lib/yt-cache";

// 하루 한 번 Vercel Cron이 호출한다(vercel.json). 앱을 아무도 열지 않아도
// 승인 채널의 새 영상을 추가하고, 저장 영상을 30일 안에 다시 확인해 누적 목록이 지워지지 않게 한다.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const channels = await refreshAllApprovedChannels();
  const rechecked = await recheckVideos(2000);
  await purgeCache();
  return NextResponse.json({ ok: true, channels, rechecked });
}
