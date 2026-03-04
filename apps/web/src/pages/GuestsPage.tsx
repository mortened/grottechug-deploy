import { useEffect, useState } from "react";

type Participant = { id: string; name: string; isRegular: boolean };

export function GuestsPage() {
  const [name, setName] = useState("");
  const [guests, setGuests] = useState<Participant[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/participants?includeGuests=true");
        const data: Participant[] = await res.json();
        const onlyGuests = data.filter(p => !p.isRegular);

        if (!alive) return;
        setGuests(onlyGuests);
        setErr("");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Ukjent feil");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/participants?includeGuests=true");
      const data: Participant[] = await res.json();
      setGuests(data.filter(p => !p.isRegular));
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function addGuest() {
    const n = name.trim();
    if (!n) return;

    const res = await fetch("/api/participants/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n })
    });

    if (!res.ok) {
      setErr(`Feil: HTTP ${res.status}`);
      return;
    }

    setName("");
    reload();
  }

  async function removeGuest(id: string) {
    const res = await fetch(`/api/participants/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setErr(`Feil: HTTP ${res.status}`);
      return;
    }
    reload();
  }

  return (
    <div>
      <h1>Gjester</h1>
      <p>Legg til gjester her. De er default AV i hjulet når du inkluderer gjester.</p>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 420 }}>
          <h2>Legg til gjest</h2>
          <label>Navn</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="F.eks. Jonas" />
          <div style={{ height: 10 }} />
          <button className="btn" onClick={addGuest}>Legg til</button>
          {err && <div style={{ marginTop: 10, color: "rgba(255,160,160,0.95)" }}>{err}</div>}
        </div>

        <div className="col card">
          <h2>Gjester</h2>
          {loading ? (
            <p>Laster…</p>
          ) : (
            <div className="tableWrap">
              <table style={{ minWidth: 520 }}>
                <thead>
                  <tr><th>Navn</th><th>Handling</th></tr>
                </thead>
                <tbody>
                  {guests.map(g => (
                    <tr key={g.id}>
                      <td><b>{g.name}</b></td>
                      <td><button className="btn" onClick={() => removeGuest(g.id)}>Slett</button></td>
                    </tr>
                  ))}
                  {!guests.length && <tr><td colSpan={2} style={{ color: "var(--muted)" }}>Ingen gjester</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}