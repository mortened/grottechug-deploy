import { useEffect, useState } from "react";

type Semester = "2026V" | "2025H" | "all";
type Row = { participantId: string; name: string; bestClean: number; dateISO: string };
type Resp = { semester: string; rows: Row[] };

export function LeaderboardPage() {
  const [semester, setSemester] = useState<Semester>("all");
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/leaderboard?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [semester]);

  const rows = data?.rows ?? [];
  const top3 = rows.slice(0, 3);

  return (
    <div>
      <h1>Toppliste</h1>
      <p>Rangert etter beste tid uten anmerkning.</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card">
          <h2>Podium</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            {[1, 0, 2].map(pos => {
              const r = top3[pos];
              const label = pos === 0 ? "1." : pos === 1 ? "2." : "3.";
              const height = pos === 0 ? 140 : pos === 1 ? 110 : 90;
              return (
                <div key={pos} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ marginBottom: 8, fontWeight: 800 }}>{label}</div>
                  <div style={{ height, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", display: "grid", placeItems: "center", padding: 10 }}>
                    {r ? (
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.name}</div>
                        <div style={{ color: "var(--muted)" }}>{r.bestClean.toFixed(2)}s</div>
                      </div>
                    ) : (
                      <div style={{ color: "var(--muted)" }}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col card">
          <h2>Hele listen</h2>
          <div className="tableWrap">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Navn</th>
                  <th>Beste (clean)</th>
                  <th>Dato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.participantId}>
                    <td>{i + 1}</td>
                    <td><b>{r.name}</b></td>
                    <td>{r.bestClean.toFixed(2)}s</td>
                    <td style={{ color: "var(--muted)" }}>{new Date(r.dateISO).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Ingen data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}