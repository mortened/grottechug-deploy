import { useLayoutEffect, useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { apiFetch } from "../lib/api";

type Semester = "2026V" | "2025H" | "all";

type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
  bestClean: number;
  dateISO: string;
};

type Resp = { semester: string; rows: Row[] };

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function Podium({
  title,
  rows,
  showAvatar
}: {
  title: string;
  rows: Row[];
  showAvatar: boolean;
}) {
  const nav = useNavigate();
  const top3 = rows.slice(0, 3);

  return (
    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {!top3.length ? (
        <div style={{ color: "var(--muted)", flex: 1 }}>
          Ingen data funnet.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flex: 1, paddingBottom: 10 }}>
          {[1, 0, 2].map(pos => {
            const r = top3[pos];
            const rank = pos === 0 ? 1 : pos === 1 ? 2 : 3;
            const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const height = pos === 0 ? 170 : pos === 1 ? 140 : 120;

            const hasBgImage = showAvatar && r?.imageUrl;
            const bgStyle = hasBgImage
              ? { backgroundImage: `url(${r.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: "rgba(0,0,0,0.18)" };

            const frameColors = {
              1: { border: "#FFD700", glow: "rgba(255, 215, 0, 0.3)" },
              2: { border: "#C0C0C0", glow: "rgba(192, 192, 192, 0.3)" },
              3: { border: "#CD7F32", glow: "rgba(205, 127, 50, 0.3)" }
            };
            const theme = frameColors[rank as keyof typeof frameColors];

            return (
              <button
                key={pos}
                onClick={() => r && nav(`/person/${r.participantId}`)}
                disabled={!r}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: r ? "pointer" : "default",
                  textAlign: "center",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <div style={{ fontSize: "1.6rem", marginBottom: 6, lineHeight: 1 }}>{label}</div>
                <div
                  style={{
                    height,
                    width: "100%",
                    borderRadius: 18,
                    border: r ? `3px solid ${theme.border}` : "2px dashed rgba(255,255,255,0.14)",
                    boxShadow: r ? `0 4px 15px ${theme.glow}` : "none",
                    ...bgStyle,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {r && showAvatar && !hasBgImage && <Avatar name={r.name} size={height * 0.4} />}
                  {!r && <div style={{ color: "var(--muted)" }}>—</div>}
                </div>
                {r ? (
                  <div style={{ marginTop: 8, width: "100%", textAlign: "center", color: "var(--text)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{r.bestClean.toFixed(2)}s</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: "0.85rem", color: "transparent" }}>&nbsp;</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeaderboardPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  const [showGuests, setShowGuests] = useState<boolean>(false);
  
  const rightColRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/api/leaderboard?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [semester]);

  const rows = data?.rows ?? [];
  const topRegular = useMemo(() => rows.filter(r => r.isRegular), [rows]);
  const tableRows = showGuests ? rows : topRegular;

  // Låser høyden basert på 2026V én gang
  useLayoutEffect(() => {
    if (semester === "2026V" && !showGuests && rightColRef.current && topRegular.length > 0) {
      const height = rightColRef.current.getBoundingClientRect().height;
      if (height > 100) {
        setLockedHeight(height);
      }
    }
  }, [data, semester, showGuests, topRegular]);

  return (
    <div style={{ paddingBottom: 60 }}>
      <h1>Toppliste</h1>
      <p>Rangert etter beste tid uten anmerkning.</p>

      <div className="tabs" style={{ marginTop: 10 }}>
        {["2025H", "2026V", "all"].map((s) => (
          <button 
            key={s}
            className={`tab ${semester === s ? "tabActive" : ""}`} 
            onClick={() => setSemester(s as Semester)}
          >
            {s === "all" ? "Total" : s === "2025H" ? "2025 Høst" : "2026 Vår"}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginTop: 14, alignItems: "stretch" }}>
        
        {/* Venstre kolonne - Podium */}
        <div 
          className="col" 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: 14, 
            minHeight: lockedHeight,
            height: lockedHeight
          }}
        >
          <Podium title="Podium (kun grottamedlemmer)" rows={topRegular} showAvatar />
          <Podium title="Best uansett" rows={rows} showAvatar />
        </div>

        {/* Høyre kolonne - Listen */}
        <div 
          className="col card" 
          ref={rightColRef}
          style={{ 
            display: "flex", 
            flexDirection: "column",
            minHeight: lockedHeight,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>Hele listen</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={showGuests} onChange={(e) => setShowGuests(e.target.checked)} />
              Vis gjester
            </label>
          </div>

          <div className="tableWrap" style={{ border: "none", overflow: "visible" }}>
            <table style={{ 
              width: "100%", 
              minWidth: "0", 
              textAlign: "left", 
              borderCollapse: "collapse",
              tableLayout: "auto" 
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 8px", width: "50px", textAlign: "center", background: "transparent" }}>#</th>
                  <th style={{ padding: "10px 8px", background: "transparent" }}>Navn</th>
                  <th style={{ padding: "10px 8px", width: "80px", background: "transparent" }}>Tid</th>
                  <th style={{ padding: "10px 8px", width: "110px", background: "transparent" }}>Dato</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r: any, i) => (
                  <tr key={`${r.participantId}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 900 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button 
                        className="btn" 
                        style={{ 
                          padding: "6px 12px", 
                          fontSize: "15px",
                          fontWeight: 500,
                          whiteSpace: "normal", 
                          textAlign: "left" 
                        }} 
                        onClick={() => nav(`/person/${r.participantId}`)}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{r.bestClean.toFixed(2)}s</td>
                    <td style={{ padding: "8px" }}>
                      {/* NYTT: Diskret lenke til Session-siden */}
                      <button
                        className="btnGhost"
                        style={{
                          padding: "6px 8px",
                          borderRadius: "8px",
                          border: "none",
                          color: "var(--muted)",
                          fontSize: "13px",
                          cursor: "pointer",
                          transition: "color 0.2s, background 0.2s",
                          background: "transparent",
                          textAlign: "left"
                        }}
                        onClick={() => nav(`/session/${r.sessionId}`)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--accent)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--muted)";
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="Se dagsrapport for denne kvelden"
                      >
                        {fmtDDMMYYYY(r.dateISO)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
