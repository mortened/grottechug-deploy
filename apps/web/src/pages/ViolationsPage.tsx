import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Semester = "2026V" | "2025H" | "all";

type DetailRow = {
  participantId: string;
  name: string;
  isRegular: boolean;
  total: number;
  byRule: Record<string, number>;
};

type DetailResp = {
  semester: string;
  rows: DetailRow[];
};

type ViolationEntry = {
  id: string;
  participantId: string;
  participantName: string;
  isRegular: boolean;
  sessionId: string;
  dateISO: string;
  ruleCode: string;
  crosses: number;
  reason?: string | null;
};

const RULE_ORDER = ["DNS", "DNF", "MM", "W", "VW", "P", "ABSENCE", "VOMIT", "KPR"];
const RULE_LABELS: Record<string, string> = {
  DNS: "DNS", DNF: "DNF", MM: "MM", W: "W", VW: "VW",
  P: "P", ABSENCE: "Fravær", VOMIT: "Oppkast", KPR: "KPR"
};
const RULE_CROSSES: Record<string, number> = {
  DNS: 3, DNF: 2, MM: 0.5, W: 1, VW: 2, P: 1, ABSENCE: 2, VOMIT: 4, KPR: 1
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ViolationsPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("all");
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);
  const [showDetails, setShowDetails] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGuests, setShowGuests] = useState(false);

  async function loadDetail() {
    setDetail(null);
    const res = await fetch(`/api/crosses/detail?semester=${semester}`);
    setDetail(await res.json());
  }

  async function loadViolations() {
    const res = await fetch(`/api/violations?semester=${semester}`);
    setViolations(await res.json());
  }

  useEffect(() => {
    setExpandedId(null);
    loadDetail();
    if (showDetails) loadViolations();
  }, [semester]);

  useEffect(() => {
    if (showDetails) loadViolations();
  }, [showDetails]);

  async function deleteViolation(id: string) {
    await fetch(`/api/violations/${id}`, { method: "DELETE" });
    loadViolations();
    loadDetail();
  }

  const visibleRows = showGuests
    ? (detail?.rows ?? [])
    : (detail?.rows.filter(r => r.isRegular) ?? []);

  const usedRules = new Set(visibleRows.flatMap(r => Object.keys(r.byRule)));
  const ruleCols = RULE_ORDER.filter(r => usedRules.has(r));

  const expandedViolations = violations.filter(v => v.participantId === expandedId);
  const expandedName = detail?.rows.find(r => r.participantId === expandedId)?.name;

  return (
    <div>
      <h1>Kryssliste</h1>

      <div className="sheetBar">
        <div className="tabs">
          <button
            className={`tab ${semester === "2025H" ? "tabActive" : ""}`}
            onClick={() => setSemester("2025H")}
          >
            2025 Høst
          </button>
          <button
            className={`tab ${semester === "2026V" ? "tabActive" : ""}`}
            onClick={() => setSemester("2026V")}
          >
            2026 Vår
          </button>
          <button
            className={`tab ${semester === "all" ? "tabActive" : ""}`}
            onClick={() => setSemester("all")}
          >
            Total
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowGuests(v => !v)}>
            {showGuests ? "Skjul gjester" : "Vis gjester"}
          </button>
          <button className="btn" onClick={() => setShowDetails(v => !v)}>
            {showDetails ? "Skjul detaljer" : "Vis detaljer"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {!detail ? (
          <p>Laster…</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="sticky">Deltaker</th>
                  <th>Status</th>
                  <th>Total kryss</th>
                  {ruleCols.map(code => (
                    <th key={code} title={`${RULE_CROSSES[code]}× per ${RULE_LABELS[code] ?? code}`}>
                      <div>{RULE_LABELS[code] ?? code}</div>
                      <div style={{ fontSize: 10, fontWeight: "normal", color: "var(--muted)", marginTop: 2 }}>×{RULE_CROSSES[code]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr
                    key={r.participantId}
                    style={{ cursor: showDetails ? "pointer" : undefined }}
                    className={expandedId === r.participantId ? "separatorRow" : undefined}
                    onClick={() => {
                      if (!showDetails) return;
                      setExpandedId(prev => prev === r.participantId ? null : r.participantId);
                    }}
                  >
                    <td>{i + 1}</td>
                    <td className="sticky">
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={e => { e.stopPropagation(); nav(`/person/${r.participantId}`); }}>
                        {r.name}
                      </button>
                    </td>
                    <td><span className="badge">{r.isRegular ? "fast" : "gjest"}</span></td>
                    <td><b>{Math.floor(r.total)}</b></td> 
                    {ruleCols.map(code => (
                      <td key={code}>
                        {r.byRule[code]
                          ? <b style={{ color: "var(--danger, #ef4444)" }}>{r.byRule[code]}</b>
                          : <span style={{ color: "var(--muted)" }}>–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={4 + ruleCols.length} style={{ color: "var(--muted)" }}>
                      Ingen kryss registrert ennå
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetails && expandedId && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Detaljer – {expandedName}</h2>
          <div className="tableWrap">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Kode</th>
                  <th>Kryss</th>
                  <th>Notat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expandedViolations.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--muted)" }}>Ingen kryss</td>
                  </tr>
                ) : expandedViolations.map(v => (
                  <tr key={v.id}>
                    <td>
                      {/* NYTT: Subtil Ghost-knapp for å navigere til dagsrapporten */}
                      <button
                        className="btnGhost"
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "none",
                          color: "var(--muted)",
                          cursor: "pointer",
                          transition: "color 0.2s, background 0.2s",
                          background: "transparent",
                          textAlign: "left"
                        }}
                        onClick={() => nav(`/session/${v.sessionId}`)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--accent)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--muted)";
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="Se dagsrapport og statistikk"
                      >
                        {fmtDate(v.dateISO)}
                      </button>
                    </td>
                    <td><span className="badge">{v.ruleCode}</span></td>
                    <td>{v.crosses}</td>
                    <td style={{ color: "var(--muted)" }}>{v.reason ?? "–"}</td>
                    <td>
                      <button
                        className="btn btnDanger"
                        style={{ padding: "4px 10px", fontSize: 12, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }}
                        onClick={e => { e.stopPropagation(); deleteViolation(v.id); }}
                      >
                        Slett
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}