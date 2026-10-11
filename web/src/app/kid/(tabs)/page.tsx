import { after } from "next/server";
import { BrandHeader, ModeBanner } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { getApprovedFeed } from "@/lib/data";
import { getSearchRemaining, purgeCache, recheckVideos, refreshProfileChannels } from "@/lib/yt-cache";
import { Feed } from "./feed";

export default async function KidHome({ searchParams }: PageProps<"/kid">) {
  const me = await requireMe("child");
  const { channel } = await searchParams;
  const initialChannel = typeof channel === "string" ? channel : "all";
  const [{ videos, channels, lastFetchedAt, likedIds }, searchRemaining] = await Promise.all([
    getApprovedFeed(me.profileId!),
    getSearchRemaining(),
  ]);

  // 응답 뒤에: 6시간 지난 승인 채널의 새 영상 추가, 7일 지난 저장 영상 재확인, 30일 넘은 캐시 정리.
  after(async () => {
    try {
      await refreshProfileChannels(me.profileId!);
      await recheckVideos(200);
      await purgeCache();
    } catch (e) {
      console.error("background refresh failed", e);
    }
  });

  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} />
      <ModeBanner approvalMode={me.approvalMode} tab="feed" />
      <Feed key={initialChannel} videos={videos} channels={channels} likedIds={likedIds} searchRemaining={searchRemaining} lastFetchedAt={lastFetchedAt} initialChannel={initialChannel} />
    </>
  );
}
