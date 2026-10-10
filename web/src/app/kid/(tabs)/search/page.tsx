import { BrandHeader, ModeBanner } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { SearchClient } from "./search-client";

export default async function KidSearchPage() {
  const me = await requireMe("child");
  return (
    <>
      <BrandHeader name={me.displayName} email={me.email} />
      <ModeBanner approvalMode={me.approvalMode} tab="search" />
      <SearchClient approvalMode={me.approvalMode} profileId={me.profileId!} />
    </>
  );
}
