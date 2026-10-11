"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { loadOlderAction, refreshFeedAction, searchInChannelAction, toggleLikeAction } from "@/app/actions";
import { IconSearch } from "@/components/icons";
import { LikeToggle } from "@/components/like-button";
import { ScrollArea } from "@/components/scroll-area";
import { RowTag, Thumb, VideoRowBody } from "@/components/video";
import { ChannelRail } from "./channel-rail";
import type { ChannelLite, FeedVideo } from "@/lib/data";
import { clockTime, timeAgo } from "@/lib/format";
import type { SearchVideo } from "@/lib/youtube";

export function Feed({
  videos,
  channels,
  likedIds,
  lastFetchedAt,
  initialChannel = "all",
}: {
  videos: FeedVideo[];
  channels: ChannelLite[];
  likedIds: string[];
  lastFetchedAt: string | null;
  initialChannel?: string;
}) {
  const [query, setQuery] = useState("");
  // chip: "all" | "liked" | 채널 ID
  const [chip, setChip] = useState<string>(
    initialChannel === "liked" || channels.some((c) => c.channelId === initialChannel) ? initialChannel : "all",
  );
  const [liked, setLiked] = useState<string[]>(likedIds); // 좋아요 누른 순서(최근 먼저)
  const [likeError, setLikeError] = useState("");
  const likedSet = useMemo(() => new Set(liked), [liked]);
  const isChannel = chip !== "all" && chip !== "liked";
  const [refreshing, startRefresh] = useTransition();
  const [more, setMore] = useState<{ items: SearchVideo[]; error?: string } | null>(null);
  const [searchingMore, startMore] = useTransition();
  const [kind, setKind] = useState<"video" | "short">("video");

  // 채널(또는 좋아요)·검색어로 거른 뒤 일반 영상과 쇼츠로 나눈다.
  // 좋아요는 누른 순서대로, 재생 불가로 바뀐 영상도 '볼 수 없는 영상'으로 남겨 뺄 수 있게 한다.
  const { longs, shorts } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byId = new Map(videos.map((v) => [v.videoId, v]));
    const pool =
      chip === "liked"
        ? liked.map((id) => byId.get(id)).filter((v): v is FeedVideo => !!v)
        : videos.filter((v) => v.playable && (chip === "all" || v.channelId === chip));
    const base = pool.filter((v) => !q || v.title.toLowerCase().includes(q) || v.channelTitle.toLowerCase().includes(q));
    return { longs: base.filter((v) => !v.isShort), shorts: base.filter((v) => v.isShort) };
  }, [videos, query, chip, liked]);

  // 먼저 화면에 반영하고 저장한다. 실패하면 되돌린다.
  const toggleLike = async (videoId: string) => {
    const on = !likedSet.has(videoId);
    setLikeError("");
    setLiked((cur) => (on ? [videoId, ...cur] : cur.filter((id) => id !== videoId)));
    const r = await toggleLikeAction(videoId, on);
    if (!r.ok) {
      setLiked((cur) => (on ? cur.filter((id) => id !== videoId) : [videoId, ...cur]));
      setLikeError(r.error);
    }
  };
  const filtered = kind === "video" ? longs : shorts;

  if (channels.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-subhead font-semibold">아직 승인된 채널이 없어요</p>
        <p className="text-caption text-sub">검색에서 보고 싶은 영상을 찾아 부모님께 채널 추가를 요청해 보세요.</p>
        <Link href="/kid/search" className="mt-3 flex h-12 items-center rounded-xl bg-accent px-5 text-control font-semibold text-white">
          검색하러 가기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex-none">
        <div className="relative mx-5 mt-3.5">
          <label htmlFor="q" className="sr-only">
            승인 채널에서 찾기
          </label>
          <span className="pointer-events-none absolute left-3.5 top-[15px] text-sub">
            <IconSearch size={18} />
          </span>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMore(null);
            }}
            placeholder="승인 채널에서 찾기"
            className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3.5 text-control outline-none focus:border-accent"
          />
        </div>

        <ChannelRail
          channels={channels}
          selected={chip}
          onToggle={(id) => {
            setChip((cur) => (cur === id ? "all" : id));
            setMore(null);
          }}
        />

        <div role="tablist" aria-label="영상 종류" className="mx-5 mt-2 grid grid-cols-2 rounded-xl bg-track p-1">
          {(
            [
              ["video", "영상"],
              ["short", "쇼츠"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`h-9 rounded-[9px] text-body ${
                kind === k ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,23,26,0.08)]" : "font-medium text-sub"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 pb-1 pt-1.5 text-caption text-sub">
          <span>{lastFetchedAt ? `마지막 갱신 ${clockTime(lastFetchedAt)}` : "영상을 불러오는 중이에요"}</span>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => startRefresh(() => refreshFeedAction())}
            className="h-9 rounded-lg px-2 font-semibold text-accent-strong disabled:opacity-50"
          >
            {refreshing ? "가져오는 중…" : "새 영상 가져오기"}
          </button>
        </div>
      </div>

      <ScrollArea resetKey={`${chip}-${kind}`} className="flex flex-col gap-3.5 px-5 pb-4 pt-1">
        {likeError ? <p className="text-caption text-danger-ink">{likeError}</p> : null}
        {kind === "video"
          ? longs.map((v) => (
              <div key={v.videoId} className="flex items-end gap-1">
                {v.playable ? (
                  <Link href={`/kid/watch/${v.videoId}`} className="flex min-w-0 flex-1 gap-3 text-ink">
                    <VideoRowBody
                      thumbnailUrl={v.thumbnailUrl}
                      duration={v.durationSeconds}
                      playable
                      title={v.title}
                      meta={`${v.channelTitle} · ${timeAgo(v.publishedAt)}`}
                    />
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 gap-3 text-ink">
                    <VideoRowBody
                      thumbnailUrl={v.thumbnailUrl}
                      title={v.title}
                      meta={v.channelTitle}
                      dimTitle
                      tag={<RowTag tone="muted">볼 수 없는 영상</RowTag>}
                    />
                  </div>
                )}
                <LikeToggle liked={likedSet.has(v.videoId)} onToggle={() => toggleLike(v.videoId)} />
              </div>
            ))
          : null}
        {kind === "short" && shorts.length > 0 ? (
          // 쇼츠는 한 편씩 눌러 재생한다(연속 넘겨보기 피드는 만들지 않는다).
          <div className="grid grid-cols-3 gap-x-2 gap-y-3">
            {shorts.map((v) => (
              <div key={v.videoId} className="relative flex min-w-0 flex-col">
                {v.playable ? (
                  <Link href={`/kid/watch/${v.videoId}`} className="flex min-w-0 flex-col gap-1.5 text-ink">
                    <Thumb url={v.thumbnailUrl} duration={v.durationSeconds} className="aspect-[9/16] w-full" />
                    <span className="line-clamp-2 text-meta font-semibold leading-[1.35]">{v.title}</span>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-col gap-1.5 text-sub">
                    <Thumb url={v.thumbnailUrl} className="aspect-[9/16] w-full opacity-50" />
                    <span className="line-clamp-2 text-meta font-semibold leading-[1.35]">볼 수 없는 영상</span>
                  </div>
                )}
                <span className="absolute right-1.5 top-1.5">
                  <LikeToggle variant="overlay" liked={likedSet.has(v.videoId)} onToggle={() => toggleLike(v.videoId)} />
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {isChannel && !query.trim() ? (
          <OlderButton key={`${chip}-${kind}`} channelId={chip} kind={kind} />
        ) : null}

        {filtered.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-3 py-12 text-center">
            {chip === "liked" && !query.trim() ? (
              <>
                <span className="text-subhead font-semibold">{kind === "short" ? "좋아요한 쇼츠가 없어요" : "좋아요한 영상이 없어요"}</span>
                <span className="text-caption text-sub">마음에 드는 영상에 ♥를 눌러 보세요.</span>
              </>
            ) : (
              <>
                <span className="text-subhead font-semibold">
                  {query.trim() ? "최근 영상에서 찾지 못했어요" : kind === "short" ? "아직 쇼츠가 없어요" : "아직 영상이 없어요"}
                </span>
                <span className="text-caption text-sub">
                  {chip === "liked" ? "좋아요한 영상에서 찾아요." : "승인 채널마다 최근 50개 영상에서 찾아요."}
                </span>
              </>
            )}
            {isChannel && query.trim() ? (
              <button
                type="button"
                disabled={searchingMore}
                onClick={() =>
                  startMore(async () => {
                    const r = await searchInChannelAction(chip, query);
                    setMore(r.ok ? { items: r.items } : { items: [], error: r.error });
                  })
                }
                className="mx-auto mt-2.5 h-12 rounded-xl border border-accent-line bg-surface px-[18px] text-control font-semibold text-accent-strong disabled:opacity-50"
              >
                {searchingMore ? "찾는 중…" : "YouTube에서 이 채널 더 찾기"}
              </button>
            ) : null}
          </div>
        ) : null}

        {more ? (
          <section className="flex flex-col gap-3.5">
            {more.error ? <p className="text-caption text-danger-ink">{more.error}</p> : null}
            {more.items.map((v) => (
              <Link key={v.videoId} href={`/kid/watch/${v.videoId}`} className="flex gap-3 text-ink">
                <VideoRowBody thumbnailUrl={v.thumbnailUrl} playable title={v.title} meta={v.channelTitle} />
              </Link>
            ))}
          </section>
        ) : null}
      </ScrollArea>
    </>
  );
}

// 고른 채널 하나에서 저장된 영상보다 오래된 영상을 50개씩 더 받는다.
function OlderButton({ channelId, kind }: { channelId: string; kind: "video" | "short" }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ done: boolean; message: string }>({ done: false, message: "" });
  const label = kind === "short" ? "이전 쇼츠 더 보기" : "이전 영상 더 보기";

  if (state.done) return <p className="py-3 text-center text-caption text-sub">{state.message || "이 채널의 영상을 모두 불러왔어요."}</p>;
  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await loadOlderAction(channelId, kind);
            if (!r.ok) return setState({ done: false, message: r.error });
            if (r.done) setState({ done: true, message: r.added === 0 ? "더 불러올 영상이 없어요." : "" });
            else setState({ done: false, message: "" });
          })
        }
        className="h-12 w-full rounded-xl border border-line bg-surface text-control font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "불러오는 중…" : label}
      </button>
      {state.message ? <p className="text-caption text-danger-ink">{state.message}</p> : null}
    </div>
  );
}
