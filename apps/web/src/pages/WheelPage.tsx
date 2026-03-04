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
  const [people, setPeople] = useState<Participant[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [includeGuests, setIncludeGuests] = useState(false);

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");

  const [absence, setAbsence] = useState<AbsenceModal>({ open: false });
  const [excludeMode, setExcludeMode] = useState<ExcludeMode>("ABSENCE");
  const [absenceCode, setAbsenceCode] = useState("ABSENCE");
  const [absenceReason, setAbsenceReason] = useState("");

  async function loadPeople() {
    const res = await fetch(`/api/participants?includeGuests=${includeGuests ? "true" : "false"}`);
    const data: Participant[] = await res.json();
    setPeople(data);

    const init: Record<string, boolean> = {};
    data.forEach(p => (init[p.id] = p.isRegular)); // faste true, gjester false
    setPresent(init);
  }

  useEffect(() => {
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeGuests]);

  const candidates = useMemo(() => {
    return people.filter(p => present[p.id]).map(p => p.name);
  }, [people, present]);

  const candidateIds = useMemo(() => {
    return people.filter(p => present[p.id]).map(p => p.id);
  }, [people, present]);

  function togglePresent(p: Participant, checked: boolean) {
    if (checked) {
      setPresent(prev => ({ ...prev, [p.id]: true }));
      return;
    }
    // åpne modal
    setAbsence({ open: true, participant: p });
    setExcludeMode("ABSENCE");
    setAbsenceCode("ABSENCE");
    setAbsenceReason("");
  }

  async function confirmExclude() {
    const p = absence.participant!;
    setPresent(prev => ({ ...prev, [p.id]: false }));

    // Ekskluder uten fravær: ingen backend-logg
    if (excludeMode === "EXCUSED") {
      setAbsence({ open: false });
      return;
    }

    // Fravær: logg i krysslista
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
    const winnerName = json?.winner?.name ?? "Ukjent";

    const idx = candidates.findIndex(n => n === winnerName);
    const n = Math.max(candidates.length, 1);
    const step = (Math.PI * 2) / n;

    const targetMid = idx * step + step / 2;
    const pointerAngle = 0;
    const targetAngle = pointerAngle - targetMid;

    const extraTurns = 6 * Math.PI * 2;
    const start = angle;
    const end = targetAngle + extraTurns;

    const duration = 2400;
    const t0 = performance.now();

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function anim(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = easeOutCubic(t);
      setAngle(start + (end - start) * eased);
      if (t < 1) requestAnimationFrame(anim);
      else {
        setAngle(((end % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        setWinner(winnerName);
        setSpinning(false);
      }
    }
    requestAnimationFrame(anim);
  }

  return (
    <div>
      <h1>Hjulet</h1>
      <p>Velg hvem som er til stede, og spinn for å avgjøre hvem som chugger først.</p>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 420 }}>
          <h2>Deltakere</h2>

          <label style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={includeGuests}
              onChange={e => setIncludeGuests(e.target.checked)}
            />
            Inkluder gjester i hjulet
          </label>

          <div className="hr" />

          <div style={{ display: "grid", gap: 8 }}>
            {people.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!present[p.id]}
                  onChange={e => togglePresent(p, e.target.checked)}
                />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span className="badge">{p.isRegular ? "fast" : "gjest"}</span>
              </label>
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
            <WheelCanvas names={candidates.length ? candidates : ["Ingen"]} angle={angle} winnerName={winner} />
            <button className="btn" onClick={spin} disabled={spinning || candidateIds.length === 0}>
              {spinning ? "Spinner..." : "SPIN (ekte random)"}
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