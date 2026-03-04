import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: isActive ? "rgba(124,92,255,0.22)" : "rgba(0,0,0,0.18)"
});

export function Navbar() {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(10px)" }}>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.10)", background: "rgba(11,16,32,0.65)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>Grottechug</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavLink to="/wheel" style={linkStyle}>Hjulet</NavLink>
            <NavLink to="/chug" style={linkStyle}>Chuggelista</NavLink>
            <NavLink to="/rules" style={linkStyle}>Regler</NavLink>
            <NavLink to="/leaderboard" style={linkStyle}>Toppliste</NavLink>
            <NavLink to="/stats" style={linkStyle}>Statistikk</NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}