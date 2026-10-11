"use client";

import { useState } from "react";
import type { SearchResultItem } from "@/app/actions";
import { RequestSheet, VideoResultRow } from "@/app/kid/request-sheet";
import { ChannelAvatar } from "@/components/video";
import type { ChannelStatus } from "@/lib/data";

const NOTE: Record<ChannelStatus, string> = {
  none: "아직 승인 전인 채널이에요. 보고 싶은 영상을 누르면 부모님께 채널 추가를 요청할 수 있어요.",
  pending: "부모님이 확인 중이에요. 승인되면 ‘채널 영상’ 탭에서 볼 수 있어요.",
  rejected: "부모님이 허락하지 않은 채널이에요.",
  approved: "",
};

export function ChannelClient({
  channel,
  initialStatus,
  approvalMode,
  items: initialItems,
  error,
}: {
  channel: { channelId: string; title: string; thumbnailUrl: string | null };
  initialStatus: ChannelStatus;
  approvalMode: boolean;
  items: SearchResultItem[];
  error: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState(initialItems);
  const [sheet, setSheet] = useState<SearchResultItem | null>(null);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-1">
      <div className="flex items-center gap-3">
        <ChannelAvatar title={channel.title} url={channel.thumbnailUrl} size={56} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-heading font-bold">{channel.title}</h1>
          <p className="text-caption text-sub">{approvalMode ? NOTE[status] : "승인 모드가 꺼져 있어 바로 볼 수 있어요."}</p>
        </div>
      </div>

      <h2 className="mt-1 text-subhead font-bold">최근 영상</h2>
      {error ? <p className="rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">{error}</p> : null}
      {!error && items.length === 0 ? <p className="py-10 text-center text-caption text-sub">볼 수 있는 영상이 없어요.</p> : null}
      {items.map((r) => (
        <VideoResultRow key={r.videoId} item={r} approvalMode={approvalMode} from="channel" onRequest={() => setSheet(r)} />
      ))}

      {sheet ? (
        <RequestSheet
          item={sheet}
          onClose={() => setSheet(null)}
          onSent={() => {
            setStatus("pending");
            setItems((list) => list.map((i) => ({ ...i, status: "pending" })));
          }}
        />
      ) : null}
    </main>
  );
}
