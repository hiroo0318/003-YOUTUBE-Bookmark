import { BrandHeader, ModeBanner } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { getSearchRemaining } from "@/lib/yt-cache";
import { SearchClient } from "./search-client";

export default async function KidSearchPage() {
  const me = await requireMe("child");
  const remaining = await getSearchRemaining();
  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} />
      <ModeBanner approvalMode={me.approvalMode} tab="search" />
      <SearchClient approvalMode={me.approvalMode} profileId={me.profileId!} initialRemaining={remaining} />
    </>
  );
}
