"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { channelStatusesAction, requestChannelAction, searchAction, type SearchResultItem } from "@/app/actions";
import { IconClock, IconPlus } from "@/components/icons";
import { ScrollArea } from "@/components/scroll-area";
import { ChannelAvatar, RowTag, Thumb, VideoRowBody } from "@/components/video";

// 검색 결과는 프로필별로 이 탭(sessionStorage)에만 보관한다. 승인 상태는 복원할 때 다시 조회한다.
const storeKey = (profileId: string) => `chdam.search.${profileId}`;

function loadSaved(profileId: string): { query: string; items: SearchResultItem[]; next: string | null } | null {
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

export function SearchClient({ approvalMode, profileId }: { approvalMode: boolean; profileId: string }) {
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
    setDraft(saved.query);
    setQuery(saved.query);
    setItems(uniq(saved.items ?? []));
    setNext(saved.next);
    channelStatusesAction(saved.items.map((i) => i.channelId)).then((statuses) => {
      setItems((list) => list.map((i) => ({ ...i, status: statuses[i.channelId] ?? i.status })));
    });
  }, [profileId]);

  function persist(q: string, list: SearchResultItem[], token: string | null) {
    try {
      sessionStorage.setItem(storeKey(profileId), JSON.stringify({ query: q, items: list, next: token }));
    } catch {}
  }

  // 검색은 버튼(제출)을 눌렀을 때만 실행한다 — 입력 중 자동 검색 없음.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    start(async () => {
      const r = await searchAction(q);
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
        <form onSubmit={submit} className="mx-5 mt-3.5 flex gap-2">
          <label htmlFor="sq" className="sr-only">
            YouTube 검색어
          </label>
          <input
            id="sq"
            type="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="보고 싶은 영상을 찾아보세요"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-control outline-none focus:border-accent"
          />
          <button type="submit" disabled={pending} className="h-12 flex-none rounded-xl bg-accent px-5 text-control font-semibold text-white disabled:opacity-60">
            검색
          </button>
        </form>

        {error ? (
          <p role="alert" className="mx-5 mt-3 rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">
            {error}
          </p>
        ) : null}

        {query ? <p className="mx-5 mb-1.5 mt-3.5 text-caption text-sub">‘{query}’ 검색 결과</p> : null}
      </div>

      <ScrollArea resetKey={query} className="flex flex-col gap-4 px-5 pb-4 pt-1">
        {pending && items.length === 0 ? <p className="py-10 text-center text-caption text-sub">찾는 중…</p> : null}
        {items.map((r) => {
          const playable = !approvalMode || r.status === "approved";
          if (playable) {
            return (
              <Link key={r.videoId} href={`/kid/watch/${r.videoId}?from=search`} className="flex gap-3 text-ink">
                <VideoRowBody
                  thumbnailUrl={r.thumbnailUrl}
                  playable
                  title={r.title}
                  meta={r.channelTitle}
                  tag={approvalMode ? <RowTag tone="accent">승인 채널</RowTag> : null}
                />
              </Link>
            );
          }
          // 미승인 카드는 재생 표시 없이, 카드 전체를 누르면 채널 추가 요청 시트가 열린다.
          if (r.status === "none") {
            return (
              <button key={r.videoId} type="button" onClick={() => setSheet(r)} className="flex gap-3 text-left text-ink">
                <VideoRowBody
                  thumbnailUrl={r.thumbnailUrl}
                  title={r.title}
                  meta={r.channelTitle}
                  tag={
                    <RowTag tone="outline">
                      <IconPlus size={12} />
                      요청
                    </RowTag>
                  }
                />
              </button>
            );
          }
          return (
            <div key={r.videoId} className="flex gap-3">
              <VideoRowBody
                thumbnailUrl={r.thumbnailUrl}
                title={r.title}
                meta={r.channelTitle}
                dimTitle={r.status === "rejected"}
                tag={
                  r.status === "pending" ? (
                    <RowTag tone="warn">
                      <IconClock size={11} />
                      확인 중
                    </RowTag>
                  ) : (
                    <RowTag tone="muted">거절됨</RowTag>
                  )
                }
              />
            </div>
          );
        })}
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

function RequestSheet({ item, onClose, onSent }: { item: SearchResultItem; onClose: () => void; onSent: () => void }) {
  const [state, setState] = useState<"ask" | "sent" | "error">("ask");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const r = await requestChannelAction(item.channelId, item.videoId);
      if (!r.ok) {
        setMessage(r.error);
        setState("error");
        return;
      }
      if (r.result === "rejected") {
        setMessage("부모님이 거절한 채널이라 다시 요청할 수 없어요.");
        setState("error");
        return;
      }
      onSent();
      setState("sent");
    });
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-[480px] flex-col justify-end">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-[rgba(21,23,26,0.45)]" />
      <section role="dialog" aria-modal="true" aria-labelledby="sheetTitle" className="relative flex flex-col gap-[18px] rounded-t-[20px] bg-surface px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-2.5">
        <div className="h-1 w-10 self-center rounded-full bg-[#d5d9e0]" />
        {state === "sent" ? (
          <div className="flex flex-col items-center gap-3.5 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-warn-bg text-warn-ink">
              <IconClock size={26} />
            </span>
            <h2 id="sheetTitle" className="text-heading font-bold">
              요청을 보냈어요
            </h2>
            <p className="text-body text-ink-2">
              부모님이 승인하면 ‘채널 영상’ 탭에서
              <br />
              이 채널 영상을 볼 수 있어요. 결과는 ‘내 요청’에서 확인해요.
            </p>
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-ink text-control font-semibold text-white">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ChannelAvatar title={item.channelTitle} size={52} />
              <div className="flex flex-col gap-0.5">
                <h2 id="sheetTitle" className="text-heading font-bold">
                  {item.channelTitle}
                </h2>
                <span className="text-caption text-sub">아직 승인 전이라 볼 수 없어요. YouTube가 아닌 우리 가족 설정이에요.</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption font-medium text-sub">요청하는 계기가 된 영상</span>
              <div className="flex items-center gap-2.5 rounded-xl bg-bg p-2.5">
                <Thumb url={item.thumbnailUrl} className="h-[54px] w-24" />
                <span className="line-clamp-2 text-callout font-semibold leading-[1.4]">{item.title}</span>
              </div>
            </div>
            {state === "error" ? (
              <p role="alert" className="rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">
                {message}
              </p>
            ) : (
              <p className="text-body text-ink-2">
                부모님께 이 채널을 추가해 달라고 요청할까요? 승인되면 이 채널의 영상을 모두 볼 수 있어요.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} className="h-12 rounded-xl border border-line bg-surface text-control font-semibold text-ink">
                취소
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending || state === "error"}
                className="h-12 rounded-xl bg-accent text-control font-semibold text-white disabled:opacity-60"
              >
                {pending ? "보내는 중…" : "요청하기"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
