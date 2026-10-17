import "server-only";
import { createClient } from "@/lib/supabase/server";

// 부모 '시청' 탭 집계. 모든 값은 채널담에서 기록한 것(YouTube 수치 아님), 날짜는 한국 시간.
const kstDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d); // YYYY-MM-DD
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isoDow = (ymd: string) => ((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 월=1 … 일=7

export type WatchPeriod = "today" | "7d" | "30d";

export async function getWatchSummary(profileId: string, period: WatchPeriod) {
  const supabase = await createClient();
  const today = kstDate(new Date());
  const weekStart = addDays(today, 1 - isoDow(today));
  const monthStart = `${today.slice(0, 8)}01`;
  const from = [weekStart, monthStart, addDays(today, -6)].sort()[0];
  const since = period === "today" ? today : addDays(today, period === "7d" ? -6 : -29);

  const [{ data: days }, { data: limits }, { data: bonus }, { data: limitToday }, { data: plays }] = await Promise.all([
    supabase.from("watch_daily").select("day, seconds").eq("profile_id", profileId).gte("day", from),
    supabase.from("watch_limits").select("weekday_minutes, weekend_minutes").eq("profile_id", profileId).maybeSingle(),
    supabase.from("watch_bonus").select("minutes").eq("profile_id", profileId).eq("day", today).maybeSingle(),
    supabase.rpc("watch_limit_seconds", { p_profile_id: profileId, p_day: today }),
    supabase
      .from("watch_plays")
      .select("video_id, channel_id")
      .eq("profile_id", profileId)
      .gte("played_at", `${since}T00:00:00+09:00`)
      .order("played_at", { ascending: false })
      .limit(5000),
  ]);

  const byDay = new Map((days ?? []).map((d) => [d.day as string, d.seconds as number]));
  const sum = (start: string) => [...byDay].filter(([d]) => d >= start && d <= today).reduce((a, [, s]) => a + s, 0);
  const elapsed = (start: string) => Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { day: d, dow: isoDow(d), seconds: byDay.get(d) ?? 0 };
  });

  const videoCount = new Map<string, { count: number; channelId: string }>();
  const channelCount = new Map<string, number>();
  for (const p of plays ?? []) {
    const v = videoCount.get(p.video_id) ?? { count: 0, channelId: p.channel_id };
    v.count++;
    videoCount.set(p.video_id, v);
    channelCount.set(p.channel_id, (channelCount.get(p.channel_id) ?? 0) + 1);
  }
  const topVideos = [...videoCount].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([videoId, v]) => ({ videoId, ...v }));
  const topChannels = [...channelCount].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([channelId, count]) => ({ channelId, count }));

  return {
    today,
    isWeekend: isoDow(today) >= 6,
    todaySeconds: byDay.get(today) ?? 0,
    todayLimitSeconds: (limitToday as number | null) ?? null,
    todayBonusMinutes: bonus?.minutes ?? 0,
    limits: { weekday: limits?.weekday_minutes ?? null, weekend: limits?.weekend_minutes ?? null },
    week: { seconds: sum(weekStart), days: elapsed(weekStart) },
    month: { seconds: sum(monthStart), days: elapsed(monthStart) },
    last7,
    totalPlays: (plays ?? []).length,
    topVideos,
    topChannels,
  };
}
