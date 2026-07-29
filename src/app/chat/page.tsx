import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ChatClient from "@/components/stats/ChatClient";
import BrandLogo from "@/components/BrandLogo";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // LLM calls cost money — signed-in teammates only.
  if (!user) redirect("/login?redirect=/chat");

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={32} className="rounded-md" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Coach</h1>
            <p className="text-xs text-muted-foreground">AI over your season stats</p>
          </div>
        </div>
        <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
          Stats
        </Link>
      </div>
      <ChatClient />
    </main>
  );
}
