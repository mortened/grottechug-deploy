import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { WheelCanvas } from "../components/WheelCanvas";

type Participant = { id: string; name: string; isRegular: boolean; imageUrl?: string | null };

type Point = { dateISO: string; seconds: number; note: string | null };
type WinnerStats = {
  isVirgin: boolean;
  lastTime: number | null;
  avgTime: number | null;
  recordTime: number | null;
  projectedNext: number | null;
};

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WheelPage() {
  const [regulars, setRegulars] = useState<Participant[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Participant[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerImage, setWinnerImage] = useState<string | null>(null);
  const [winnerStats, setWinnerStats] = useState<WinnerStats | null>(null);

  const [guestQuery, setGuestQuery] = useState("");
  const [guestSuggestions, setGuestSuggestions] = useState<Participant[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  const [freezeWheel, setFreezeWheel] = useState(false);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const [windowSize, setWindowSize] = useState({ w: 1000, h: 800 });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  async function loadRegulars() {
    const res = await fetch(`/api/participants?includeGuests=false`);
    const data: Participant[] = await res.json();
    setRegulars(data);

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
  }, []);

  const allRegularsSelected = useMemo(() => {
    if (regulars.length === 0) return false;
    return regulars.every(p => !!present[p.id]);
  }, [regulars, present]);

  function toggleAllRegulars(checked: boolean) {
    setFreezeWheel(false);
    setPresent(prev => {
      const next = { ...prev };
      regulars.forEach(p => {
        next[p.id] = checked;
      });
      return next;
    });
  }
  function fmtSeconds(v: number | null | undefined) {
    return v == null ? "-" : `${v.toFixed(2)}s`;
  }

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
  }, [guestQuery]);

  const visiblePeople = useMemo(() => [...regulars, ...selectedGuests], [regulars, selectedGuests]);
  const candidateList = useMemo(() => visiblePeople.filter(p => !!present[p.id]), [visiblePeople, present]);
  const candidateNames = useMemo(() => candidateList.map(p => p.name), [candidateList]);
  const candidateIds = useMemo(() => candidateList.map(p => p.id), [candidateList]);

  useEffect(() => {
    if (!freezeWheel) {
      setWheelNames(candidateNames);
    }
  }, [candidateNames, freezeWheel]);

  function togglePresent(p: Participant, checked: boolean) {
    setFreezeWheel(false);
    setPresent(prev => ({ ...prev, [p.id]: checked }));
  }

  function fireConfetti() {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 10000 });
  }

  async function spin() {
    if (spinning) return;
    setWinner("");
    setWinnerImage(null);
    setWinnerStats(null);
    if (!candidateIds.length) return;

    const currentNames = [...candidateNames];
    setWheelNames(currentNames);
    setFreezeWheel(true);
    setSpinning(true);

    const res = await fetch(`/api/wheel/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds: candidateIds })
    });
    const json = await res.json();
    const winnerId: string = json?.winner?.id;
    const winnerName: string = json?.winner?.name ?? "Ukjent";

    if (!winnerId) {
      setSpinning(false);
      return;
    }

    // Hent vinnerstats mens hjulet spinner
    fetch(`/api/person/${winnerId}?semester=all`)
      .then(r => r.json())
      .then(data => {
        const points: Point[] = [...(data?.points || [])];
        points.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

        if (points.length === 0) {
          setWinnerStats({
            isVirgin: true,
            lastTime: null,
            avgTime: null,
            recordTime: null,
            projectedNext: null
          });
          return;
        }

        const lastTime = points[points.length - 1].seconds;
        const avgTime = data?.stats?.avg ?? null;

        // Velg "rekord" som best clean hvis den finnes, ellers vanlig best
        const recordTime = data?.stats?.bestClean ?? data?.stats?.best ?? null;

        let projectedNext: number | null = null;

        if (points.length >= 2) {
          const n = points.length;
          const xs = points.map((_, i) => i);
          const ys = points.map(pt => pt.seconds);

          const sumX = xs.reduce((a, b) => a + b, 0);
          const sumY = ys.reduce((a, b) => a + b, 0);
          const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
          const sumXX = xs.reduce((a, x) => a + x * x, 0);

          const denom = n * sumXX - sumX * sumX;
          const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
          const b = (sumY - m * sumX) / n;

          projectedNext = Math.max(0, m * n + b);
        }

        setWinnerStats({
          isVirgin: false,
          lastTime,
          avgTime,
          recordTime,
          projectedNext
        });
      })
      .catch(e => console.error(e));

    const idx = currentNames.findIndex(name => name === winnerName);
    const n = currentNames.length;
    const step = (Math.PI * 2) / n;
    const targetLocalAngle = (idx * step) + (step / 2);
    const baseAngle = (Math.PI * 2) - targetLocalAngle;

    let nextAngle = baseAngle + Math.floor(angle / (Math.PI * 2)) * Math.PI * 2;
    if (nextAngle < angle) nextAngle += Math.PI * 2;
    const endAngle = nextAngle + (Math.PI * 2 * 10);
    const startAngle = angle;
    const duration = 5000;
    const t0 = performance.now();

    function anim(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 5);
      setAngle(startAngle + (endAngle - startAngle) * eased);
      if (t < 1) {
        requestAnimationFrame(anim);
        return;
      }

      setAngle(endAngle % (Math.PI * 2));
      setWinner(winnerName);
      setWinnerImage(candidateList.find(p => p.id === winnerId)?.imageUrl || null);
      setPresent(prev => ({ ...prev, [winnerId]: false }));
      fireConfetti();
      setSpinning(false);
    }

    requestAnimationFrame(anim);
  }

  async function addGuestByName(name: string) {
    setFreezeWheel(false);
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/participants/guest-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n })
    });
    const p: Participant = await res.json();
    if (!p.isRegular) {
      setSelectedGuests(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]));
    }
    setPresent(prev => ({ ...prev, [p.id]: true }));
    setGuestQuery("");
  }

  function removeSelectedGuest(id: string) {
    setFreezeWheel(false);
    setSelectedGuests(prev => prev.filter(x => x.id !== id));
    setPresent(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const wheelSize = isExpanded ? Math.min(windowSize.w * 0.9, windowSize.h * 0.75, 850) : 360;

  return (
    <div>
      <h1 style={{ display: isExpanded ? "none" : "block" }}>Hjulet</h1>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 460, display: isExpanded ? "none" : "block" }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Legg til gjest</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
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
            <div style={{ marginBottom: 15, display: "grid", gap: 6 }}>
              {guestLoading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Søker…</div>}
              {guestSuggestions.map(s => (
                <button key={s.id} className="btn" style={{ textAlign: "left" }} onClick={() => addGuestByName(s.name)}>
                  {s.name} <span style={{ opacity: 0.7 }}>{s.isRegular ? "(fast)" : "(gjest)"}</span>
                </button>
              ))}
            </div>
          )}

          <div className="hr" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Deltakere</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={allRegularsSelected}
                onChange={(e) => toggleAllRegulars(e.target.checked)}
              />
              <b>Marker alle faste</b>
            </label>
          </div>

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
              <>
                <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
                  Gjester lagt til i dag
                </div>
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
                    <button className="btn" onClick={() => removeSelectedGuest(p.id)}>Fjern</button>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="hr" />
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Kandidater i hjulet: <b style={{ color: "var(--text)" }}>{candidateIds.length}</b>
          </div>
        </div>

        <div
          className="col card"
          style={{
            position: isExpanded ? "fixed" : "relative",
            inset: isExpanded ? 0 : "auto",
            zIndex: isExpanded ? 9999 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: isExpanded ? "100vw" : "auto",
            height: isExpanded ? "100vh" : "auto",
            background: isExpanded ? "var(--bg, #111)" : "var(--card-bg)",
            margin: 0
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Lukk fullskjerm" : "Fullskjerm"}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: 8,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "var(--text)",
              zIndex: 20,
              transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
          >
            {isExpanded ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {/* Vinner-banner og Stats */}
            <div style={{ minHeight: 110, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              {winner && !spinning ? (
                <>
                  <div style={{ fontSize: isExpanded ? "3.5rem" : "2.4rem", fontWeight: 900, color: "var(--accent)" }}>
                    🎉 {winner} 🎉
                  </div>
                  {winnerStats && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: isExpanded ? "1.1rem" : "0.95rem",
                        background: "rgba(0,0,0,0.3)",
                        padding: "8px 18px",
                        borderRadius: 30
                      }}
                    >
                      {winnerStats.isVirgin ? (
                        <span>Lykke til med jomfruchuggen! 🍻</span>
                      ) : (
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
                          <span>Forrige: <b style={{ color: "var(--accent)" }}>{fmtSeconds(winnerStats.lastTime)}</b></span>
                          <span>Snitt: <b style={{ color: "var(--accent)" }}>{fmtSeconds(winnerStats.avgTime)}</b></span>
                          <span>Rekord: <b style={{ color: "var(--accent)" }}>{fmtSeconds(winnerStats.recordTime)}</b></span>
                          <span>Projisert: <b style={{ color: "var(--accent2)" }}>{fmtSeconds(winnerStats.projectedNext)}</b></span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: "1.2rem", fontWeight: 600 }}>
                  {spinning ? "Spinner..." : "Klikk for å spinne"}
                </div>
              )}
            </div>

            <div
              onClick={() => !spinning && spin()}
              style={{
                cursor: spinning ? "default" : "pointer",
                position: "relative",
                transform: spinning ? "scale(1)" : "scale(1.02)",
                transition: "transform 0.2s"
              }}
            >
              {winner && !spinning && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    zIndex: 10,
                    overflow: "hidden",
                    border: "6px solid var(--accent)",
                    background: "var(--bg)"
                  }}
                >
                  {winnerImage ? (
                    <img src={winnerImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: wheelSize * 0.25, fontWeight: 900, color: "var(--muted)" }}>
                      {getInitials(winner)}
                    </div>
                  )}
                </div>
              )}
              <WheelCanvas size={wheelSize} names={wheelNames.length ? wheelNames : ["Ingen"]} angle={angle} winnerName={winner} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}