import { useEffect, useState } from "react";

type Violation = {
  id: string;
  participantName: string;
  dateISO: string;
  ruleCode: string;
  crosses: number;
  reason?: string | null;
};

export function ViolationsPage() {
  const [items, setItems] = useState<Violation[]>([]);

  useEffect(() => {
    fetch("/api/violations")
      .then(r => r.json())
      .then(setItems);
  }, []);

  return (
    <div>
      <h1>Kryssliste</h1>
      <p>Alle regelbrudd og fravær som registreres.</p>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="tableWrap">
          <table style={{ minWidth: 700 }}>
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
              {items.map(v => (
                <tr key={v.id}>
                  <td>{new Date(v.dateISO).toLocaleDateString()}</td>
                  <td><b>{v.participantName}</b></td>
                  <td><span className="badge">{v.ruleCode}</span></td>
                  <td>{v.crosses}</td>
                  <td style={{ color: "var(--muted)" }}>{v.reason ?? ""}</td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Ingen kryss ennå</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}