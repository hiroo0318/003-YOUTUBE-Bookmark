import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

// 웹 푸시 발송. 알림은 보조 수단이라 실패해도 예외를 던지지 않는다(대기함·내 요청 배지가 원본).
export type PushMessage = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;
function configure() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || (process.env.FIRST_PARENT_EMAIL ? `mailto:${process.env.FIRST_PARENT_EMAIL}` : "");
  if (!publicKey || !privateKey || !subject) {
    console.warn("web push disabled: VAPID keys or subject missing");
    return (configured = false);
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return (configured = true);
}

// 구성원들의 모든 기기로 보낸다. 만료된 구독(404·410)은 지운다. 보낸 기기 수를 돌려준다.
async function sendToMembers(memberIds: string[], message: PushMessage) {
  if (memberIds.length === 0 || !configure()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("member_id", memberIds);
  const payload = JSON.stringify(message);
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("push send failed", status, (e as Error).message);
      }
    }),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return sent;
}

export async function notifyParents(familyId: string, message: PushMessage) {
  try {
    const { data } = await createAdminClient().from("members").select("id").eq("family_id", familyId).eq("role", "parent");
    return await sendToMembers((data ?? []).map((m) => m.id as string), message);
  } catch (e) {
    console.error("notifyParents failed", e);
    return 0;
  }
}

export async function notifyChild(profileId: string, message: PushMessage) {
  try {
    const { data } = await createAdminClient().from("child_profiles").select("member_id").eq("id", profileId).maybeSingle();
    return data ? await sendToMembers([data.member_id as string], message) : 0;
  } catch (e) {
    console.error("notifyChild failed", e);
    return 0;
  }
}

export async function notifyMember(memberId: string, message: PushMessage) {
  try {
    return await sendToMembers([memberId], message);
  } catch (e) {
    console.error("notifyMember failed", e);
    return 0;
  }
}
