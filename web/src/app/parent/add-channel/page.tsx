import { redirect } from "next/navigation";
import { BackHeader } from "@/components/chrome";
import { requireMe } from "@/lib/auth";
import { getProfiles } from "@/lib/parent-data";
import { createClient } from "@/lib/supabase/server";
import { AddChannelClient } from "./add-channel-client";

export default async function AddChannelPage({ searchParams }: PageProps<"/parent/add-channel">) {
  const me = await requireMe("parent");
  const { kid } = await searchParams;
  const profiles = await getProfiles(me.familyId);
  const profile = profiles.find((p) => p.id === kid);
  if (!profile) redirect("/parent/channels");

  const supabase = await createClient();
  const { data: states } = await supabase.from("channel_states").select("channel_id, status").eq("profile_id", profile.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader href={`/parent/channels?kid=${profile.id}`} label="채널 관리" />
      <AddChannelClient
        profileId={profile.id}
        kidName={profile.name}
        initialStates={Object.fromEntries((states ?? []).map((s) => [s.channel_id, s.status]))}
      />
    </div>
  );
}
