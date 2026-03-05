import { NavLink } from "react-router-dom";

export function Navbar() {
  return (
    <div className="navWrap">
      <div className="navBar">
        <div className="container navInner">
          <div className="brand">Grottechug</div>

          <div className="navLinks">
            <NavLink to="/wheel" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Hjulet
            </NavLink>
            <NavLink to="/chug" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Chuggelista
            </NavLink>
            <NavLink to="/rules" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Regler
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Toppliste
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Statistikk
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}