import { sampleReport } from "@/lib/stats/sampleGame";
import { ruleBasedRecap } from "@/lib/stats/gameReport";
import InfographicClient from "@/components/infographic/InfographicClient";
import { anton, oswald } from "@/components/infographic/fonts";

/**
 * Static demo of the infographic rendered from the exact Beerkats reference
 * game (no DB needed). Lets us visually verify the design and confirms the
 * computed numbers match the reference (.636 / .654 / 1.068 / 1.722).
 */
export default function InfographicDemoPage() {
  const report = sampleReport();
  const bullets = ruleBasedRecap(report);

  return (
    <main className={`${anton.variable} ${oswald.variable} min-h-screen p-4 max-w-3xl mx-auto`}>
      <h1 className="text-2xl font-bold mb-1">Infographic Demo</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Rendered from the reference Beerkats game · stats computed by the engine
      </p>
      <InfographicClient
        report={report}
        gameId="demo"
        initialBullets={bullets}
        recapSource="fallback"
      />
    </main>
  );
}
