import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";

export default async function Home() {
  const me = await requireMe();
  redirect(me.role === "parent" ? "/parent" : "/kid");
}
