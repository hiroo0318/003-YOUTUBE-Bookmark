"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { channelStatusesAction, searchAction, searchChannelsKidAction, type ChannelResultItem, type SearchResultItem } from "@/app/actions";
import { RequestSheet, VideoResultRow } from "@/app/kid/request-sheet";
import { ScrollArea } from "@/components/scroll-area";
import { IconChevron, IconClock } from "@/components/icons";
import { SearchQuota } from "@/components/search-quota";
import { ChannelAvatar, RowTag } from "@/components/video";

type Mode = "video" | "channel";
type Saved = { mode?: Mode; query: string; items: SearchResultItem[]; channels?: ChannelResultItem[]; next: string | null };

// 검색 결과는 프로필별로 이 탭(sessionStorage)에만 보관한다. 승인 상태는 복원할 때 다시 조회한다.
const storeKey = (profileId: string) => `chdam.search.${profileId}`;

function loadSaved(profileId: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(storeKey(profileId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 같은 영상이 두 번 들어가지 않게 영상 번호로 거른다(YouTube 검색 중복·예전에 저장된 결과 복원 대비).
function uniq(list: SearchResultItem[]) {
  const seen = new Set<string>();
  return list.filter((i) => i.videoId && !seen.has(i.videoId) && !!seen.add(i.videoId));
}

export function SearchClient({
  approvalMode,
  profileId,
  initialRemaining,
}: {
  approvalMode: boolean;
  profileId: string;
  initialRemaining: number;
}) {
  const [remaining, setRemaining] = useState(initialRemaining);
  // 영상: 영상 제목·내용으로 찾기 / 채널: 채널 이름으로 찾아 채널 화면으로 들어가기
  const [mode, setMode] = useState<Mode>("video");
  const [channels, setChannels] = useState<ChannelResultItem[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<SearchResultItem | null>(null);

  // 재생 화면에서 돌아왔을 때 마지막 검색 결과를 복원한다(검색 한도를 아끼기 위해 다시 부르지 않는다).
  useEffect(() => {
    const saved = loadSaved(profileId);
    if (!saved) return;
    // 하이드레이션 뒤 sessionStorage에서 한 번 복원한다(서버에는 없는 값).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(saved.mode ?? "video");
    setDraft(saved.query);
    setQuery(saved.query);
    setItems(uniq(saved.items ?? []));
    setChannels(saved.channels ?? []);
    setNext(saved.next);
    const ids = [...(saved.items ?? []).map((i) => i.channelId), ...(saved.channels ?? []).map((c) => c.channelId)];
    channelStatusesAction(ids).then((statuses) => {
      setItems((list) => list.map((i) => ({ ...i, status: statuses[i.channelId] ?? i.status })));
      setChannels((list) => list.map((c) => ({ ...c, status: statuses[c.channelId] ?? c.status })));
    });
  }, [profileId]);

  function persist(q: string, list: SearchResultItem[], token: string | null, m: Mode = mode, chs: ChannelResultItem[] = channels) {
    try {
      const saved: Saved = { mode: m, query: q, items: list, channels: chs, next: token };
      sessionStorage.setItem(storeKey(profileId), JSON.stringify(saved));
    } catch {}
  }

  // 모드를 바꾸면 결과를 비운다(검색어 입력은 그대로 두어 바로 다시 찾을 수 있게).
  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setQuery("");
    setItems([]);
    setChannels([]);
    setNext(null);
    setError("");
    persist("", [], null, m, []);
  }

  // 검색은 버튼(제출)을 눌렀을 때만 실행한다 — 입력 중 자동 검색 없음.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    if (mode === "channel") {
      start(async () => {
        const r = await searchChannelsKidAction(q);
        if (r.remaining !== undefined) setRemaining(r.remaining);
        if (!r.ok) return setError(r.error);
        setError("");
        setQuery(q);
        setChannels(r.items);
        setItems([]);
        setNext(null);
        persist(q, [], null, "channel", r.items);
      });
      return;
    }
    start(async () => {
      const r = await searchAction(q);
      if (r.remaining !== undefined) setRemaining(r.remaining);
      if (!r.ok) return setError(r.error);
      setError("");
      setQuery(q);
      const list = uniq(r.items);
      setItems(list);
      setNext(r.nextPageToken);
      persist(q, list, r.nextPageToken);
    });
  }

  function loadMore() {
    if (!next) return;
    start(async () => {
      const r = await searchAction(query, next);
      if (r.remaining !== undefined) setRemaining(r.remaining);
      if (!r.ok) return setError(r.error);
      const list = uniq([...items, ...r.items]);
      setItems(list);
      setNext(r.nextPageToken);
      persist(query, list, r.nextPageToken);
    });
  }

  function markPending(channelId: string) {
    const list = items.map((i) => (i.channelId === channelId && i.status === "none" ? { ...i, status: "pending" as const } : i));
    setItems(list);
    persist(query, list, next);
  }

  return (
    <>
      <div className="flex-none">
        <div role="tablist" aria-label="검색 대상" className="mx-5 mt-3 grid grid-cols-2 rounded-xl bg-track p-1">
          {(
            [
              ["video", "영상"],
              ["channel", "채널"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`h-9 rounded-[9px] text-body ${
                mode === m ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mx-5 mt-2 flex gap-2">
          <label htmlFor="sq" className="sr-only">
            YouTube 검색어
          </label>
          <input
            id="sq"
            type="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={mode === "channel" ? "채널 이름으로 찾아보세요" : "보고 싶은 영상을 찾아보세요"}
            className="appearance-none h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-control outline-none focus:border-accent"
          />
          <button type="submit" disabled={pending} className="h-12 flex-none rounded-xl bg-accent px-5 text-control font-semibold text-white disabled:opacity-60">
            검색
          </button>
        </form>
        <SearchQuota remaining={remaining} className="mx-5 mt-1.5" />

        {error ? (
          <p role="alert" className="mx-5 mt-3 rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">
            {error}
          </p>
        ) : null}

        {query ? <p className="mx-5 mb-1.5 mt-3.5 text-caption text-sub">‘{query}’ 검색 결과</p> : null}
      </div>

      <ScrollArea resetKey={`${mode}-${query}`} className="flex flex-col gap-4 px-5 pb-4 pt-1">
        {pending && items.length === 0 && channels.length === 0 ? <p className="py-10 text-center text-caption text-sub">찾는 중…</p> : null}
        {!pending && query && mode === "video" && items.length === 0 ? (
          <p className="py-10 text-center text-caption text-sub">
            {next ? "이번 결과에는 볼 수 있는 일반 영상이 없어요. 아래 '결과 더 보기'를 눌러 보세요." : "검색 결과가 없어요."}
          </p>
        ) : null}
        {!pending && query && mode === "channel" && channels.length === 0 ? (
          <p className="py-10 text-center text-caption text-sub">찾는 채널이 없어요.</p>
        ) : null}
        {mode === "channel" ? channels.map((c) => <ChannelResultRow key={c.channelId} item={c} />) : null}
        {items.map((r) => (
          <VideoResultRow key={r.videoId} item={r} approvalMode={approvalMode} from="search" onRequest={() => setSheet(r)} />
        ))}
        {next ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="h-12 rounded-xl border border-line bg-surface text-control font-medium text-ink disabled:opacity-60"
          >
            {pending ? "불러오는 중…" : "결과 더 보기"}
          </button>
        ) : null}
      </ScrollArea>

      {sheet ? <RequestSheet item={sheet} onClose={() => setSheet(null)} onSent={() => markPending(sheet.channelId)} /> : null}
    </>
  );
}

// 채널 결과: 승인 채널은 채널 영상 탭(그 채널 선택)으로, 나머지는 채널 화면으로 들어가 영상을 보고 요청한다.
function ChannelResultRow({ item: c }: { item: ChannelResultItem }) {
  const href = c.status === "approved" ? `/kid?channel=${c.channelId}` : `/kid/channel/${c.channelId}`;
  return (
    <Link href={href} className="flex items-center gap-3 text-ink">
      <ChannelAvatar title={c.title} url={c.thumbnailUrl} size={48} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate text-caption font-semibold ${c.status === "rejected" ? "text-sub" : ""}`}>{c.title}</span>
        <span className="line-clamp-1 text-meta text-sub">{c.description || "채널 설명이 없어요"}</span>
      </div>
      {c.status === "approved" ? <RowTag tone="accent">승인 채널</RowTag> : null}
      {c.status === "pending" ? (
        <RowTag tone="warn">
          <IconClock size={11} />
          확인 중
        </RowTag>
      ) : null}
      {c.status === "rejected" ? <RowTag tone="muted">거절됨</RowTag> : null}
      <span className="flex-none text-sub">
        <IconChevron size={18} />
      </span>
    </Link>
  );
}
