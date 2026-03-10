import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";

type SessionCol = { sessionId: string; dateISO: string; note?: string | null; id?: string };
type CellData = { seconds: number | null; note: string | null };
type Row = { participantId: string; name: string; isRegular: boolean };

type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, CellData>>;
};

type ViolationEntry = {
  id: string;
  participantId: string;
  participantName: string;
  ruleCode: string;
  reason?: string | null;
  crosses: number;
};

type AttemptStat = {
  participantId: string;
  name: string;
  isRegular: boolean;
  seconds: number;
  note: string | null;
  violations: string[];
  pbBefore: number | null;
  projected: number | null;
  diffPb: number | null;
  diffProjected: number | null;
  lastTime: number | null;
};

const AVATAR_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];

const RULE_COLORS: Record<string, string> = {
  DNS: "#ef4444",
  DNF: "#f97316",
  MM: "#86efac",
  W: "#3b82f6",
  VW: "#1e3a8a",
  P: "#ec4899",
  ABSENCE: "#94a3b8",
  VOMIT: "#84cc16",
  KPR: "#06b6d4",
};

const FALLBACK_PIE_COLOR = "#a8a29e";

const TOOLTIP_STYLE = {
  background: "rgba(15, 23, 42, 0.98)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  color: "#f8fafc",
};

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function fmtSeconds(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(2)}s`;
}

function getRuleLabel(code: string) {
  const labels: Record<string, string> = {
    DNS: "Did not start",
    DNF: "Did not finish",
    MM: "Mildly moist",
    W: "Wet",
    VW: "Very wet",
    P: "Puke",
    ABSENCE: "Fravær",
    VOMIT: "Oppkast",
    KPR: "Klage på regel",
  };
  return labels[code] || code;
}

const personLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  color: "white",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  borderRadius: 8,
  transition: "all 0.18s ease",
  textDecoration: "underline",
  textDecorationColor: "transparent",
  textUnderlineOffset: "0.18em",
};

const tablePersonLinkStyle: React.CSSProperties = {
  padding: 0,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: "bold",
  color: "var(--text)",
  textDecoration: "underline",
  textDecorationColor: "transparent",
  textUnderlineOffset: "0.18em",
  transition: "all 0.18s ease",
};

const CustomBarLabel = (props: any) => {
  const { x, y, width, violations, note } = props;
  const hasViolations = Array.isArray(violations) && violations.length > 0;
  const hasNote = !!note;

  if (!hasViolations && !hasNote) return null;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null;

  const dotY = y - 8;
  const centerX = x + width / 2;

  return (
    <g>
      {hasViolations && (
        <circle
          cx={hasNote ? centerX - 6 : centerX}
          cy={dotY}
          r={4.5}
          fill="var(--danger)"
        />
      )}
      {hasNote && (
        <circle
          cx={hasViolations ? centerX + 6 : centerX}
          cy={dotY}
          r={4.5}
          fill="#facc15"
        />
      )}
    </g>
  );
};

export function SessionPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [tableData, setTableData] = useState<TableResponse | null>(null);
  const [sessions, setSessions] = useState<SessionCol[]>([]);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      fetch(`/api/stats/table?semester=all`).then((r) => r.json()),
      fetch(`/api/sessions`).then((r) => r.json()),
      fetch(`/api/violations?sessionId=${id}`).then((r) => r.json()),
    ])
      .then(([tData, sData, vData]) => {
        setTableData(tData);
        setSessions(sData);
        setViolations(vData);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [id]);

  const sessionStats = useMemo(() => {
    if (!tableData || !sessions.length || !id) return null;

    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );

    const currentIndex = sortedSessions.findIndex((s) => (s.id || s.sessionId) === id);
    if (currentIndex === -1) return null;

    const currentSession = sortedSessions[currentIndex];
    const prevSessionId =
      currentIndex > 0
        ? sortedSessions[currentIndex - 1].id || sortedSessions[currentIndex - 1].sessionId
        : null;
    const nextSessionId =
      currentIndex < sortedSessions.length - 1
        ? sortedSessions[currentIndex + 1].id || sortedSessions[currentIndex + 1].sessionId
        : null;

    const historySessions = sortedSessions.slice(0, currentIndex);

    const allSessionsStats = sortedSessions
      .map((s) => {
        const sid = s.id || s.sessionId;
        let count = 0;
        let totalSec = 0;

        tableData.rows.forEach((r) => {
          const cell = tableData.cells[r.participantId]?.[sid];
          if (cell && typeof cell.seconds === "number" && cell.seconds > 0) {
            count++;
            totalSec += cell.seconds;
          }
        });

        return { sid, count, avg: count > 0 ? totalSec / count : null };
      })
      .filter((s) => s.count > 0);

    const sortedByAvg = [...allSessionsStats].sort((a, b) => a.avg! - b.avg!);
    const avgRank = sortedByAvg.findIndex((s) => s.sid === id) + 1;

    const sortedByCount = [...allSessionsStats].sort((a, b) => b.count - a.count);
    const countRank = sortedByCount.findIndex((s) => s.sid === id) + 1;

    const attempts: AttemptStat[] = [];
    let totalSeconds = 0;
    let wetCount = 0;

    tableData.rows.forEach((row) => {
      const cell = tableData.cells[row.participantId]?.[id];
      if (!cell || cell.seconds == null) return;

      const participantViolations = violations
        .filter((v) => v.participantId === row.participantId)
        .map((v) => v.ruleCode);

      if (participantViolations.some((v) => ["W", "VW", "MM", "P", "T"].includes(v))) {
        wetCount++;
      }

      const historyTimes = historySessions
        .map((s) => tableData.cells[row.participantId]?.[s.id || s.sessionId]?.seconds)
        .filter((sec): sec is number => sec != null);

      const pbBefore = historyTimes.length > 0 ? Math.min(...historyTimes) : null;
      const lastTime = historyTimes.length > 0 ? historyTimes[historyTimes.length - 1] : null;

      let projected = null;
      if (historyTimes.length >= 2) {
        const n = historyTimes.length;
        const sumX = historyTimes.map((_, i) => i).reduce((a, b) => a + b, 0);
        const sumY = historyTimes.reduce((a, b) => a + b, 0);
        const sumXY = historyTimes.map((pt, i) => i * pt).reduce((a, b) => a + b, 0);
        const sumXX = historyTimes.map((_, i) => i * i).reduce((a, b) => a + b, 0);
        const denom = n * sumXX - sumX * sumX;
        const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        const b = (sumY - m * sumX) / n;
        projected = Math.max(0, m * n + b);
      }

      attempts.push({
        participantId: row.participantId,
        name: row.name,
        isRegular: row.isRegular,
        seconds: cell.seconds,
        note: cell.note,
        violations: participantViolations,
        pbBefore,
        projected,
        diffPb: pbBefore !== null ? cell.seconds - pbBefore : null,
        diffProjected: projected !== null ? cell.seconds - projected : null,
        lastTime,
      });

      totalSeconds += cell.seconds;
    });

    attempts.sort((a, b) => a.seconds - b.seconds);

    const allHistoricalTimes = Object.values(tableData.cells)
      .flatMap((participantCells) => Object.values(participantCells))
      .map((cell) => cell.seconds)
      .filter((sec): sec is number => typeof sec === "number" && sec > 0)
      .sort((a, b) => a - b);

    const fastest = attempts[0] || null;
    const slowest = attempts[attempts.length - 1] || null;

    const fastestGlobalRank =
      fastest != null ? allHistoricalTimes.findIndex((t) => t === fastest.seconds) + 1 : null;

    const slowestGlobalRank =
      slowest != null
        ? [...allHistoricalTimes].sort((a, b) => b - a).findIndex((t) => t === slowest.seconds) + 1
        : null;

    return {
      dateISO: currentSession.dateISO,
      note: currentSession.note,
      participantCount: attempts.length,
      avgTime: attempts.length > 0 ? totalSeconds / attempts.length : null,
      fastest,
      slowest,
      fastestGlobalRank,
      slowestGlobalRank,
      totalHistoricalAttempts: allHistoricalTimes.length,
      wetRate: attempts.length > 0 ? (wetCount / attempts.length) * 100 : 0,
      attempts,
      avgRank,
      totalSessionsWithAvg: sortedByAvg.length,
      countRank,
      totalSessionsWithCount: sortedByCount.length,
      prevSessionId,
      nextSessionId,
    };
  }, [tableData, sessions, violations, id]);

  const groupedViolations = useMemo(() => {
    const map = new Map<
      string,
      { name: string; codes: string[]; totalCrosses: number; notes: string[] }
    >();

    violations.forEach((v) => {
      const existing = map.get(v.participantId);
      if (existing) {
        existing.codes.push(v.ruleCode);
        existing.totalCrosses += v.crosses;
        if (v.reason) existing.notes.push(v.reason);
      } else {
        map.set(v.participantId, {
          name: v.participantName,
          codes: [v.ruleCode],
          totalCrosses: v.crosses,
          notes: v.reason ? [v.reason] : [],
        });
      }
    });

    return Array.from(map.entries()).map(([participantId, data]) => ({
      participantId,
      ...data,
    }));
  }, [violations]);

  const pieData = useMemo(() => {
    const counts = violations.reduce((acc, v) => {
      acc[v.ruleCode] = (acc[v.ruleCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([name, value]) => ({
      name,
      label: getRuleLabel(name),
      value,
    }));
  }, [violations]);

  const pbData = useMemo(
    () =>
      sessionStats?.attempts
        .filter((a) => a.diffPb !== null)
        .map((a) => ({
          ...a,
          pbDelta: a.diffPb!,
        })) ?? [],
    [sessionStats]
  );

  const gapToWinnerData = useMemo(() => {
    if (!sessionStats || sessionStats.attempts.length === 0) return [];
    const best = sessionStats.attempts[0].seconds;

    return sessionStats.attempts.map((a) => ({
      name: a.name,
      seconds: a.seconds,
      gap: a.seconds - best,
    }));
  }, [sessionStats]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 100, textAlign: "center" }}>
        Laster dagens resultater...
      </div>
    );
  }

  if (!sessionStats) {
    return (
      <div className="container" style={{ paddingTop: 100, textAlign: "center" }}>
        Fant ikke denne chugge-dagen.
      </div>
    );
  }

  const validProjected = sessionStats.attempts.filter((a) => a.diffProjected !== null);

  const bestProjected =
    validProjected.length > 0
      ? validProjected.reduce((prev, curr) =>
          curr.diffProjected! < prev.diffProjected! ? curr : prev
        )
      : null;

  const worstProjected =
    validProjected.length > 0
      ? validProjected.reduce((prev, curr) =>
          curr.diffProjected! > prev.diffProjected! ? curr : prev
        )
      : null;

  const bestPbSmasher = sessionStats.attempts
    .filter((a) => a.diffPb !== null && a.diffPb < 0)
    .reduce(
      (prev, curr) => (prev === null || curr.diffPb! < prev.diffPb! ? curr : prev),
      null as AttemptStat | null
    );

  const steadyHand =
    validProjected.length > 0
      ? validProjected.reduce((prev, curr) =>
          Math.abs(curr.diffProjected!) < Math.abs(prev.diffProjected!) ? curr : prev
        )
      : null;

  const closeCalls = sessionStats.attempts.filter(
    (a) => a.diffPb !== null && a.diffPb > 0 && a.diffPb <= 0.3
  );

  const closestCall =
    closeCalls.length > 0
      ? closeCalls.reduce((prev, curr) => (curr.diffPb! < prev.diffPb! ? curr : prev))
      : null;

  const comebacks = sessionStats.attempts.filter(
    (a) => a.lastTime !== null && a.lastTime - a.seconds > 0
  );

  const biggestComeback =
    comebacks.length > 0
      ? comebacks.reduce((prev, curr) =>
          curr.lastTime! - curr.seconds > prev.lastTime! - prev.seconds ? curr : prev
        )
      : null;

  const isAllTimeFastest = sessionStats.fastestGlobalRank === 1;
  const isAllTimeSlowest = sessionStats.slowestGlobalRank === 1;

  const PersonName = ({
    personId,
    name,
  }: {
    personId: string;
    name: string;
  }) => (
    <button
      type="button"
      onClick={() => nav(`/person/${personId}`)}
      style={personLinkStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecorationColor = "rgba(255,255,255,0.8)";
        e.currentTarget.style.opacity = "0.88";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecorationColor = "transparent";
        e.currentTarget.style.opacity = "1";
      }}
    >
      {name}
    </button>
  );

  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button className="btn" onClick={() => nav("/chug")}>
          ← Tilbake til oversikt
        </button>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {sessionStats.prevSessionId && (
            <button
              className="btn"
              style={{ background: "rgba(255,255,255,0.05)" }}
              onClick={() => nav(`/session/${sessionStats.prevSessionId}`)}
            >
              « Forrige dag
            </button>
          )}

          {sessionStats.nextSessionId && (
            <button
              className="btn"
              style={{ background: "rgba(255,255,255,0.05)" }}
              onClick={() => nav(`/session/${sessionStats.nextSessionId}`)}
            >
              Neste dag »
            </button>
          )}
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: 24,
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        }}
      >
        <h1 style={{ fontSize: "2.4rem", marginBottom: 8 }}>
          Resultater: {fmtDate(sessionStats.dateISO)}
        </h1>
        {sessionStats.note && (
          <div
            style={{
              fontSize: "1.05rem",
              color: "var(--accent2)",
              fontStyle: "italic",
              background: "rgba(255,255,255,0.05)",
              padding: "10px 15px",
              borderRadius: 12,
              display: "inline-block",
            }}
          >
            "{sessionStats.note}"
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "20px 10px",
            ...(sessionStats.avgRank === 1
              ? {
                  border: "2px solid rgba(250, 204, 21, 0.8)",
                  background: "linear-gradient(180deg, rgba(250,204,21,0.1), rgba(255,255,255,0.02))",
                }
              : {}),
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              color: sessionStats.avgRank === 1 ? "#facc15" : "var(--muted)",
              marginBottom: 6,
              fontWeight: "bold",
            }}
          >
            {sessionStats.avgRank === 1 && "🏆 "}Gjennomsnitt
          </div>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 900,
              color: sessionStats.avgRank === 1 ? "#facc15" : "var(--accent)",
              textShadow: sessionStats.avgRank === 1 ? "0 0 15px rgba(250,204,21,0.5)" : "none",
            }}
          >
            {sessionStats.avgTime?.toFixed(2)}s
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
            #{sessionStats.avgRank}/{sessionStats.totalSessionsWithAvg} raskeste snitt
          </div>
        </div>

        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "20px 10px",
            ...(sessionStats.countRank === 1
              ? {
                  border: "2px solid rgba(250, 204, 21, 0.8)",
                  background: "linear-gradient(180deg, rgba(250,204,21,0.1), rgba(255,255,255,0.02))",
                }
              : {}),
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              color: sessionStats.countRank === 1 ? "#facc15" : "var(--muted)",
              marginBottom: 6,
              fontWeight: "bold",
            }}
          >
            {sessionStats.countRank === 1 && "🔥 "}Antall Chuggere
          </div>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 900,
              color: sessionStats.countRank === 1 ? "#facc15" : "white",
              textShadow: sessionStats.countRank === 1 ? "0 0 15px rgba(250,204,21,0.5)" : "none",
            }}
          >
            {sessionStats.participantCount}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
            #{sessionStats.countRank}/{sessionStats.totalSessionsWithCount} beste oppmøte
          </div>
        </div>

        {sessionStats.fastest && (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "20px 10px",
              ...(isAllTimeFastest
                ? {
                    border: "2px solid rgba(250, 204, 21, 0.85)",
                    background: "linear-gradient(180deg, rgba(250,204,21,0.12), rgba(255,255,255,0.02))",
                    boxShadow: "0 0 24px rgba(250, 204, 21, 0.18)",
                  }
                : {}),
            }}
          >
            <div
              style={{
                color: isAllTimeFastest ? "#facc15" : "#10b981",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              {isAllTimeFastest ? "🏆 Raskest i dag • All-time rekord" : "⚡ Raskest i dag"}
            </div>

            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: isAllTimeFastest ? "#fef08a" : "white",
                textShadow: isAllTimeFastest ? "0 0 14px rgba(250,204,21,0.35)" : "none",
              }}
            >
              <PersonName
                personId={sessionStats.fastest.participantId}
                name={sessionStats.fastest.name}
              />
            </div>

            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: isAllTimeFastest ? "#fef08a" : "white",
              }}
            >
              {sessionStats.fastest.seconds.toFixed(2)}s
            </div>

            <div style={{ fontSize: "0.8rem", opacity: 0.65, marginTop: 4 }}>
              #{sessionStats.fastestGlobalRank}/{sessionStats.totalHistoricalAttempts} raskeste tid noensinne
            </div>
          </div>
        )}

        {sessionStats.slowest && (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "20px 10px",
              ...(isAllTimeSlowest
                ? {
                    border: "2px solid rgba(239, 68, 68, 0.8)",
                    background: "linear-gradient(180deg, rgba(239,68,68,0.12), rgba(255,255,255,0.02))",
                    boxShadow: "0 0 24px rgba(239, 68, 68, 0.16)",
                  }
                : {}),
            }}
          >
            <div
              style={{
                color: isAllTimeSlowest ? "#f87171" : "var(--danger)",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              {isAllTimeSlowest ? "💀 Tregest i dag • All-time bunnrekord" : "🐢 Tregest i dag"}
            </div>

            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: isAllTimeSlowest ? "#fca5a5" : "white",
                textShadow: isAllTimeSlowest ? "0 0 14px rgba(239,68,68,0.28)" : "none",
              }}
            >
              <PersonName
                personId={sessionStats.slowest.participantId}
                name={sessionStats.slowest.name}
              />
            </div>

            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: isAllTimeSlowest ? "#fecaca" : "white",
              }}
            >
              {sessionStats.slowest.seconds.toFixed(2)}s
            </div>

            <div style={{ fontSize: "0.8rem", opacity: 0.65, marginTop: 4 }}>
              #{sessionStats.slowestGlobalRank}/{sessionStats.totalHistoricalAttempts} tregeste tid noensinne
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {bestProjected && bestProjected.diffProjected! < 0 && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--accent)",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              📈 Overgikk Forventningene
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={bestProjected.participantId} name={bestProjected.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Faktisk tid: <b>{bestProjected.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#10b981" }}>
              {Math.abs(bestProjected.diffProjected!).toFixed(2)}s raskere enn projisert.
            </div>
          </div>
        )}

        {worstProjected && worstProjected.diffProjected! > 0 && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--danger)",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              📉 Skuffet Mest
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={worstProjected.participantId} name={worstProjected.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Faktisk tid: <b>{worstProjected.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--danger)" }}>
              {worstProjected.diffProjected!.toFixed(2)}s tregere enn projisert.
            </div>
          </div>
        )}

        {bestPbSmasher && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, #facc15 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#facc15",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              🔥 Knuste Egen Rekord
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={bestPbSmasher.participantId} name={bestPbSmasher.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Ny rekord: <b>{bestPbSmasher.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#10b981" }}>
              Forbedret PB med {Math.abs(bestPbSmasher.diffPb!).toFixed(2)}s!
            </div>
          </div>
        )}

        {biggestComeback && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, #06b6d4 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#06b6d4",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              🚀 Dagens Comeback
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={biggestComeback.participantId} name={biggestComeback.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Faktisk tid: <b>{biggestComeback.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#10b981" }}>
              {(biggestComeback.lastTime! - biggestComeback.seconds).toFixed(2)}s raskere enn
              sist!
            </div>
          </div>
        )}

        {steadyHand && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, #3b82f6 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#3b82f6",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              🎯 Stabilitets-prisen
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={steadyHand.participantId} name={steadyHand.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Faktisk tid: <b>{steadyHand.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Kun {Math.abs(steadyHand.diffProjected!).toFixed(2)}s avvik fra trend.
            </div>
          </div>
        )}

        {closestCall && (
          <div
            className="card"
            style={{
              padding: "16px",
              border: "1px solid color-mix(in srgb, #a855f7 30%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                color: "#a855f7",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              🤏 Nesten-rekord
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              <PersonName personId={closestCall.participantId} name={closestCall.name} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "4px 0" }}>
              Faktisk tid: <b>{closestCall.seconds.toFixed(2)}s</b>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Var kun {closestCall.diffPb!.toFixed(2)}s unna ny PB.
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Forventning vs. realitet</h2>
          <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 12 }}>
            Negativ verdi betyr raskere enn forventet.
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={validProjected} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted)"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis stroke="var(--muted)" tickFormatter={(v) => `${v}s`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => [
                    `${value > 0 ? "+" : ""}${value.toFixed(2)}s`,
                    "Avvik fra projisert tid",
                  ]}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                <Bar dataKey="diffProjected" radius={[8, 8, 0, 0]}>
                  {validProjected.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.diffProjected! < 0 ? "#10b981" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {pbData.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Avvik fra personlig rekord</h2>
            <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 12 }}>
              Negativ verdi betyr ny personlig rekord.
            </div>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={pbData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted)"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis stroke="var(--muted)" tickFormatter={(v) => `${v}s`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => [
                      `${value > 0 ? "+" : ""}${value.toFixed(2)}s`,
                      "Avvik fra PB",
                    ]}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                  <Bar dataKey="pbDelta" radius={[8, 8, 0, 0]}>
                    {pbData.map((entry, i) => (
                      <Cell key={i} fill={entry.pbDelta < 0 ? "#facc15" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Type kryss i dag</h2>
          {pieData.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 90, color: "var(--muted)" }}>
              Ingen kryss i dag! 🎉
            </div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    innerRadius={42}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={RULE_COLORS[entry.name as keyof typeof RULE_COLORS] || FALLBACK_PIE_COLOR}
                        stroke="rgba(15, 23, 42, 0.98)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number, _name, props: any) => [
                      `${value} stk`,
                      props?.payload?.label || props?.payload?.name || "Kryss",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Avstand opp til dagens raskeste</h2>
          <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 12 }}>
            Viser hvor mange sekunder hver deltaker var bak dagens beste tid.
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={gapToWinnerData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted)"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis stroke="var(--muted)" tickFormatter={(v) => `${v}s`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number, name: string, props: any) => {
                    if (name === "gap") {
                      return [`+${value.toFixed(2)}s`, "Bak dagens beste"];
                    }
                    return [fmtSeconds(props?.payload?.seconds), "Tid"];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                <Bar dataKey="gap" radius={[8, 8, 0, 0]}>
                  {gapToWinnerData.map((entry, i) => (
                    <Cell key={i} fill={entry.gap === 0 ? "#facc15" : getColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Tidsfordeling</h2>
        <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 12 }}>
          Røde og gule prikker markerer henholdsvis kryss og notat.
        </div>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <BarChart data={sessionStats.attempts} margin={{ top: 20, right: 10, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="name"
                stroke="var(--muted)"
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke="var(--muted)" tickFormatter={(v) => `${v}s`} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#ffffff", fontWeight: 700 }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value: number, name: string) => {
                  if (name === "seconds") return [fmtSeconds(value), "Tid"];
                  return [String(value), name];
                }}
              />
              {sessionStats.avgTime !== null && (
                <ReferenceLine
                  y={sessionStats.avgTime}
                  stroke="rgba(250,204,21,0.85)"
                  strokeDasharray="6 6"
                  label={{
                    value: `Snitt ${sessionStats.avgTime.toFixed(2)}s`,
                    position: "insideTopRight",
                    fill: "#facc15",
                    fontSize: 12,
                  }}
                />
              )}
              <Bar dataKey="seconds" fill="var(--accent)" radius={[8, 8, 0, 0]}>
                {sessionStats.attempts.map((entry, i) => (
                  <Cell key={i} fill={getColor(entry.name)} />
                ))}
                <LabelList dataKey="name" content={<CustomBarLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Kryss og anmerkninger</h2>
        {groupedViolations.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>
            En helt ren dag! 🎉
          </p>
        ) : (
          <div className="tableWrap" style={{ border: "none" }}>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: 10 }}>Navn</th>
                  <th style={{ padding: 10 }}>Koder</th>
                  <th style={{ padding: 10 }}>Totalt kryss</th>
                  <th style={{ padding: 10 }}>Notater</th>
                </tr>
              </thead>
              <tbody>
                {groupedViolations.map((v) => (
                  <tr
                    key={v.participantId}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td style={{ padding: 10 }}>
                      <button
                        type="button"
                        style={tablePersonLinkStyle}
                        onClick={() => nav(`/person/${v.participantId}`)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecorationColor = "rgba(255,255,255,0.75)";
                          e.currentTarget.style.opacity = "0.88";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecorationColor = "transparent";
                          e.currentTarget.style.opacity = "1";
                        }}
                      >
                        {v.name}
                      </button>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {v.codes.map((code, idx) => (
                          <span
                            key={idx}
                            className="badge"
                            style={{
                              borderColor: RULE_COLORS[code] || "var(--border)",
                              color: RULE_COLORS[code] || "white",
                            }}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: 10, color: "var(--danger)", fontWeight: "bold" }}>
                      {v.totalCrosses}
                    </td>
                    <td style={{ padding: 10, color: "var(--muted)", fontSize: "0.9rem" }}>
                      {v.notes.join(" | ") || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}