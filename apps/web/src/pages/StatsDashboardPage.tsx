import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, Cell, Legend
} from "recharts";

type Semester = "all" | "2026V" | "2025H";

// Typer for Analytics-API
type AnalyticsResp = {
  semester: string;
  overview: { sessions: number; attempts: number };
  timeSeries: Array<{ dateISO: string; avg: number | null; attempts: number; wetRate: number }>;
  noteBreakdown: Record<string, number | undefined>;
};

// Typer for Table-API
type SessionCol = { sessionId: string; dateISO: string };
type TableCell = { seconds: number | null; note: string | null };
type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  bestOverall: number | null;
  avgOverall: number | null;
};
type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, TableCell>>;
};

type ParticipantStat = {
  participantId: string;
  name: string;
  isRegular: boolean;
  attempts: number;
  avg: number | null;
  noteCount: number;
};

type ViolationEntry = {
  participantId: string;
  ruleCode: string;
  dateISO: string;
};

function fmtDate(isoOrDate: string) {
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return isoOrDate;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// --- FARGE-GENERATOR FOR NAVN ---
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function StatsDashboardPage() {
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [tableData, setTableData] = useState<TableResponse | null>(null);

  // NY: State for å vise/skjule gjester med >= 4 chugs i scatterplottet
  const [showScatterGuests, setShowScatterGuests] = useState(false);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [resA, resT, resV] = await Promise.all([
        fetch(`/api/analytics?semester=${semester}`),
        fetch(`/api/stats/table?semester=${semester}`),
        fetch(`/api/violations?semester=${semester}`)
      ]);
      setData(await resA.json());
      setTableData(await resT.json());
      setViolations(await resV.json());
    })();
  }, [semester]);

  const participantStats: ParticipantStat[] = useMemo(() => {
    if (!tableData) return [];
    
    return tableData.rows.map(r => {
      let attempts = 0;
      let noteCount = 0;
      
      const pCells = tableData.cells[r.participantId] || {};
      
      Object.values(pCells).forEach(c => {
        if (c.seconds != null) attempts++;
        if (c.note) noteCount++;
      });

      return {
        participantId: r.participantId,
        name: r.name,
        isRegular: r.isRegular,
        attempts,
        avg: r.avgOverall,
        noteCount
      };
    });
  }, [tableData]);

  // --- FLETT SAMMEN API-DATA OG RASKEST/TREGEST FRA TABELL ---
  const timeSeriesData = useMemo(() => {
    const base = data?.timeSeries.map(x => {
      const wetCount = violations.filter(
        v => v.dateISO.slice(0, 10) === x.dateISO.slice(0, 10) &&
          (v.ruleCode === "W" || v.ruleCode === "VW" || v.ruleCode === "MM")
      ).length;
      return {
        ...x,
        dateFormatted: fmtDate(x.dateISO),
        wetPct: x.attempts > 0 ? (wetCount / x.attempts) * 100 : 0,
      };
    }) || [];

    if (!tableData) return base;

    return base.map(day => {
      const col = tableData.columns.find(c => c.dateISO === day.dateISO);
      
      let fastestTime = Infinity;
      let fastestPerson = "";
      let slowestTime = -Infinity;
      let slowestPerson = "";

      if (col) {
        tableData.rows.forEach(r => {
          const cell = tableData.cells[r.participantId]?.[col.sessionId];
          if (cell && cell.seconds != null) {
            if (cell.seconds < fastestTime) {
              fastestTime = cell.seconds;
              fastestPerson = r.name;
            }
            if (cell.seconds > slowestTime) {
              slowestTime = cell.seconds;
              slowestPerson = r.name;
            }
          }
        });
      }

      return {
        ...day,
        fastestTime: fastestTime !== Infinity ? fastestTime : null,
        fastestPerson,
        slowestTime: slowestTime !== -Infinity ? slowestTime : null,
        slowestPerson
      };
    });
  }, [data, tableData, violations]);

  const VIOLATION_BAR_COLORS: Record<string, string> = {
    MM: "#10b981", W: "#3b82f6", VW: "#6366f1", P: "#ef4444",
    DNS: "#f59e0b", DNF: "#f97316", VOMIT: "#ec4899", KPR: "#8b5cf6",
    ABSENCE: "#94a3b8"
  };
  const VIOLATION_BAR_LABELS: Record<string, string> = {
    MM: "MM", W: "Wet (W)", VW: "Very Wet (VW)", P: "Pause (P)",
    DNS: "DNS", DNF: "DNF", VOMIT: "Oppkast", KPR: "KPR", ABSENCE: "Fravær"
  };
  const violationCounts: Record<string, number> = {};
  violations.forEach(v => {
    violationCounts[v.ruleCode] = (violationCounts[v.ruleCode] || 0) + 1;
  });
  const noteBars = Object.entries(violationCounts)
    .filter(([_, count]) => count > 0)
    .map(([code, count]) => ({
      type: code,
      label: VIOLATION_BAR_LABELS[code] || code,
      count,
      color: VIOLATION_BAR_COLORS[code] || "#888"
    }))
    .sort((a, b) => b.count - a.count);

  const overallWetRate = useMemo(() => {
    if (!data?.overview?.attempts) return 0;
    const wetCount = violations.filter(v => v.ruleCode === "W" || v.ruleCode === "VW" || v.ruleCode === "MM").length;
    return (wetCount / data.overview.attempts) * 100;
  }, [violations, data]);

  const chugsPerSession = data?.overview.sessions ? (data.overview.attempts / data.overview.sessions) : 0;

  const validParticipants = participantStats.filter(p => p.attempts > 0 && p.avg !== null);
  const hasParticipantStats = validParticipants.length > 0;
  
  const qualifiedForAwards = validParticipants.filter(p => p.attempts >= 3);
  
  const slowestPerson = qualifiedForAwards.length > 0 
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || 0) > (prev.avg || 0) ? current : prev))
    : null;

  const fastestPerson = qualifiedForAwards.length > 0
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || Infinity) < (prev.avg || Infinity) ? current : prev))
    : null;

  // --- OPPDATERT SCATTERDATA MED FILTRERING FOR GJESTER ---
  const scatterData = validParticipants
    .filter(p => p.isRegular || (showScatterGuests && !p.isRegular && p.attempts >= 3))
    .map(p => ({
      name: p.name,
      attempts: p.attempts,
      avg: Number(p.avg?.toFixed(2)),
      isRegular: p.isRegular // Sender med isRegular slik at tooltip kan vite det
    }));

  const noteRateData = validParticipants
    .filter(p => p.attempts >= 3)
    .map(p => {
      const vCount = violations.filter(
        v => v.participantId === p.participantId && v.ruleCode !== "ABSENCE"
      ).length;
      return { name: p.name, notePct: (vCount / p.attempts) * 100 };
    })
    .sort((a, b) => b.notePct - a.notePct)
    .slice(0, 5);

  // --- CUSTOM TOOLTIP FOR GRAFEN ØVERST ---
  const CustomTimeSeriesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: "rgba(18,26,51,0.95)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", color: "white", minWidth: 200 }}>
          <strong style={{ display: "block", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: "1.1rem" }}>
            {label}
          </strong>
          
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "var(--muted)" }}>Gjennomsnitt:</span>
            <strong style={{ color: "var(--accent)" }}>{data.avg?.toFixed(2)}s</strong>
          </div>

          {data.fastestPerson && (
             <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 16 }}>
               <span style={{ color: "var(--muted)" }}>Raskest:</span>
               <span style={{ textAlign: "right" }}>
                 <strong style={{ color: getColor(data.fastestPerson) }}>{data.fastestPerson}</strong> ({data.fastestTime?.toFixed(2)}s)
               </span>
             </div>
          )}

          {data.slowestPerson && (
             <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
               <span style={{ color: "var(--muted)" }}>Tregest:</span>
               <span style={{ textAlign: "right" }}>
                 <strong style={{ color: getColor(data.slowestPerson) }}>{data.slowestPerson}</strong> ({data.slowestTime?.toFixed(2)}s)
               </span>
             </div>
          )}
        </div>
      );
    }
    return null;
  };

  // --- CUSTOM TOOLTIP FOR ACTIVITY CHART ---
  const CustomActivityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "rgba(18,26,51,0.95)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", color: "white" }}>
          <div style={{ marginBottom: 6, color: "var(--muted)" }}>Dato: {label}</div>
          <div style={{ color: "#ffffff", fontWeight: 600 }}>Antall chugs: {payload[0].value}</div>
        </div>
      );
    }
    return null;
  };

  // --- CUSTOM TOOLTIP FOR NOTE TYPES CHART ---
  const CustomNoteTypesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const fullLabel = noteBars.find((n: any) => n.type === label)?.label;
      return (
        <div style={{ background: "rgba(18,26,51,0.95)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", color: "white" }}>
          <div style={{ marginBottom: 6, color: "var(--muted)" }}>{fullLabel || label}</div>
          <div style={{ color: "#ffffff", fontWeight: 600 }}>Antall: {payload[0].value}</div>
        </div>
      );
    }
    return null;
  };

  // --- CUSTOM TOOLTIP FOR PUNISHMENT RATE CHART ---
  const CustomPunishmentTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "rgba(18,26,51,0.95)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", color: "white" }}>
          <div style={{ marginBottom: 6, color: "var(--muted)" }}>{label}</div>
          <div style={{ color: "#ffffff", fontWeight: 600 }}>Straffeprosent: {payload[0].value.toFixed(1)}%</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h1>Dashbord & Statistikk</h1>
      <p>Diverse nyttige og unyttige statistikker.</p>

      <div className="tabs" style={{ marginTop: 10, marginBottom: 20 }}>
        <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>2025 Høst</button>
        <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>2026 Vår</button>
        <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>Total</button>
      </div>

      {!data || !tableData ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>Laster statistikk...</div>
      ) : (
        <>
          {/* DE STATS-BOKSENE ØVERST */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
            gap: 14, 
            marginBottom: 20 
          }}>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Totale Chugs</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{data.overview.attempts}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Aktive Dager</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{data.overview.sessions}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Snitt per dag</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{chugsPerSession.toFixed(1)}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Total Wet-Rate</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: overallWetRate > 20 ? "var(--danger)" : "var(--accent2)", lineHeight: 1 }}>
                {overallWetRate.toFixed(1)}%
              </div>
            </div>
            
            {/* Raskeste person (Lynet) */}
            {fastestPerson && (
              <div className="card" style={{ textAlign: "center", padding: "20px 10px", border: "1px solid color-mix(in srgb, #10b981 40%, transparent)" }}>
                <div style={{ fontSize: "0.85rem", color: "#10b981", marginBottom: 6 }}>⚡ Raskest i snitt</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fastestPerson.name}
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{fastestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}

            {/* Skilpadden (Dårligst snitt) */}
            {slowestPerson && (
              <div className="card" style={{ textAlign: "center", padding: "20px 10px", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--danger)", marginBottom: 6 }}>🐢 Tregest i snitt</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {slowestPerson.name}
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{slowestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}
          </div>

          {/* RAD 1: Tid og Aktivitet */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Raskest/snitt/treigest per dag</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}s`} domain={['auto', 'auto']} />
                    
                    <Tooltip content={<CustomTimeSeriesTooltip />} />
                    <Legend verticalAlign="top" height={36} />

                    {/* Raskeste tid (Grønn) */}
                    <Line type="monotone" dataKey="fastestTime" name="Raskeste tid" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} connectNulls />
                    
                    {/* Snitt-tid (Hovedfarge) */}
                    <Line type="monotone" dataKey="avg" name="Snitt-tid" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />

                    {/* Tregeste tid (Rød) */}
                    <Line type="monotone" dataKey="slowestTime" name="Tregeste tid" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Kvantitet vs Kvalitet</h2>
              
              {/* NYTT: Layout med flexbox for å plassere tekst til venstre og toggle til høyre */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  Nederst til høyre = Mange forsøk og rask.
                </div>
                
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text)", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={showScatterGuests}
                    onChange={e => setShowScatterGuests(e.target.checked)}
                  />
                  Gjester (≥ 3 chugs)
                </label>
              </div>

              <div style={{ width: "100%", height: 280 }}>
                {hasParticipantStats ? (
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" dataKey="attempts" name="Forsøk" stroke="var(--muted)" allowDecimals={false} />
                      <YAxis type="number" dataKey="avg" name="Snitt-tid" unit="s" stroke="var(--muted)" domain={['auto', 'auto']} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div style={{ background: "rgba(18,26,51,0.95)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", color: "white" }}>
                                <strong style={{ display: "block", marginBottom: 4, color: getColor(p.name) }}>
                                  {p.name} {!p.isRegular && <span style={{ opacity: 0.7, fontSize: "0.8em" }}>(gjest)</span>}
                                </strong>
                                <div>Antall chugs: {p.attempts}</div>
                                <div>Snitt-tid: {p.avg}s</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell key={`scatter-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>Ingen data tilgjengelig</div>
                )}
              </div>
            </div>
          </div>

          {/* RAD 2: Wet-rate og Anmerkninger */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Søle-prosent (Wet-rate) per dag</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Basert på MM, W og VW-kryss.</div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip 
                      labelFormatter={(label) => `Dato: ${label}`}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "Wet-rate"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="wetPct" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.3)" strokeWidth={3} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Anmerkningstyper Totalt</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Fordeling av alle registrerte anmerkninger.</div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={noteBars} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="type" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip content={<CustomNoteTypesTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {noteBars.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RAD 3: Straffeprosent og Aktivitet */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap", marginBottom: 40 }}>
             <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Syndebukkene (Høyest straffe-%)</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Andel runder som får en anmerkning (min. 3 forsøk).</div>
              <div style={{ width: "100%", height: 280 }}>
                {hasParticipantStats ? (
                  <ResponsiveContainer>
                    <BarChart data={noteRateData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip content={<CustomPunishmentTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="notePct" radius={[4, 4, 0, 0]}>
                        {noteRateData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>Ingen data tilgjengelig</div>
                )}
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Aktivitet per dag</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Totalt antall chugs registrert hver dato.</div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar dataKey="attempts" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}