// ChugListPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Semester = "2026V" | "2025H" | "all";

type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  bestOverall: number | null;
  avgOverall: number | null;
};

type SessionCol = { sessionId: string; dateISO: string; note?: string | null };
type Cell = { seconds: number | null; note: string | null; violations?: string };

type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, Cell>>;
};

type ViolationEntry = {
  id: string;
  participantId: string;
  sessionId: string;
  ruleCode: string;
  crosses: number;
};

const PERF_CODES = ["MM", "W", "VW", "P", "T", "DNS", "DNF", "VOMIT", "KPR"] as const;

type SortKey =
  | { kind: "none" }
  | { kind: "best" }
  | { kind: "avg" }
  | { kind: "date"; sessionId: string };

type SortDir = "asc" | "desc";

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
function fmtDDMMYYYYFromYYYYMMDD(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

function inferSemesterFromYYYYMMDD(yyyyMmDd: string): "2026V" | "2025H" {
  const [yStr, mStr] = yyyyMmDd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  if (!Number.isFinite(y) || !Number.isFinite(m)) return "2026V";

  const isSpring = m >= 1 && m <= 6;

  if (y === 2026) return isSpring ? "2026V" : "2025H"; 
  if (y === 2025) return isSpring ? "2025H" : "2025H";
  return isSpring ? "2026V" : "2025H";
}

function parseSeconds(s: string) {
  const v = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

function cellKey(participantId: string, sessionId: string) {
  return `${participantId}|${sessionId}`;
}

export function ChugListPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<TableResponse | null>(null);
  
  const [allViolations, setAllViolations] = useState<ViolationEntry[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>({ kind: "none" });
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editSessionId, setEditSessionId] = useState<string | null>(null);

  const [draftSeconds, setDraftSeconds] = useState<Record<string, string>>({});
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});
  const [draftViolations, setDraftViolations] = useState<Record<string, string[]>>({});

  const [newDayOpen, setNewDayOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [textDate, setTextDate] = useState(() => fmtDDMMYYYYFromYYYYMMDD(new Date().toISOString().slice(0, 10)));
  const [newDaySemester, setNewDaySemester] = useState<"2026V" | "2025H">("2026V");

  useEffect(() => {
    setNewDaySemester(inferSemesterFromYYYYMMDD(newDayDate));
  }, [newDayDate]);

  function toISOFromDateInput(yyyyMmDd: string) {
    return new Date(`${yyyyMmDd}T12:00:00.000Z`).toISOString();
  }

  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [dirtySessionNote, setDirtySessionNote] = useState(false);

  const [sessionNote, setSessionNote] = useState("");

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setData(null);
    
    const [resT, resV, resS] = await Promise.all([
      fetch(`/api/stats/table?semester=${semester}`),
      fetch(`/api/violations?semester=${semester}`),
      fetch(`/api/sessions?semester=${semester}`)
    ]);
    
    const json: TableResponse = await resT.json();
    const violationsJson: ViolationEntry[] = await resV.json();
    const sessionsJson: Array<{id: string, note: string | null}> = await resS.json();
    
    // Fletter inn 'note' fra sessions inn i kolonnene
    json.columns = json.columns.map(col => {
      const foundSession = sessionsJson.find(s => s.id === col.sessionId);
      return {
        ...col,
        note: foundSession?.note ?? null
      };
    });

    setData(json);
    setAllViolations(violationsJson);

    setEditSessionId(prev => (prev && json.columns.some(c => c.sessionId === prev) ? prev : null));
  }

  useEffect(() => { load(); }, [semester]);

  function clickSort(next: SortKey) {
    const same =
      sortKey.kind === next.kind &&
      (sortKey.kind !== "date" ||
        (next.kind === "date" && sortKey.sessionId === next.sessionId));

    if (!same) {
      setSortKey(next);
      setSortDir("asc");
      return;
    }
    setSortDir(d => (d === "asc" ? "desc" : "asc"));
  }

  const sortedRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const copy = [...rows];

    const getVal = (r: Row): number => {
      if (!data) return Number.POSITIVE_INFINITY;

      if (sortKey.kind === "best") return r.bestOverall ?? Number.POSITIVE_INFINITY;
      if (sortKey.kind === "avg") return r.avgOverall ?? Number.POSITIVE_INFINITY;

      if (sortKey.kind === "date") {
        const cell = data.cells?.[r.participantId]?.[sortKey.sessionId];
        return cell?.seconds ?? Number.POSITIVE_INFINITY;
      }
      return 0;
    };

    if (sortKey.kind === "none") return copy;

    copy.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return copy;
  }, [data, sortKey, sortDir]);

  const { regularRows, guestRows } = useMemo(() => {
    return {
      regularRows: sortedRows.filter(r => r.isRegular),
      guestRows: sortedRows.filter(r => !r.isRegular)
    };
  }, [sortedRows]);

  const editSession = useMemo(() => {
    if (!data || !editSessionId) return null;
    return data.columns.find(c => c.sessionId === editSessionId) ?? null;
  }, [data, editSessionId]);

  const projectedTimes = useMemo(() => {
    if (!data) return {} as Record<string, number | null>;
    const result: Record<string, number | null> = {};
    for (const r of data.rows) {
      const pts: number[] = [];
      for (const col of data.columns) {
        const cell = data.cells?.[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null) pts.push(cell.seconds);
      }
      if (pts.length < 2) { result[r.participantId] = null; continue; }
      const n = pts.length;
      const xs = pts.map((_, i) => i);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = pts.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * pts[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      result[r.participantId] = Math.max(0, m * n + b);
    }
    return result;
  }, [data]);

  async function openEditor(sessionId: string) {
    if (!data) return;

    setDirtyCells(new Set());
    setDirtySessionNote(false);
    setEditSessionId(sessionId);

    const nextSec: Record<string, string> = {};
    const nextNote: Record<string, string> = {};

    for (const r of data.rows) {
      const cell = data.cells?.[r.participantId]?.[sessionId];
      nextSec[r.participantId] = cell?.seconds == null ? "" : cell.seconds.toFixed(2);
      nextNote[r.participantId] = cell?.note ?? "";
    }
    setDraftSeconds(nextSec);
    setDraftNote(nextNote);

    const sRes = await fetch(`/api/sessions?semester=${semester}`);
    const sessions = await sRes.json() as Array<{ id: string; note?: string|null }>;
    const found = sessions.find(s => s.id === sessionId);
    setSessionNote(found?.note ?? "");

    const sessionViolations = allViolations.filter(v => v.sessionId === sessionId);
    const nextViolations: Record<string, string[]> = {};
    for (const r of data.rows) {
      nextViolations[r.participantId] = sessionViolations
        .filter(v => v.participantId === r.participantId)
        .map(v => v.ruleCode);
    }
    setDraftViolations(nextViolations);

    const first = data.rows.find(x => x.isRegular) ?? data.rows[0];
    if (first) setTimeout(() => inputRefs.current[first.participantId]?.focus(), 0);
  }

  function markDirty(pid: string, sid: string) {
    const k = cellKey(pid, sid);
    setDirtyCells(prev => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
  }

  function focusByIndex(idx: number) {
    if (!data) return;
    const r = data.rows[idx];
    if (!r) return;
    setTimeout(() => inputRefs.current[r.participantId]?.focus(), 0);
  }

  async function saveAll() {
    if (!data || !editSessionId) return;

    const sid = editSessionId;
    const dirty = Array.from(dirtyCells);

    for (const k of dirty) {
      const [participantId, sessionId] = k.split("|");
      if (sessionId !== sid) continue;

      const secStr = (draftSeconds[participantId] ?? "").trim();
      const violations = draftViolations[participantId] ?? [];
      const seconds = secStr ? parseSeconds(secStr) : null;
      const hasValidTime = seconds !== null && Number.isFinite(seconds) && seconds > 0;

      if (!hasValidTime && violations.length === 0 && !draftNote[participantId]?.trim()) continue;
      if (secStr && !hasValidTime) continue;

      const note = (draftNote[participantId] ?? "").trim();

      await fetch("/api/attempts/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          sessionId: sid,
          seconds: hasValidTime ? seconds : null,
          note: note ? note : null,
          violations
        })
      });
    }

    if (dirtySessionNote) {
      await fetch(`/api/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: sessionNote.trim() ? sessionNote.trim() : null })
      });
    }

    await load();

    setDirtyCells(new Set());
    setDirtySessionNote(false);
  }

  const dirtyCount = dirtyCells.size + (dirtySessionNote ? 1 : 0);

  async function createNewDay() {
    try {
      const dateISO = toISOFromDateInput(newDayDate);

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, semester: newDaySemester })
      });

      if (!res.ok) {
        const txt = await res.text(); 
        alert(`Kunne ikke opprette ny dag (${res.status}).\n\n${txt}`);
        return;
      }

      const created = await res.json(); 
      setNewDayOpen(false);

      setSemester(newDaySemester);

      setTimeout(async () => {
        await load();
        if (created?.id) {
          await openEditor(created.id);
        } else if (data?.columns?.length) {
          await openEditor(data.columns[data.columns.length - 1].sessionId);
        }
      }, 0);

    } catch (e) {
      alert(`Kunne ikke opprette ny dag (nettverksfeil).\n\n${String(e)}`);
    }
  }

  async function deleteSession(sessionId: string, dateISO: string) {
    const confirmMessage = `Er du helt sikker på at du vil SLETTE hele listen for ${fmtDDMMYYYY(dateISO)}?\n\nAlle tider og anmerkninger for denne dagen vil bli slettet for alltid. Dette kan ikke angres!`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE"
        });

        if (!res.ok) {
          const txt = await res.text();
          alert(`Feil ved sletting: ${txt}`);
          return;
        }

        setEditSessionId(null);
        setDirtyCells(new Set());
        setDirtySessionNote(false);
        await load();

      } catch (e) {
        alert("Nettverksfeil ved sletting.");
      }
    }
  }

  return (
    <div>
      <h1>Chuggelista</h1>

      <div className="sheetBar">
        <div className="sheetBar">
          <div className="tabs">
            <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>
              2025 Høst
            </button>
            <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>
              2026 Vår
            </button>
            <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>
              Total
            </button>
          </div>
        <button className="btn" onClick={() => setNewDayOpen(true)}>+ Ny dag</button>
        </div>

        <div style={{ flex: 1 }} />

        {editSession ? (
          <>
            <span className="pill">Redigerer: {fmtDDMMYYYY(editSession.dateISO)}</span>
            <span className="pill">Ulagrede endringer: {dirtyCount}</span>
            <button className="btn" onClick={saveAll} disabled={dirtyCount === 0}>Lagre</button>
            <button
              className="btn"
              onClick={() => {
                setEditSessionId(null);
                setDirtyCells(new Set());
                setDirtySessionNote(false);
              }}
            >
              Lukk redigering
            </button>
          </>
        ) : (
          <span className="pill">Tips: Dobbeltklikk en dato for å redigere</span>
        )}
      </div>

      {newDayOpen && (
        <div className="modalOverlay">
          <div className="card modalCard">
            <h2>Legg til ny dag</h2>

            <label>Dato (dd/mm/yyyy)</label>
            <input
              className="input"
              type="text"
              placeholder="dd/mm/yyyy"
              value={textDate}
              onChange={e => {
                const val = e.target.value;
                setTextDate(val); 
                
                if (val.length === 10 && val.includes("/")) {
                  const [d, m, y] = val.split("/");
                  if (d && m && y && y.length === 4) {
                    setNewDayDate(`${y}-${m}-${d}`);
                  }
                }
              }}
            />

            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Semester settes automatisk: <b style={{ color: "var(--text)" }}>{newDaySemester}</b>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ height: 14 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setNewDayOpen(false)}>Avbryt</button>
              <button className="btn" onClick={createNewDay}>Opprett</button>
            </div>
          </div>
        </div>
      )}

      {editSession && data && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Spreadsheet – {fmtDDMMYYYY(editSession.dateISO)}</h2>
            <button 
              className="btn" 
              style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }} 
              onClick={() => deleteSession(editSession.sessionId, editSession.dateISO)}
            >
              Slett hele dagen
            </button>
          </div>

          <label>Dagsnotat</label>
          <input
            className="input"
            value={sessionNote}
            placeholder="F.eks. 'Kald øl, Tobias rant, to mm-chugs…'"
            onChange={e => {
              setSessionNote(e.target.value);
              setDirtySessionNote(true);
            }}
          />

          <div className="hr" />

          <div style={{ display: "grid", gap: 10 }}>
            {data.rows.map((r, idx) => {
              const activeViolations = draftViolations[r.participantId] ?? [];
              const isDirty = dirtyCells.has(cellKey(r.participantId, editSession.sessionId));
              return (
                <div key={r.participantId} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn"
                    style={{ minWidth: 190 }}
                    onClick={() => nav(`/person/${r.participantId}`)}
                  >
                    {r.name}{r.isRegular ? "" : " (gjest)"}
                  </button>

                  <input
                    ref={el => { inputRefs.current[r.participantId] = el; }}
                    className={`input cellInput ${isDirty ? "cellDirty" : ""}`}
                    placeholder={projectedTimes[r.participantId] != null ? projectedTimes[r.participantId]!.toFixed(2) : "12.34"}
                    value={draftSeconds[r.participantId] ?? ""}
                    onChange={e => {
                      setDraftSeconds(prev => ({ ...prev, [r.participantId]: e.target.value }));
                      markDirty(r.participantId, editSession.sessionId);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Escape") {
                        setEditSessionId(null);
                        setDirtyCells(new Set());
                        setDirtySessionNote(false);
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey) focusByIndex(idx - 1);
                        else focusByIndex(idx + 1);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        focusByIndex(idx + 1);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        focusByIndex(idx - 1);
                      }
                    }}
                  />

                  {PERF_CODES.map(code => {
                    const active = activeViolations.includes(code);
                    return (
                      <button
                        key={code}
                        className="btn"
                        style={{
                          padding: "5px 9px",
                          fontSize: 11,
                          background: active ? "rgba(239,68,68,0.22)" : "rgba(0,0,0,0.18)",
                          borderColor: active ? "rgba(239,68,68,0.5)" : undefined,
                          color: active ? "#ef4444" : "var(--muted)"
                        }}
                        onClick={() => {
                          setDraftViolations(prev => {
                            const cur = prev[r.participantId] ?? [];
                            const next = cur.includes(code)
                              ? cur.filter(c => c !== code)
                              : [...cur, code];
                            return { ...prev, [r.participantId]: next };
                          });
                          markDirty(r.participantId, editSession.sessionId);
                        }}
                      >
                        {code}
                      </button>
                    );
                  })}

                  <span style={{ color: "var(--border)", userSelect: "none" }}>|</span>

                  {(() => {
                    const active = activeViolations.includes("ABSENCE");
                    return (
                      <button
                        className="btn"
                        style={{
                          padding: "5px 9px",
                          fontSize: 11,
                          background: active ? "rgba(234,179,8,0.25)" : "rgba(234,179,8,0.07)",
                          borderColor: active ? "rgba(234,179,8,0.6)" : "rgba(234,179,8,0.3)",
                          color: active ? "#eab308" : "rgba(234,179,8,0.6)"
                        }}
                        onClick={() => {
                          setDraftViolations(prev => {
                            const cur = prev[r.participantId] ?? [];
                            const next = cur.includes("ABSENCE")
                              ? cur.filter(c => c !== "ABSENCE")
                              : [...cur, "ABSENCE"];
                            return { ...prev, [r.participantId]: next };
                          });
                          markDirty(r.participantId, editSession.sessionId);
                        }}
                      >
                        ABSENCE
                      </button>
                    );
                  })()}

                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 120 }}
                    placeholder="notat (valgfritt)"
                    value={draftNote[r.participantId] ?? ""}
                    onChange={e => {
                      setDraftNote(prev => ({ ...prev, [r.participantId]: e.target.value }));
                      markDirty(r.participantId, editSession.sessionId);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey) focusByIndex(idx - 1);
                        else focusByIndex(idx + 1);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
            Enter = ned, Shift+Enter = opp, piltaster flytter, Esc lukker. Trykk <b>Lagre</b> når du er ferdig.
          </div>
        </div>
      )}

      {/* Table view */}
      <div className="card" style={{ marginTop: 14 }}>
        {!data ? (
          <p>Laster…</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th className="sticky">Deltaker</th>

                  <th style={{ cursor: "pointer" }} onClick={() => clickSort({ kind: "best" })}>
                    Beste {sortKey.kind === "best" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>

                  <th style={{ cursor: "pointer" }} onClick={() => clickSort({ kind: "avg" })}>
                    Snitt {sortKey.kind === "avg" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>

                  <th style={{ color: "var(--muted)" }}>Historikk →</th>

                  {data.columns.map(c => {
                    const hasDayNote = c.note && c.note.trim() !== "";
                    return (
                      <th
                        key={c.sessionId}
                        className="cell" 
                        style={{ cursor: "pointer" }} 
                        onClick={() => clickSort({ kind: "date", sessionId: c.sessionId })}
                        onDoubleClick={() => openEditor(c.sessionId)}
                      >
                        {fmtDDMMYYYY(c.dateISO)}
                        {sortKey.kind === "date" && sortKey.sessionId === c.sessionId
                          ? (sortDir === "asc" ? " ▲" : " ▼")
                          : ""}
                        
                        {/* NYTT: Klikkbart ikon for å åpne Session-siden */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation(); // Hindrer sortering når man trykker på ikonet
                            nav(`/session/${c.sessionId}`);
                          }}
                          title="Se dagsrapport og statistikk"
                          style={{ 
                            marginLeft: "8px", 
                            opacity: 0.6, 
                            cursor: "pointer",
                            fontSize: "14px"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
                        >
                          📊
                        </span>
                        
                        {/* GUL PRIKK FOR DAGSNOTAT */}
                        {hasDayNote && (
                          <>
                            <span className="noteDot noteDotYellow" style={{ top: 8, right: 6 }} />
                            <div className="tooltip">
                              <strong style={{ display: "block", marginBottom: "4px" }}>Dagsnotat:</strong>
                              {c.note}
                            </div>
                          </>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {regularRows.map(r => (
                  <tr key={r.participantId}>
                    <td className="sticky">
                      <button className="btn" style={{ padding: "6px 10px", width: "100%", textAlign: "left" }} onClick={() => nav(`/person/${r.participantId}`)}>
                        {r.name}
                      </button>
                    </td>
                    <td>{r.bestOverall == null ? "-" : `${r.bestOverall.toFixed(2)}s`}</td>
                    <td>{r.avgOverall == null ? "-" : `${r.avgOverall.toFixed(2)}s`}</td>
                    <td style={{ color: "var(--muted)" }} />
                    {data.columns.map(c => {
                      const cell = data.cells?.[r.participantId]?.[c.sessionId];
                      const txt = cell?.seconds == null ? "" : `${cell.seconds.toFixed(2)}s`;
                      const note = cell?.note ?? null;
                      
                      const cellViolations = allViolations.filter(
                        v => v.participantId === r.participantId && v.sessionId === c.sessionId
                      );
                      const violationsStr = cellViolations.map(v => v.ruleCode).join(", ");
                      const hasViolations = cellViolations.length > 0;

                      return (
                        <td key={c.sessionId} className="cell">
                          {txt}
                          
                          {/* RØD PRIKK FOR ANMERKNING */}
                          {hasViolations && (
                            <span className="noteDot noteDotRed" style={{ right: note ? 12 : 4 }} />
                          )}

                          {/* GUL PRIKK FOR NOTAT */}
                          {note && (
                            <span className="noteDot noteDotYellow" />
                          )}

                          {/* FELLES TOOLTIP */}
                          {(note || hasViolations) && (
                            <div className="tooltip">
                                {hasViolations && (
                                  <div style={{ color: "#ef4444", marginBottom: note ? 6 : 0 }}>
                                    {violationsStr}
                                  </div>
                                )}
                                {note && <div>{note}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {guestRows.length > 0 && (
                  <tr className="separatorRow">
                    <td colSpan={4 + data.columns.length}>Gjester</td>
                  </tr>
                )}

                {guestRows.map(r => (
                  <tr key={r.participantId}>
                    <td className="sticky">
                      <button className="btn" style={{ padding: "6px 10px", width: "100%", textAlign: "left" }} onClick={() => nav(`/person/${r.participantId}`)}>
                        {r.name}
                      </button>
                    </td>
                    <td>{r.bestOverall == null ? "-" : `${r.bestOverall.toFixed(2)}s`}</td>
                    <td>{r.avgOverall == null ? "-" : `${r.avgOverall.toFixed(2)}s`}</td>
                    <td style={{ color: "var(--muted)" }} />
                    {data.columns.map(c => {
                      const cell = data.cells?.[r.participantId]?.[c.sessionId];
                      const txt = cell?.seconds == null ? "" : `${cell.seconds.toFixed(2)}s`;
                      const note = cell?.note ?? null;
                      
                      const cellViolations = allViolations.filter(
                        v => v.participantId === r.participantId && v.sessionId === c.sessionId
                      );
                      const violationsStr = cellViolations.map(v => v.ruleCode).join(", ");
                      const hasViolations = cellViolations.length > 0;

                      return (
                        <td key={c.sessionId} className="cell">
                          {txt}
                          
                          {/* RØD PRIKK FOR ANMERKNING */}
                          {hasViolations && (
                            <span className="noteDot noteDotRed" style={{ right: note ? 12 : 4 }} />
                          )}

                          {/* GUL PRIKK FOR NOTAT */}
                          {note && (
                            <span className="noteDot noteDotYellow" />
                          )}

                          {/* FELLES TOOLTIP */}
                          {(note || hasViolations) && (
                            <div className="tooltip">
                                {hasViolations && (
                                  <div style={{ color: "#ef4444", marginBottom: note ? 6 : 0 }}>
                                    {violationsStr}
                                  </div>
                                )}
                                {note && <div>{note}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
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