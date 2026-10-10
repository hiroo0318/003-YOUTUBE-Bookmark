import { BrandMark } from "@/components/icons";
import { GoogleLoginButton } from "./google-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6">
      <main className="flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
        <span className="flex size-[72px] items-center justify-center rounded-[20px] bg-accent">
          <BrandMark size={36} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-title font-bold tracking-[-0.3px]">채널담</h1>
          <p className="text-body text-ink-2">
            가족이 함께 고른 채널을
            <br />
            한곳에 담아 보는 곳
          </p>
        </div>
      </main>
      <div className="flex flex-none flex-col gap-3.5 pb-10">
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-bg px-3.5 py-3 text-caption text-danger-ink">
            로그인하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
        <GoogleLoginButton />
        <p className="text-center text-caption leading-normal text-sub">
          가족으로 등록된 Google 계정만 이용할 수 있어요.
          <br />
          등록은 부모님이 가족 관리에서 해요.
        </p>
      </div>
    </div>
  );
}
