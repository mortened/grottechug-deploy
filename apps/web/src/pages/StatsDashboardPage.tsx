import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend
} from "recharts";

type Semester = "all" | "2026V" | "2025H";

type Resp = {
  semester: string;
  overview: { sessions: number; attempts: number };
  timeSeries: Array<{ date: string; avg: number | null; bestClean: number | null; attempts: number; wetRate: number }>;
  noteBreakdown: { mm: number; w: number; vw: number; p: number };
  histogram: Array<{ bin: string; count: number }>;
  topClean: Array<{ participantId: string; name: string; bestClean: number }>;
};

export function StatsDashboardPage() {
  const [semester, setSemester] = useState<Semester>("all");
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/analytics?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [semester]);

  const noteBars = data ? [
    { type: "mm", count: data.noteBreakdown.mm },
    { type: "w", count: data.noteBreakdown.w },
    { type: "vw", count: data.noteBreakdown.vw },
    { type: "p", count: data.noteBreakdown.p }
  ] : [];

  return (
    <div>
      <h1>Stats</h1>
      <p>Masse grafer og litt tull. Velg periode med tabs.</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>
      </div>

      {!data ? (
        <div className="card" style={{ marginTop: 14 }}>Laster…</div>
      ) : (
        <>
          <div className="row" style={{ marginTop: 14 }}>
            <div className="col card">
              <h2>Oversikt</h2>
              <div>Dager: <b>{data.overview.sessions}</b></div>
              <div>Chugs: <b>{data.overview.attempts}</b></div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                Raskeste “clean” brukes i topplister (uten anmerkning).
              </div>
            </div>

            <div className="col card">
              <h2>Beste clean (Top 10)</h2>
              <div className="tableWrap">
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th>#</th><th>Navn</th><th>Beste clean</th></tr></thead>
                  <tbody>
                    {data.topClean.map((r, i) => (
                      <tr key={r.participantId}>
                        <td>{i + 1}</td>
                        <td><b>{r.name}</b></td>
                        <td>{r.bestClean.toFixed(2)}s</td>
                      </tr>
                    ))}
                    {!data.topClean.length && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>Ingen clean data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

            <div className="row" style={{ marginTop: 14 }}>
                <div className="col card">
                <h2>Tid per dag</h2>
                <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer>
                    <LineChart data={data.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {/* Use the 'stroke' prop to set line colors */}
                        <Line type="monotone" dataKey="avg" name="Snitt" dot={false} stroke="#8884d8" />
                        <Line type="monotone" dataKey="bestClean" name="Beste clean" dot={false} stroke="#ff4d4f" />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
                </div>

            <div className="col card">
              <h2>Deltakelse per dag</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="attempts" name="Antall chugs" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <div className="col card">
              <h2>Wet-rate per dag</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={data.timeSeries.map(x => ({ ...x, wetPct: x.wetRate * 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="wetPct" name="Wet %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card">
              <h2>Anmerkningstyper</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={noteBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Antall" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <h2>Fordeling av tider (histogram)</h2>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={data.histogram}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bin" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Antall" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}