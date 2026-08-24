import { redirect } from "next/navigation";
import { listHosts } from "@/lib/ssh-config";
import { getSessionUser } from "@/lib/session";
import { SshManager } from "@/components/ssh/SshManager";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const hosts = listHosts();
  return <SshManager hosts={hosts} />;
}
