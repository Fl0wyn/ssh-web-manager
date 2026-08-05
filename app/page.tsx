import { listHosts } from "@/lib/ssh-config";
import { SshManager } from "@/components/ssh/SshManager";

export default function Home() {
  const hosts = listHosts();
  return <SshManager hosts={hosts} />;
}
