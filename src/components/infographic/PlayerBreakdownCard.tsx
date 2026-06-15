import { C, INFOGRAPHIC_WIDTH } from "./theme";
import BeerkatsLogo from "./BeerkatsLogo";
import { formatStat } from "@/lib/stats/compute";
import type { GameReport } from "@/lib/stats/gameReport";

const anton = "var(--font-anton), sans-serif";
const oswald = "var(--font-oswald), sans-serif";

function Banner({ children, width = 360 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      style={{
        background: C.ink, color: C.card, fontFamily: anton, fontSize: 22,
        letterSpacing: 3, textAlign: "center", padding: "10px 40px", width, margin: "0 auto",
        clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)",
      }}
    >
      <span style={{ color: C.gold }}>★</span>{"  "}{children}{"  "}<span style={{ color: C.gold }}>★</span>
    </div>
  );
}

export default function PlayerBreakdownCard({ report }: { report: GameReport }) {
  const players = report.players;
  const mainCols = ["PA", "AB", "H", "BB", "SF", "RBI", "TB", "AVG", "OBP", "SLG", "OPS"];

  const th: React.CSSProperties = {
    fontFamily: oswald, fontWeight: 700, fontSize: 13, color: C.card,
    padding: "11px 4px", textAlign: "center", letterSpacing: 0.5,
  };
  const td: React.CSSProperties = {
    fontFamily: oswald, fontSize: 14, color: C.ink, padding: "9px 4px", textAlign: "center",
  };
  const tdRate: React.CSSProperties = { ...td, fontFamily: anton, fontSize: 14.5, color: C.teal };

  return (
    <div
      id="player-breakdown-card"
      style={{
        width: INFOGRAPHIC_WIDTH, background: C.cream, padding: 36,
        fontFamily: oswald, color: C.ink, boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <BeerkatsLogo size={130} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: anton, fontSize: 58, lineHeight: 0.92, color: C.ink, letterSpacing: 1 }}>
            {report.teamName.toUpperCase()}
          </div>
          <div style={{ fontFamily: anton, fontSize: 44, lineHeight: 0.95, color: C.teal, letterSpacing: 1 }}>
            PLAYER BREAKDOWN
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, justifyContent: "center" }}>
            <span style={{ color: C.gold }}>⚾</span>
            <span style={{ fontFamily: oswald, fontStyle: "italic", fontWeight: 700, letterSpacing: 2, color: C.gold, fontSize: 18 }}>
              {report.seasonLabel}
            </span>
            <span style={{ color: C.gold }}>⚾</span>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div style={{ marginTop: 20, borderRadius: 12, overflow: "hidden", border: `2px solid ${C.ink}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.ink }}>
              <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>PLAYER</th>
              {mainCols.map((c) => (
                <th key={c} style={th}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.playerId} style={{ background: i % 2 === 0 ? C.card : "#F1EAD6" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 16, fontWeight: 700 }}>{p.name}</td>
                <td style={td}>{p.pa}</td>
                <td style={td}>{p.ab}</td>
                <td style={{ ...td, fontWeight: 700 }}>{p.h}</td>
                <td style={td}>{p.bb}</td>
                <td style={td}>{p.sf}</td>
                <td style={td}>{p.rbi}</td>
                <td style={td}>{p.tb}</td>
                <td style={tdRate}>{formatStat(p.avg, "avg")}</td>
                <td style={tdRate}>{formatStat(p.obp, "obp")}</td>
                <td style={tdRate}>{formatStat(p.slg, "slg")}</td>
                <td style={{ ...tdRate, color: C.gold }}>{formatStat(p.ops, "ops")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hit breakdown */}
      <div style={{ marginTop: 26 }}>
        <Banner width={320}>HIT BREAKDOWN</Banner>
      </div>

      <div style={{ marginTop: 16, borderRadius: 12, overflow: "hidden", border: `2px solid ${C.ink}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.teal }}>
              <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>PLAYER</th>
              <th style={th}>1B</th>
              <th style={th}>2B</th>
              <th style={th}>3B</th>
              <th style={th}>HR</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.playerId} style={{ background: i % 2 === 0 ? C.card : "#F1EAD6" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 16, fontWeight: 700 }}>{p.name}</td>
                <td style={td}>{p.b1}</td>
                <td style={td}>{p.b2}</td>
                <td style={td}>{p.b3}</td>
                <td style={{ ...td, fontWeight: 700, color: p.hr > 0 ? C.gold : C.ink }}>{p.hr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer scoring notes */}
      <div
        style={{
          background: C.ink, borderRadius: 8, marginTop: 22, padding: "14px 20px",
          display: "flex", gap: 14, alignItems: "center",
        }}
      >
        <span style={{ fontFamily: anton, color: C.gold, fontSize: 15, letterSpacing: 1, whiteSpace: "nowrap" }}>
          SCORING NOTES:
        </span>
        <span style={{ fontFamily: oswald, color: C.card, fontSize: 13, lineHeight: 1.4 }}>
          Walks and sac flies do not count as at-bats. Fielder&apos;s choice counts as an at-bat and not a hit.
          AVG = H/AB · OBP = (H+BB)/(AB+BB+SF) · SLG = TB/AB · OPS = OBP+SLG.
        </span>
      </div>
    </div>
  );
}
