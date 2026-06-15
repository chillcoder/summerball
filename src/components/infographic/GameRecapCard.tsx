import { C, INFOGRAPHIC_WIDTH } from "./theme";
import BeerkatsLogo from "./BeerkatsLogo";
import { formatStat } from "@/lib/stats/compute";
import { joinNames, type GameReport } from "@/lib/stats/gameReport";
import {
  HomePlateIcon, BatterIcon, BatIcon, WalkIcon, WingedBallIcon,
  DiamondIcon, BallIcon, ShieldIcon, BarsIcon, TargetIcon,
  MotionBallIcon, CrossedBatsIcon,
} from "./icons";

const anton = "var(--font-anton), sans-serif";
const oswald = "var(--font-oswald), sans-serif";

function Banner({ children, width = 360 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      style={{
        background: C.ink,
        color: C.card,
        fontFamily: anton,
        fontSize: 22,
        letterSpacing: 3,
        textAlign: "center",
        padding: "10px 40px",
        width,
        margin: "0 auto",
        clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)",
      }}
    >
      <span style={{ color: C.gold }}>★</span>{"  "}{children}{"  "}<span style={{ color: C.gold }}>★</span>
    </div>
  );
}

function Tile({
  icon, label, value, valueColor = C.ink,
}: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        background: C.card,
        border: `2px solid ${C.cardLine}`,
        borderRadius: 12,
        padding: "14px 6px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon}
      <div style={{ fontFamily: oswald, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, color: C.inkSoft, textTransform: "uppercase", textAlign: "center", lineHeight: 1.1, minHeight: 24, display: "flex", alignItems: "center" }}>
        {label}
      </div>
      <div style={{ fontFamily: anton, fontSize: 30, color: valueColor, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function LeaderRow({ icon, label, names, value }: { icon: React.ReactNode; label: string; names: string[]; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px dotted ${C.line}` }}>
      <div style={{ width: 22, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: C.ink, textTransform: "uppercase", width: 118 }}>{label}</div>
      <div style={{ fontFamily: oswald, fontSize: 13, color: C.inkSoft, flex: 1 }}>{joinNames(names) || "—"}</div>
      <div style={{ fontFamily: anton, fontSize: 17, color: C.teal }}>{value}</div>
    </div>
  );
}

export default function GameRecapCard({ report, bullets }: { report: GameReport; bullets: string[] }) {
  const t = report.teamTotals;
  const leader = (k: string) => report.leaders.find((l) => l.key === k) ?? { names: [], value: "—" };

  return (
    <div
      id="game-recap-card"
      style={{
        width: INFOGRAPHIC_WIDTH,
        background: C.cream,
        padding: 36,
        fontFamily: oswald,
        color: C.ink,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <BeerkatsLogo size={150} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: anton, fontSize: 62, lineHeight: 0.92, color: C.ink, letterSpacing: 1 }}>
            {report.teamName.toUpperCase()}
          </div>
          <div style={{ fontFamily: anton, fontSize: 50, lineHeight: 0.95, color: C.teal, letterSpacing: 1 }}>
            GAME RECAP
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, justifyContent: "center" }}>
            <span style={{ color: C.gold }}>⚾</span>
            <span style={{ fontFamily: oswald, fontWeight: 700, letterSpacing: 4, color: C.gold, fontSize: 16 }}>
              {report.seasonLabel.toUpperCase()}
            </span>
            <span style={{ color: C.gold }}>⚾</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Banner width={300}>TEAM READOUT</Banner>
      </div>

      {/* Hero stat bar */}
      <div
        style={{
          background: C.ink,
          borderRadius: 14,
          marginTop: 16,
          padding: "18px 26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          border: `3px solid ${C.gold}`,
        }}
      >
        <CrossedBatsIcon size={40} color={C.sage} />
        {[
          { v: formatStat(t.avg, "avg"), l: "AVG" },
          { v: formatStat(t.obp, "obp"), l: "OBP" },
          { v: formatStat(t.slg, "slg"), l: "SLG" },
          { v: formatStat(t.ops, "ops"), l: "OPS" },
        ].map((s, i) => (
          <div key={s.l} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: anton, fontSize: 38, color: C.card }}>{s.v}</span>
            <span style={{ fontFamily: oswald, fontWeight: 700, fontSize: 14, color: C.sage, letterSpacing: 1 }}>{s.l}</span>
            {i < 3 && <span style={{ color: C.gold, fontSize: 32, marginLeft: 8 }}>/</span>}
          </div>
        ))}
      </div>

      {/* Team totals */}
      <div style={{ marginTop: 22 }}>
        <Banner width={300}>TEAM TOTALS</Banner>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 8, marginTop: 16 }}>
        <Tile icon={<HomePlateIcon />} label="Plate Appearances" value={String(t.pa)} />
        <Tile icon={<BatterIcon />} label="At-Bats" value={String(t.ab)} />
        <Tile icon={<BatIcon />} label="Hits" value={String(t.hits)} />
        <Tile icon={<WalkIcon />} label="Walks" value={String(t.walks)} />
        <Tile icon={<WingedBallIcon />} label="Sac Flies" value={String(t.sacFlies)} />
        <Tile icon={<DiamondIcon label="1B" />} label="Singles" value={String(t.singles)} />
        <Tile icon={<DiamondIcon label="2B" />} label="Doubles" value={String(t.doubles)} />
        <Tile icon={<DiamondIcon label="3B" />} label="Triples" value={String(t.triples)} />
        <Tile icon={<BallIcon />} label="Total Bases" value={String(t.totalBases)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 8 }}>
        <Tile icon={<ShieldIcon color={C.gold} />} label="RBI" value={String(t.rbi)} valueColor={C.gold} />
        <Tile icon={<BarsIcon color={C.gold} />} label="Batting Average" value={formatStat(t.avg, "avg")} valueColor={C.gold} />
        <Tile icon={<TargetIcon color={C.gold} />} label="On-Base Percentage" value={formatStat(t.obp, "obp")} valueColor={C.gold} />
        <Tile icon={<MotionBallIcon color={C.gold} />} label="Slugging Percentage" value={formatStat(t.slg, "slg")} valueColor={C.gold} />
        <Tile icon={<CrossedBatsIcon color={C.gold} />} label="OPS" value={formatStat(t.ops, "ops")} valueColor={C.gold} />
      </div>

      {/* Leaders + Recap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
        <div style={{ background: C.card, border: `2px solid ${C.cardLine}`, borderRadius: 12, padding: "8px 18px 14px" }}>
          <div style={{ marginTop: -22, marginBottom: 8 }}>
            <Banner width={210}>LEADERS</Banner>
          </div>
          <LeaderRow icon={<BarsIcon size={18} />} label="Batting Avg" names={leader("avg").names} value={leader("avg").value} />
          <LeaderRow icon={<BatIcon size={18} />} label="Hits" names={leader("hits").names} value={leader("hits").value} />
          <LeaderRow icon={<ShieldIcon size={18} />} label="RBI" names={leader("rbi").names} value={leader("rbi").value} />
          <LeaderRow icon={<CrossedBatsIcon size={18} />} label="Total Bases" names={leader("tb").names} value={leader("tb").value} />
          <LeaderRow icon={<BallIcon size={18} />} label="Home Runs" names={leader("hr").names} value={leader("hr").value} />
          <LeaderRow icon={<DiamondIcon size={18} label="2B" />} label="Doubles" names={leader("b2").names} value={leader("b2").value} />
          <LeaderRow icon={<DiamondIcon size={18} label="3B" />} label="Triples" names={leader("b3").names} value={leader("b3").value} />
          <LeaderRow icon={<TargetIcon size={18} />} label="OBP" names={leader("obp").names} value={leader("obp").value} />
          <LeaderRow icon={<MotionBallIcon size={18} />} label="SLG" names={leader("slg").names} value={leader("slg").value} />
          <LeaderRow icon={<CrossedBatsIcon size={18} />} label="OPS" names={leader("ops").names} value={leader("ops").value} />
        </div>

        <div style={{ background: C.card, border: `2px solid ${C.cardLine}`, borderRadius: 12, padding: "8px 18px 16px" }}>
          <div style={{ marginTop: -22, marginBottom: 12 }}>
            <Banner width={230}>QUICK RECAP</Banner>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <BallIcon size={48} color={C.gold} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: C.gold, fontSize: 14, lineHeight: 1.4 }}>★</span>
                <span style={{ fontFamily: oswald, fontSize: 14.5, color: C.ink, lineHeight: 1.35, fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: C.ink,
          borderRadius: 8,
          marginTop: 22,
          padding: "12px",
          textAlign: "center",
          fontFamily: anton,
          letterSpacing: 3,
          fontSize: 18,
          color: C.gold,
        }}
      >
        ★ ★&nbsp;&nbsp;GOOD SWINGS. COLD DRINKS. {report.teamName.toUpperCase()} WINS.&nbsp;&nbsp;★ ★
      </div>
    </div>
  );
}
