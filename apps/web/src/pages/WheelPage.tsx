import { useEffect, useMemo, useState } from "react";
import { WheelCanvas } from "../components/WheelCanvas";

type Participant = { id: string; name: string; isRegular: boolean };

type AbsenceModal = {
  open: boolean;
  participant?: Participant;
};

type ExcludeMode = "ABSENCE" | "EXCUSED";

function todayISO() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function WheelPage() {
  // Faste (alltid i lista)
  const [regulars, setRegulars] = useState<Participant[]>([]);
  // Gjester som er lagt til "i dag" (vises nederst i lista)
  const [selectedGuests, setSelectedGuests] = useState<Participant[]>([]);

  const [present, setPresent] = useState<Record<string, boolean>>({});

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");

  const [absence, setAbsence] = useState<AbsenceModal>({ open: false });
  const [excludeMode, setExcludeMode] = useState<ExcludeMode>("ABSENCE");
  const [absenceCode, setAbsenceCode] = useState("ABSENCE");
  const [absenceReason, setAbsenceReason] = useState("");

  // --- Add guest UI
  const [guestTabOpen, setGuestTabOpen] = useState(true);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestSuggestions, setGuestSuggestions] = useState<Participant[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  // Hent KUN faste
  async function loadRegulars() {
    const res = await fetch(`/api/participants?includeGuests=false`);
    const data: Participant[] = await res.json();
    setRegulars(data);

    // Init presence: faste = true, men ikke overskriv gjester som allerede er valgt
    setPresent(prev => {
      const next = { ...prev };
      data.forEach(p => {
        if (next[p.id] === undefined) next[p.id] = true;
      });
      return next;
    });
  }

  useEffect(() => {
    loadRegulars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autocomplete søk mot DB
  useEffect(() => {
    const q = guestQuery.trim();
    if (!q) {
      setGuestSuggestions([]);
      return;
    }

    let alive = true;
    setGuestLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/participants/search?query=${encodeURIComponent(q)}`);
        const data: Participant[] = await res.json();

        if (!alive) return;

        // Vi viser forslag, men vi vil ikke liste opp alle gjester i UI ellers.
        // Fjern duplikater som allerede er i dagens liste (regulars + selectedGuests)
        const already = new Set<string>([
          ...regulars.map(x => x.id),
          ...selectedGuests.map(x => x.id)
        ]);

        setGuestSuggestions(data.slice(0, 8));
      } finally {
        if (!alive) return;
        setGuestLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [guestQuery, regulars, selectedGuests]);

  // Kandidater = faste + selectedGuests som er huket av
  const visiblePeople = useMemo(() => {
    return [...regulars, ...selectedGuests];
  }, [regulars, selectedGuests]);

  const candidateList = useMemo(() => {
    return visiblePeople.filter(p => present[p.id]).map(p => ({ id: p.id, name: p.name }));
  }, [visiblePeople, present]);

  const candidateNames = useMemo(() => candidateList.map(x => x.name), [candidateList]);
  const candidateIds = useMemo(() => candidateList.map(x => x.id), [candidateList]);

  function togglePresent(p: Participant, checked: boolean) {
    if (checked) {
      setPresent(prev => ({ ...prev, [p.id]: true }));
      return;
    }
    // åpne modal ved uncheck
    setAbsence({ open: true, participant: p });
    setExcludeMode("ABSENCE");
    setAbsenceCode("ABSENCE");
    setAbsenceReason("");
  }

  async function confirmExclude() {
    const p = absence.participant!;
    setPresent(prev => ({ ...prev, [p.id]: false }));

    if (excludeMode === "EXCUSED") {
      setAbsence({ open: false });
      return;
    }

    await fetch(`/api/violations/absence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: p.id,
        sessionDateISO: todayISO(),
        reason: absenceReason || "Ikke til stede",
        ruleCode: absenceCode
      })
    });

    setAbsence({ open: false });
  }

  async function spin() {
    if (!candidateIds.length || spinning) return;
    setSpinning(true);
    setWinner("");

    const res = await fetch(`/api/wheel/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds: candidateIds })
    });

    const json = await res.json();
    const winnerId: string | undefined = json?.winner?.id;
    const winnerName: string = json?.winner?.name ?? "Ukjent";
    if (!winnerId) {
      setSpinning(false);
      alert("Spin feilet: mangler winnerId");
      return;
    }

    const idx = candidateList.findIndex(x => x.id === winnerId);
    const n = Math.max(candidateList.length, 1);
    const step = (Math.PI * 2) / n;

    const targetMid = idx * step + step / 2;
    const pointerAngle = 0; // picker på høyre
    const targetAngle = pointerAngle - targetMid;

    const extraTurns = 6 * Math.PI * 2;
    const start = angle;
    const end = targetAngle + extraTurns;

    const duration = 2400;
    const t0 = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function anim(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      setAngle(start + (end - start) * easeOutCubic(t));
      if (t < 1) return requestAnimationFrame(anim);

      setAngle(((end % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      setWinner(winnerName);

      // fjern vinner fra neste runde
      setPresent(prev => ({ ...prev, [winnerId]: false }));

      setSpinning(false);
    }

    requestAnimationFrame(anim);
  }

  async function addGuestByName(name: string) {
    const n = name.trim();
    if (!n) return;

    // Opprett hvis ikke finnes (eller returner eksisterende)
    const res = await fetch("/api/participants/guest-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n })
    });

    const p: Participant = await res.json();

    // Hvis det var en fast (burde sjelden skje), bare huk den av
    if (p.isRegular) {
      setPresent(prev => ({ ...prev, [p.id]: true }));
      setGuestQuery("");
      setGuestSuggestions([]);
      return;
    }

    // Legg til nederst hvis den ikke allerede er lagt til i dag
    setSelectedGuests(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]));

    // Huk den av (default)
    setPresent(prev => ({ ...prev, [p.id]: true }));

    setGuestQuery("");
    setGuestSuggestions([]);
  }

  function removeSelectedGuest(id: string) {
    setSelectedGuests(prev => prev.filter(x => x.id !== id));
    setPresent(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <div>
      <h1>Hjulet</h1>
      <p>Listen viser kun faste. Gjester må søkes opp og legges til.</p>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 460 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0 }}>Deltakere</h2>
            <button className="btn" onClick={() => setGuestTabOpen(v => !v)}>
              {guestTabOpen ? "Skjul gjest-tab" : "Legg til gjest"}
            </button>
          </div>

          {guestTabOpen && (
            <>
              <div className="hr" />
              <h2 style={{ fontSize: 14, marginTop: 0 }}>Legg til gjest</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="input"
                  value={guestQuery}
                  onChange={e => setGuestQuery(e.target.value)}
                  placeholder="Søk eller skriv nytt navn…"
                />
                <button className="btn" onClick={() => addGuestByName(guestQuery)} disabled={!guestQuery.trim()}>
                  Legg til
                </button>
              </div>

              {guestQuery.trim() && (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {guestLoading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Søker…</div>}
                  {!guestLoading &&
                    guestSuggestions.map(s => (
                      <button
                        key={s.id}
                        className="btn"
                        style={{ textAlign: "left", padding: "8px 10px" }}
                        onClick={() => addGuestByName(s.name)}
                      >
                        {s.name} <span style={{ opacity: 0.7 }}>{s.isRegular ? "(fast)" : "(gjest)"}</span>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}

          <div className="hr" />

          {/* Kun faste + gjester lagt til i dag */}
          <div style={{ display: "grid", gap: 8 }}>
            {regulars.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!present[p.id]}
                  onChange={e => togglePresent(p, e.target.checked)}
                />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span className="badge">fast</span>
              </label>
            ))}

            {selectedGuests.length > 0 && (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
                Gjester lagt til i dag
              </div>
            )}

            {selectedGuests.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!present[p.id]}
                    onChange={e => togglePresent(p, e.target.checked)}
                  />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className="badge">gjest</span>
                </label>
                <button className="btn" onClick={() => removeSelectedGuest(p.id)} title="Fjern fra dagens hjul">
                  Fjern
                </button>
              </div>
            ))}
          </div>

          <div className="hr" />
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Kandidater i hjulet: <b style={{ color: "var(--text)" }}>{candidateIds.length}</b>
          </div>
        </div>

        <div className="col card">
          <h2>Spinn</h2>
          <div style={{ display: "grid", placeItems: "center", gap: 14 }}>
            <WheelCanvas names={candidateNames.length ? candidateNames : ["Ingen"]} angle={angle} winnerName={winner} />
            <button className="btn" onClick={spin} disabled={spinning || candidateIds.length === 0}>
              {spinning ? "Spinner..." : "SPINN!"}
            </button>
            {winner && (
              <div style={{ fontSize: 18 }}>
                Først ut: <b>{winner}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for å krysse ut */}
      {absence.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 100
          }}
        >
          <div className="card" style={{ width: 460 }}>
            <h2>Krysse ut: {absence.participant?.name}</h2>
            <p style={{ marginTop: 0 }}>
              Velg om dette skal gi fravær/kryss eller bare ekskludere i dag.
            </p>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="radio"
                  name="excludeMode"
                  checked={excludeMode === "ABSENCE"}
                  onChange={() => setExcludeMode("ABSENCE")}
                />
                <span>Ikke til stede (gir fravær/kryss)</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="radio"
                  name="excludeMode"
                  checked={excludeMode === "EXCUSED"}
                  onChange={() => setExcludeMode("EXCUSED")}
                />
                <span>Ekskluder i dag (ingen kryss)</span>
              </label>
            </div>

            {excludeMode === "ABSENCE" && (
              <>
                <div style={{ height: 10 }} />
                <label>Type</label>
                <select value={absenceCode} onChange={e => setAbsenceCode(e.target.value)}>
                  <option value="ABSENCE">Fravær</option>
                  <option value="REMOTE">Remote (teller som fravær)</option>
                  <option value="VIDEO">Video (teller som fravær)</option>
                </select>

                <div style={{ height: 10 }} />
                <label>Begrunnelse</label>
                <input
                  className="input"
                  value={absenceReason}
                  onChange={e => setAbsenceReason(e.target.value)}
                  placeholder="F.eks. sykdom / ikke i byen / jobb"
                />
              </>
            )}

            <div style={{ height: 14 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" onClick={() => setAbsence({ open: false })}>
                Avbryt
              </button>
              <button className="btn" onClick={confirmExclude}>
                {excludeMode === "EXCUSED" ? "Ekskluder uten fravær" : "Lagre (legg i kryssliste)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}