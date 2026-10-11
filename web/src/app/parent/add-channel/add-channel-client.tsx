"use client";

import { useState, useTransition } from "react";
import { searchChannelsAction, setChannelStateAction } from "@/app/actions";
import { SearchQuota } from "@/components/search-quota";
import { ChannelAvatar } from "@/components/video";
import type { SearchChannel } from "@/lib/youtube";

export function AddChannelClient({
  profileId,
  kidName,
  initialStates,
  initialRemaining,
}: {
  profileId: string;
  kidName: string;
  initialRemaining: number;
  initialStates: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchChannel[]>([]);
  const [states, setStates] = useState(initialStates);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await searchChannelsAction(q);
      if (r.remaining !== undefined) setRemaining(r.remaining);
      if (!r.ok) return setError(r.error);
      setError("");
      setItems(r.items);
    });
  }

  async function approve(channelId: string) {
    setBusy(channelId);
    const r = await setChannelStateAction(profileId, channelId, "approved");
    setBusy(null);
    if (r.ok) setStates((s) => ({ ...s, [channelId]: "approved" }));
  }

  return (
    <main className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-1">
      <h1 className="text-heading font-bold">{kidName}에게 채널 승인</h1>
      <p className="text-caption text-sub">승인하면 그 채널의 앞으로 올라올 영상도 {kidName}이(가) 볼 수 있어요.</p>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="cq" className="sr-only">
          채널 이름
        </label>
        <input
          id="cq"
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="채널 이름으로 찾기"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-control outline-none focus:border-accent"
        />
        <button type="submit" disabled={pending} className="h-12 flex-none rounded-xl bg-accent px-5 text-control font-semibold text-white disabled:opacity-60">
          검색
        </button>
      </form>
      <SearchQuota remaining={remaining} className="-mt-1" />
      {error ? <p className="rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">{error}</p> : null}
      {items.map((c) => {
        const st = states[c.channelId];
        return (
          <div key={c.channelId} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
            <ChannelAvatar title={c.title} url={c.thumbnailUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">{c.title}</span>
              <span className="line-clamp-1 text-caption text-sub">{c.description || "설명 없음"}</span>
            </div>
            {st === "approved" ? (
              <span className="rounded-full bg-accent-soft px-2 py-[3px] text-label font-semibold text-accent-strong">승인됨</span>
            ) : (
              <button
                type="button"
                disabled={busy === c.channelId}
                onClick={() => approve(c.channelId)}
                className="h-9 flex-none rounded-[10px] bg-accent px-3 text-caption font-semibold text-white disabled:opacity-50"
              >
                {busy === c.channelId ? "…" : st === "rejected" ? "거절 풀고 승인" : "승인"}
              </button>
            )}
          </div>
        );
      })}
    </main>
  );
}
