import { useEffect, useMemo, useState } from "react";
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

export function ChugListPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<TableResponse | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>({ kind: "none" });
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function load() {
    setData(null);
    const res = await fetch(`/api/stats/table?semester=${semester}`);
    const json: TableResponse = await res.json();
    setData(json);
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
        // tom celle -> Infinity (havner nederst i asc)
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

  return (
    <div>
      <h1>Chuggelista</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>
        <button className="btn" onClick={load}>Oppdater</button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {!data ? (
          <p>Laster…</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th className="sticky">Deltaker</th>

                  {/* “Skille” for stats */}
                  <th style={{ cursor: "pointer" }} onClick={() => clickSort({ kind: "best" })}>
                    Beste {sortKey.kind === "best" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>

                  <th style={{ cursor: "pointer" }} onClick={() => clickSort({ kind: "avg" })}>
                    Snitt {sortKey.kind === "avg" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>

                  {/* Visuell separator før historikk */}
                  <th style={{ color: "var(--muted)" }}>Historikk →</th>

                  {data.columns.map(c => (
                    <th
                      key={c.sessionId}
                      style={{ cursor: "pointer" }}
                      title="Sorter på denne datoen"
                      onClick={() => clickSort({ kind: "date", sessionId: c.sessionId })}
                    >
                      {new Date(c.dateISO).toLocaleDateString()}
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
                      <button
                        className="btn"
                        style={{ padding: "6px 10px" }}
                        onClick={() => nav(`/person/${r.participantId}`)}
                      >
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
                      <button
                        className="btn"
                        style={{ padding: "6px 10px" }}
                        onClick={() => nav(`/person/${r.participantId}`)}
                      >
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