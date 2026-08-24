import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <LoginForm />
    </div>
  );
}
