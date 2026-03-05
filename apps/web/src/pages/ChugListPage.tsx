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

type SessionCol = { sessionId: string; dateISO: string };
type Cell = { seconds: number | null; note: string | null };

type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, Cell>>;
};

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
  // yyyy-mm-dd -> dd/mm/yyyy
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

function inferSemesterFromYYYYMMDD(yyyyMmDd: string): "2026V" | "2025H" {
  // For nå: hard-mapper til de to dere bruker
  // Jan–Jun => V, Jul–Dec => H, basert på år i datoen
  const [yStr, mStr] = yyyyMmDd.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1..12

  // fallback
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "2026V";

  const isSpring = m >= 1 && m <= 6;

  if (y === 2026) return isSpring ? "2026V" : "2025H"; // hvis noen velger høst 2026 har dere ikke ark ennå
  if (y === 2025) return isSpring ? "2025H" : "2025H";
  // default
  return isSpring ? "2026V" : "2025H";
}

function toISOFromDateInput(yyyyMmDd: string) {
  // Stabil dato midt på dagen UTC
  return new Date(`${yyyyMmDd}T12:00:00.000Z`).toISOString();
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

  const [sortKey, setSortKey] = useState<SortKey>({ kind: "none" });
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Sheet editor state
  const [editSessionId, setEditSessionId] = useState<string | null>(null);

  // Draft for seconds and note per cell (only for the currently edited session)
  const [draftSeconds, setDraftSeconds] = useState<Record<string, string>>({});
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});

  const [newDayOpen, setNewDayOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [textDate, setTextDate] = useState(() => fmtDDMMYYYYFromYYYYMMDD(new Date().toISOString().slice(0, 10)));
  const [newDaySemester, setNewDaySemester] = useState<"2026V" | "2025H">("2026V");

  useEffect(() => {
  setNewDaySemester(inferSemesterFromYYYYMMDD(newDayDate));
}, [newDayDate]);

  function toISOFromDateInput(yyyyMmDd: string) {
    return new Date(`${yyyyMmDd}T12:00:00.000Z`).toISOString();
  }

  // Dirty tracking (what changed)
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [dirtySessionNote, setDirtySessionNote] = useState(false);

  // Session note (for the day)
  const [sessionNote, setSessionNote] = useState("");

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setData(null);
    const res = await fetch(`/api/stats/table?semester=${semester}`);
    const json: TableResponse = await res.json();
    setData(json);

    // hvis valgt editSession ikke finnes, null
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

  // --- Open editor for a session
  async function openEditor(sessionId: string) {
    if (!data) return;

    // hvis du har unsaved changes: enkel bekreftelse (ikke spør – bare auto)
    // her velger vi å "kaste" endringer hvis du bytter dato
    setDirtyCells(new Set());
    setDirtySessionNote(false);

    setEditSessionId(sessionId);

    // Prefill drafts from table
    const nextSec: Record<string, string> = {};
    const nextNote: Record<string, string> = {};

    for (const r of data.rows) {
      const cell = data.cells?.[r.participantId]?.[sessionId];
      nextSec[r.participantId] = cell?.seconds == null ? "" : cell.seconds.toFixed(2);
      nextNote[r.participantId] = cell?.note ?? "";
    }
    setDraftSeconds(nextSec);
    setDraftNote(nextNote);

    // Fetch session note from /api/sessions (lightweight) OR keep it in stats if you later add it there.
    // Her henter vi den via /api/sessions:
    const sRes = await fetch(`/api/sessions?semester=${semester}`);
    const sessions = await sRes.json() as Array<{ id: string; note?: string|null }>;
    const found = sessions.find(s => s.id === sessionId);
    setSessionNote(found?.note ?? "");

    // focus first regular
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

  // Spreadsheet navigation
  function focusByIndex(idx: number) {
    if (!data) return;
    const r = data.rows[idx];
    if (!r) return;
    setTimeout(() => inputRefs.current[r.participantId]?.focus(), 0);
  }

  async function saveAll() {
    if (!data || !editSessionId) return;

    const sid = editSessionId;

    // 1) Save dirty cells (batch via multiple requests)
    const dirty = Array.from(dirtyCells);

    for (const k of dirty) {
      const [participantId, sessionId] = k.split("|");
      if (sessionId !== sid) continue;

      const secStr = (draftSeconds[participantId] ?? "").trim();
      if (!secStr) continue;

      const seconds = parseSeconds(secStr);
      if (!Number.isFinite(seconds) || seconds <= 0) continue;

      const note = (draftNote[participantId] ?? "").trim();

      await fetch("/api/attempts/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          sessionId: sid,
          seconds,
          note: note ? note : null
        })
      });
    }

    // 2) Save session note if changed
    if (dirtySessionNote) {
      await fetch(`/api/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: sessionNote.trim() ? sessionNote.trim() : null })
      });
    }

    // Refresh once
    await load();

    // Clear dirty
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
        const txt = await res.text(); // viser prisma/express-feil hvis du returnerer den
        alert(`Kunne ikke opprette ny dag (${res.status}).\n\n${txt}`);
        return;
      }

      const created = await res.json(); // forventer id
      setNewDayOpen(false);

      // bytt semester så den nye dagen dukker opp
      setSemester(newDaySemester);

      // reload og åpne editor på ny dag
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

  return (
    <div>
      <h1>Chuggelista</h1>

      <div className="sheetBar">
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>
        <button className="btn" onClick={load}>Oppdater</button>
        <button className="btn" onClick={() => setNewDayOpen(true)}>+ Ny dag</button>

        <div style={{ flex: 1 }} />

        {editSession ? (
          <>
            <span className="pill">Redigerer: {fmtDDMMYYYY(editSession.dateISO)}</span>
            <span className="pill">Ulagrede endringer: {dirtyCount}</span>
            <button className="btn" onClick={saveAll} disabled={dirtyCount === 0}>Lagre</button>
            <button
              className="btn"
              onClick={() => {
                // discard drafts
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 100
      }}
    >
      <div className="card" style={{ width: 460 }}>
        <h2>Legg til ny dag</h2>

        <label>Dato (dd/mm/yyyy)</label>
        <input
          className="input"
          type="text"
          placeholder="dd/mm/yyyy"
          value={textDate}
          onChange={e => {
            const val = e.target.value;
            setTextDate(val); // Oppdater hva brukeren ser i feltet
            
            // Hvis brukeren har skrevet inn en full dato (f.eks 05/03/2026), 
            // oversetter vi den tilbake til yyyy-mm-dd i bakgrunnen
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

      {/* Editor panel */}
      {editSession && data && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>Spreadsheet – {fmtDDMMYYYY(editSession.dateISO)}</h2>

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

          <div style={{ display: "grid", gap: 8 }}>
            {data.rows.map((r, idx) => (
              <div
                key={r.participantId}
                style={{ display: "grid", gridTemplateColumns: "220px 110px 1fr", gap: 10, alignItems: "center" }}
              >
                <button className="btn" style={{ justifySelf: "start" }} onClick={() => nav(`/person/${r.participantId}`)}>
                  {r.name}{r.isRegular ? "" : " (gjest)"}
                </button>

                <input
                  ref={el => { inputRefs.current[r.participantId] = el; }}
                  className={`input cellInput ${dirtyCells.has(cellKey(r.participantId, editSession.sessionId)) ? "cellDirty" : ""}`}
                  placeholder="12.34"
                  value={draftSeconds[r.participantId] ?? ""}
                  onChange={e => {
                    setDraftSeconds(prev => ({ ...prev, [r.participantId]: e.target.value }));
                    markDirty(r.participantId, editSession.sessionId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditSessionId(null);
                      setDirtyCells(new Set());
                      setDirtySessionNote(false);
                      return;
                    }

                    // spreadsheet nav
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

                <input
                  className="input"
                  placeholder="anmerkning (mm/w/vw/p/…)"
                  value={draftNote[r.participantId] ?? ""}
                  onChange={e => {
                    setDraftNote(prev => ({ ...prev, [r.participantId]: e.target.value }));
                    markDirty(r.participantId, editSession.sessionId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.shiftKey) focusByIndex(idx - 1);
                      else focusByIndex(idx + 1);
                    }
                  }}
                />
              </div>
            ))}
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

                  {data.columns.map(c => (
                    <th
                      key={c.sessionId}
                      style={{ cursor: "pointer" }}
                      title="Sorter på dato. Dobbeltklikk for å redigere den dagen."
                      onClick={() => clickSort({ kind: "date", sessionId: c.sessionId })}
                      onDoubleClick={() => openEditor(c.sessionId)}
                    >
                      {fmtDDMMYYYY(c.dateISO)}
                      {sortKey.kind === "date" && sortKey.sessionId === c.sessionId
                        ? (sortDir === "asc" ? " ▲" : " ▼")
                        : ""}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {regularRows.map(r => (
                  <tr key={r.participantId}>
                    <td className="sticky">
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={() => nav(`/person/${r.participantId}`)}>
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
                      return (
                        <td key={c.sessionId} className="cell">
                          {txt}
                          {note && (
                            <>
                              <span className="noteDot" />
                              <div className="tooltip">{note}</div>
                            </>
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
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={() => nav(`/person/${r.participantId}`)}>
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
                      return (
                        <td key={c.sessionId} className="cell">
                          {txt}
                          {note && (
                            <>
                              <span className="noteDot" />
                              <div className="tooltip">{note}</div>
                            </>
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