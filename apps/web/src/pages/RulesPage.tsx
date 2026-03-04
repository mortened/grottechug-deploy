import { useEffect, useState } from "react";

type Rule = { code: string; label: string; crosses: number; details?: string | null };

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    fetch("/api/rules")
      .then(r => r.json())
      .then(setRules);
  }, []);

  return (
    <div>
      <h1>Regler</h1>
      <p>Oversikt over regler og kryss-vekting.</p>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="tableWrap">
          <table style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Regel</th>
                <th>Kryss</th>
                <th>Detaljer</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.code}>
                  <td><span className="badge">{r.code}</span></td>
                  <td><b>{r.label}</b></td>
                  <td>{r.crosses}</td>
                  <td style={{ color: "var(--muted)" }}>{r.details ?? ""}</td>
                </tr>
              ))}
              {!rules.length && (
                <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Ingen regler ennå (seed backend)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}