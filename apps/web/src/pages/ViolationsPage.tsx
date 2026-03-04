import { useEffect, useState } from "react";

type Semester = "2026V" | "2025H" | "all";

type SummaryRow = {
  participantId: string;
  name: string;
  isRegular: boolean;
  total: number;
  count: number;
};

type SummaryResp = {
  semester: string;
  rows: SummaryRow[];
};

type Violation = {
  id: string;
  participantName: string;
  dateISO: string;
  ruleCode: string;
  crosses: number;
  reason?: string | null;
};

export function ViolationsPage() {
  const [semester, setSemester] = useState<Semester>("all");
  const [summary, setSummary] = useState<SummaryResp | null>(null);
  const [details, setDetails] = useState<Violation[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  async function loadSummary() {
    const res = await fetch(`/api/crosses/summary?semester=${semester}`);
    const json: SummaryResp = await res.json();
    setSummary(json);
  }

  async function loadDetails() {
    const res = await fetch(`/api/violations`);
    const json: Violation[] = await res.json();
    setDetails(json);
  }

  useEffect(() => {
    loadSummary();
  }, [semester]);

  useEffect(() => {
    if (showDetails) loadDetails();
  }, [showDetails]);

  return (
    <div>
      <h1>Kryssliste</h1>
      <p>Sortert etter total kryss (høyest først).</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>

        <button className="btn" onClick={() => setShowDetails(v => !v)}>
          {showDetails ? "Skjul detaljer" : "Vis detaljer"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {!summary ? (
          <p>Laster…</p>
        ) : (
          <div className="tableWrap">
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Deltaker</th>
                  <th>Status</th>
                  <th>Total kryss</th>
                  <th>Antall hendelser</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r, i) => (
                  <tr key={r.participantId}>
                    <td>{i + 1}</td>
                    <td><b>{r.name}</b></td>
                    <td><span className="badge">{r.isRegular ? "fast" : "gjest"}</span></td>
                    <td>{r.total}</td>
                    <td style={{ color: "var(--muted)" }}>{r.count}</td>
                  </tr>
                ))}
                {!summary.rows.length && (
                  <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Ingen kryss registrert ennå</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Detaljer</h2>
          <div className="tableWrap">
            <table style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Deltaker</th>
                  <th>Kode</th>
                  <th>Kryss</th>
                  <th>Begrunnelse</th>
                </tr>
              </thead>
              <tbody>
                {details.map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.dateISO).toLocaleDateString()}</td>
                    <td><b>{v.participantName}</b></td>
                    <td><span className="badge">{v.ruleCode}</span></td>
                    <td>{v.crosses}</td>
                    <td style={{ color: "var(--muted)" }}>{v.reason ?? ""}</td>
                  </tr>
                ))}
                {!details.length && (
                  <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Ingen detaljer</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}