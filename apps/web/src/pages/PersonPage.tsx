import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

type Semester = "2026V" | "2025H" | "all";

type Point = { dateISO: string; seconds: number; note: string | null };
type Resp = {
  participant: { id: string; name: string; isRegular: boolean };
  semester: string;
  points: Point[];
  stats: { attempts: number; best: number | null; avg: number | null; bestClean: number | null };
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function PersonPage() {
  const { id } = useParams();
  const [semester, setSemester] = useState<Semester>("all");
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/person/${id}?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [id, semester]);

  // Trendlinje: enkel lineær regresjon
  const chartData = useMemo(() => {
    if (!data) return [];
    const pts = data.points.map((p, i) => ({ ...p, idx: i, date: fmtDate(p.dateISO) }));

    if (pts.length < 2) return pts;

    const xs = pts.map(p => p.idx);
    const ys = pts.map(p => p.seconds);
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);

    const denom = n * sumXX - sumX * sumX;
    const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;

    return pts.map(p => ({
      ...p,
      trend: m * p.idx + b
    }));
  }, [data]);

  if (!data) return <div className="card">Laster…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{data.participant.name}</h1>
        <span className="badge">{data.participant.isRegular ? "fast" : "gjest"}</span>
        <Link to="/chug" className="btn">← Til Chuggelista</Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => setSemester("2025H")} disabled={semester === "2025H"}>2025 Høst</button>
        <button className="btn" onClick={() => setSemester("2026V")} disabled={semester === "2026V"}>2026 Vår</button>
        <button className="btn" onClick={() => setSemester("all")} disabled={semester === "all"}>Total</button>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 420 }}>
          <h2>Statistikk</h2>
          <div>Antall: <b>{data.stats.attempts}</b></div>
          <div>Beste: <b>{data.stats.best == null ? "-" : `${data.stats.best.toFixed(2)}s`}</b></div>
          <div>Snitt: <b>{data.stats.avg == null ? "-" : `${data.stats.avg.toFixed(2)}s`}</b></div>
          <div>Beste (uten anmerkning): <b>{data.stats.bestClean == null ? "-" : `${data.stats.bestClean.toFixed(2)}s`}</b></div>
        </div>

        <div className="col card">
          <h2>Utvikling</h2>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(v: any, name: any, props: any) => {
                    if (name === "seconds") return [`${Number(v).toFixed(2)}s`, "Tid"];
                    if (name === "trend") return [`${Number(v).toFixed(2)}s`, "Trend"];
                    return [v, name];
                  }}
                  labelFormatter={(label) => `Dato: ${label}`}
                />
                <Line type="monotone" dataKey="seconds" dot />
                <Line type="monotone" dataKey="trend" dot={false} strokeDasharray="6 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p>Trendlinje er en enkel lineær regresjon på tid per runde.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>Historikk</h2>
        <div className="tableWrap">
          <table style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Tid</th>
                <th>Anmerkning</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map(p => (
                <tr key={p.dateISO}>
                  <td>{fmtDate(p.dateISO)}</td>
                  <td>{p.seconds.toFixed(2)}s</td>
                  <td style={{ color: "var(--muted)" }}>{p.note ?? ""}</td>
                </tr>
              ))}
              {!data.points.length && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>Ingen data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}