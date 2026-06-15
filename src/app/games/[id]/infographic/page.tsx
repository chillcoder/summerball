import { createClient } from "@/lib/supabase/server";
import { getGame } from "@/app/actions/games";
import { loadGameReport, getStoredRecap } from "@/lib/stats/loadReport";
import { generateRecap } from "@/lib/ai/recap";
import { ruleBasedRecap } from "@/lib/stats/gameReport";
import InfographicClient from "@/components/infographic/InfographicClient";
import { anton, oswald } from "@/components/infographic/fonts";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function InfographicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Gated to authenticated team members (admin + coach), per requirements.
  if (!user) redirect(`/login?redirect=/games/${id}/infographic`);

  const game = await getGame(id);
  if (!game) notFound();
  if (game.status !== "final") redirect(`/games/${id}/finalize`);

  const report = await loadGameReport(id);
  if (!report) notFound();

  // Prefer the recap stored at finalize time; generate on the fly if missing.
  let bullets = await getStoredRecap(id);
  let source: "ai" | "fallback" | "stored" = "stored";
  if (!bullets) {
    try {
      const generated = await generateRecap(report, user.id);
      bullets = generated.bullets;
      source = generated.source;
    } catch {
      bullets = ruleBasedRecap(report);
      source = "fallback";
    }
  }

  return (
    <main className={`${anton.variable} ${oswald.variable} min-h-screen p-4 max-w-3xl mx-auto`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Infographic</h1>
          <p className="text-muted-foreground text-sm">
            {report.teamName}{report.opponent ? ` vs ${report.opponent}` : ""} · {report.dateLabel}
          </p>
        </div>
        <Link href={`/games/${id}/summary`} className="text-sm text-muted-foreground hover:text-foreground">
          Done
        </Link>
      </div>

      <InfographicClient
        report={report}
        gameId={id}
        initialBullets={bullets}
        recapSource={source}
      />
    </main>
  );
}
