import { redirect } from "next/navigation";
import { SignOutForm } from "@/components/sign-out";
import { BrandMark, IconLock } from "@/components/icons";
import { lookupMe } from "@/lib/auth";

export default async function NoAccessPage({ searchParams }: PageProps<"/no-access">) {
  const result = await lookupMe();
  if (result.status === "ok") redirect("/");
  if (result.status === "anonymous") redirect("/login");
  const { reason } = await searchParams;
  const noProfile = reason === "noProfile" || result.status === "noProfile";
  const email = result.status === "notRegistered" ? result.email : "";

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6">
      <header className="flex items-center gap-2 pb-2 pt-5">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent">
          <BrandMark />
        </span>
        <span className="text-heading font-bold tracking-[-0.3px]">채널담</span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-warn-bg text-warn-ink">
          <IconLock />
        </span>
        {noProfile ? (
          <div className="flex flex-col gap-2.5">
            <h1 className="text-heading font-bold">아직 내 프로필이 없어요</h1>
            <p className="text-body text-ink-2">가족에는 등록됐지만 프로필이 연결되지 않았어요. 부모님께 프로필 연결을 부탁해 주세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <h1 className="text-heading font-bold">가족으로 등록된 계정이 아니에요</h1>
            <p className="break-keep text-body text-ink-2">
              <b className="font-semibold break-all">{email}</b> 계정은 이 가족에 등록되어 있지 않아요. 부모님께 이 이메일을
              등록해 달라고 말해 주세요.
            </p>
          </div>
        )}
      </main>
      <SignOutForm className="flex flex-none flex-col gap-2.5 pb-10">
        <button className="flex h-12 items-center justify-center rounded-xl bg-ink text-control font-semibold text-white">
          다른 계정으로 로그인
        </button>
      </SignOutForm>
    </div>
  );
}
