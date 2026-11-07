-- 서버 깨워 두기 (2026-11-07)
-- Vercel 무료 요금제는 한동안 요청이 없으면 서버를 내려 첫 접속이 1~2초 느려진다(콜드 스타트).
-- 아이가 주로 쓰는 시간대에만 30분마다 /api/health를 불러 서버를 깨워 둔다.
-- pg_cron 시간은 UTC 기준이다(한국 시간 = UTC + 9).
--   평일(월~금) 15:00~21:30 KST  → UTC 06:00~12:30 월~금
--   주말(토·일) 08:00~21:30 KST  → UTC 23:00~23:30 금·토 + 00:00~12:30 토·일
-- 같은 Supabase 프로젝트를 쓰는 다른 앱에는 영향이 없다(확장 기능 2개만 켠다).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 다시 실행해도 겹치지 않게 같은 이름의 예약을 먼저 지운다.
select cron.unschedule(jobname) from cron.job where jobname like 'chdam-warm-%';

select cron.schedule('chdam-warm-weekday', '0,30 6-12 * * 1-5',
  $$ select net.http_get('https://003-youtube-bookmark.vercel.app/api/health') $$);
select cron.schedule('chdam-warm-weekend-early', '0,30 23 * * 5,6',
  $$ select net.http_get('https://003-youtube-bookmark.vercel.app/api/health') $$);
select cron.schedule('chdam-warm-weekend', '0,30 0-12 * * 0,6',
  $$ select net.http_get('https://003-youtube-bookmark.vercel.app/api/health') $$);

-- 확인: select jobname, schedule from cron.job where jobname like 'chdam-warm-%';
-- 결과: select status_code, created from net._http_response order by created desc limit 10;
-- 끄기: select cron.unschedule(jobname) from cron.job where jobname like 'chdam-warm-%';
