import "server-only";

// 웹 푸시 발송 — 다음 단계(VAPID 키, 서비스 워커)에서 구현한다. 지금은 대기함·내 요청 배지가 원본이다.
export type PushMessage = { title: string; body: string; url: string };

export async function notifyParents(familyId: string, message: PushMessage) {
  void familyId;
  void message;
}

export async function notifyChild(profileId: string, message: PushMessage) {
  void profileId;
  void message;
}
