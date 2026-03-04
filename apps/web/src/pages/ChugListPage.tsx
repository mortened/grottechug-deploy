import { useEffect, useMemo, useState } from "react";

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

function isoFromLocalDateInput(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toISOString();
}

export function ChugListPage() {
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<TableResponse | null>(null);
  const [err, setErr] = useState<string>("");

  const [newDay, setNewDay] = useState<string>("");

  // Registrer chugg (form)
  const [formPid, setFormPid] = useState<string>("");
  const [formSid, setFormSid] = useState<string>("");
  const [formSeconds, setFormSeconds] = useState<string>("");
  const [formNote, setFormNote] = useState<string>("");

  async function load() {
    setErr("");
    setData(null);
    try {
      const res = await fetch(`/api/stats/table?semester=${semester}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TableResponse = await res.json();
      setData(json);

      // default select i form
      if (!formPid && json.rows.length) setFormPid(json.rows[0].participantId);
      if (!formSid && json.columns.length) setFormSid(json.columns[json.columns.length - 1].sessionId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ukjent feil");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  const { regularRows, guestRows } = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      regularRows: rows.filter(r => r.isRegular),
      guestRows: rows.filter(r => !r.isRegular)
    };
  }, [data]);

  async function addDay() {
    if (!newDay || semester === "all") return;
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateISO: isoFromLocalDateInput(newDay), semester })
    });
    setNewDay("");
    load();
  }

  async function submitChugg() {
    if (!formPid || !formSid) return;

    const secondsNum = Number(formSeconds.replace(",", "."));
    if (!Number.isFinite(secondsNum)) {
      alert("Sekunder må være et tall, f.eks. 6.42");
      return;
    }

    await fetch("/api/attempts/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: formPid,
        sessionId: formSid,
        seconds: secondsNum,
        note: formNote
      })
    });

    setFormSeconds("");
    setFormNote("");
    load();
  }

  return (
    <div>
      <h1>Chuggelista</h1>
      <p>Prikk = anmerkning (hover). Cellen viser kun tid i sekunder.</p>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ margin: 0, minWidth: 160 }}>
            Semester
            <select value={semester} onChange={e => setSemester(e.target.value as Semester)}>
              <option value="2026V">2026 Vår</option>
              <option value="2025H">2025 Høst</option>
              <option value="all">Alle</option>
            </select>
          </label>

          <button className="btn" onClick={load}>Oppdater</button>

          {semester !== "all" && (
            <label style={{ margin: 0 }}>
              Legg til ny dag
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" type="date" value={newDay} onChange={e => setNewDay(e.target.value)} />
                <button className="btn" onClick={addDay} disabled={!newDay}>Legg til</button>
              </div>
            </label>
          )}

          {err && <span style={{ color: "rgba(255,160,160,0.95)" }}>Feil: {err}</span>}
        </div>

        <div className="hr" />

        {/* Registrer chugg */}
        {data && (
          <div className="card" style={{ marginBottom: 14, padding: 12 }}>
            <h2>Registrer chugg</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ margin: 0, minWidth: 220 }}>
                Person
                <select value={formPid} onChange={e => setFormPid(e.target.value)}>
                  {data.rows.map(r => (
                    <option key={r.participantId} value={r.participantId}>
                      {r.name}{r.isRegular ? "" : " (gjest)"}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ margin: 0, minWidth: 220 }}>
                Dato
                <select value={formSid} onChange={e => setFormSid(e.target.value)}>
                  {data.columns.map(c => (
                    <option key={c.sessionId} value={c.sessionId}>
                      {new Date(c.dateISO).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ margin: 0, minWidth: 140 }}>
                Sekunder
                <input className="input" value={formSeconds} onChange={e => setFormSeconds(e.target.value)} placeholder="6.42" />
              </label>

              <label style={{ margin: 0, minWidth: 260 }}>
                Anmerkning
                <input className="input" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="mm / w / vw / custom" />
              </label>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn" onClick={submitChugg} disabled={!formPid || !formSid || !formSeconds}>
                  Lagre
                </button>
              </div>
            </div>
          </div>
        )}

        {!data ? (
          <p>Laster…</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th className="sticky">Deltaker</th>
                  <th>Beste</th>
                  <th>Snitt</th>
                  {data.columns.map(c => (
                    <th key={c.sessionId}>{new Date(c.dateISO).toLocaleDateString()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regularRows.map(r => (
                  <tr key={r.participantId}>
                    <td className="sticky"><b>{r.name}</b></td>
                    <td>{r.bestOverall == null ? "-" : `${r.bestOverall.toFixed(2)}s`}</td>
                    <td>{r.avgOverall == null ? "-" : `${r.avgOverall.toFixed(2)}s`}</td>

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
                    <td colSpan={3 + data.columns.length}>Gjester</td>
                  </tr>
                )}

                {guestRows.map(r => (
                  <tr key={r.participantId}>
                    <td className="sticky"><b>{r.name}</b></td>
                    <td>{r.bestOverall == null ? "-" : `${r.bestOverall.toFixed(2)}s`}</td>
                    <td>{r.avgOverall == null ? "-" : `${r.avgOverall.toFixed(2)}s`}</td>

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