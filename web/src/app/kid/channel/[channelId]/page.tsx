import { redirect } from "next/navigation";
import { BackHeader } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { getChannelStatusMap } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/server";
import { getChannelRecentVideos } from "@/lib/youtube";
import { ensureChannels } from "@/lib/yt-cache";
import type { SearchResultItem } from "@/app/actions";
import { ChannelClient } from "./channel-client";

// 검색 탭 '채널' 모드에서 들어오는 채널 화면. 승인 채널은 채널 영상 탭으로 보내고,
// 그 밖의 채널은 최근 일반 영상을 보여주어 아이가 영상을 골라 부모님께 요청하게 한다.
export default async function KidChannelPage({ params }: PageProps<"/kid/channel/[channelId]">) {
  const me = await requireMe("child");
  const { channelId } = await params;
  const status = (await getChannelStatusMap(me.profileId!, [channelId])).get(channelId) ?? "none";
  if (status === "approved") redirect(`/kid?channel=${encodeURIComponent(channelId)}`);

  await ensureChannels([channelId]).catch(() => undefined);
  // 승인 전 채널이라 아이 권한으로는 캐시를 읽을 수 없어 서버 권한으로 읽는다(위에서 프로필 상태를 확인함).
  const { data: ch } = await createAdminClient()
    .from("yt_channel_cache")
    .select("title, thumbnail_url, uploads_playlist_id")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (!ch) {
    return (
      <div className="flex min-h-dvh flex-col">
        <BackHeader href="/kid/search" label="검색" />
        <p className="mx-5 mt-4 rounded-xl bg-danger-bg px-3.5 py-3 text-body text-danger-ink">채널을 찾을 수 없어요.</p>
      </div>
    );
  }

  let items: SearchResultItem[] = [];
  let error = "";
  try {
    const videos = await getChannelRecentVideos(channelId, ch.uploads_playlist_id);
    items = videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelId,
      channelTitle: ch.title,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
      status,
    }));
  } catch (e) {
    console.error("channel videos failed", channelId, e);
    error = "영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader href="/kid/search" label="검색" />
      <ChannelClient
        channel={{ channelId, title: ch.title, thumbnailUrl: ch.thumbnail_url }}
        initialStatus={status}
        approvalMode={me.approvalMode}
        items={items}
        error={error}
      />
    </div>
  );
}
