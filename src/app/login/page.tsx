"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center space-y-2 p-6 rounded-lg border border-border">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a link to <span className="text-foreground">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
      />
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send magic link"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to record</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Magic link — no password needed
          </p>
        </div>
        <Suspense fallback={<div className="h-16" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
