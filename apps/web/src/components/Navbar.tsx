import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authClient } from "../auth/client";
import { useAuthSession } from "../auth/useAuthSession";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, isPending, user } = useAuthSession();
  const isHome = location.pathname === "/";

  // LØSNINGEN: Er vi på forsiden, er den ALLTID i hero-modus (låst). 
  // På andre sider bytter den til kompakt.
  const isHeroMode = isHome; 

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/");
  }

  return (
    <>
      <div className={`navPlaceholder ${isHeroMode ? "hero" : "compact"}`} />
      
      <nav className={`navWrap ${isHeroMode ? "heroMode" : "compactMode"}`}>
        <div className="navBar">
          <div className="container navInner">
            
            <div className="navLogoContainer">
              <NavLink to="/">
                <img 
                  src="/grottalogo.png" 
                  alt="Grotta Logo" 
                  className="navLogo" 
                />
              </NavLink>
            </div>
            
            <div className="navControls">
              <div className="navLinks">
                <NavLink to="/wheel" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
                  Hjulet
                </NavLink>
                <NavLink to="/chug" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
                  Chuggelista
                </NavLink>
                <NavLink to="/violations" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
                  Kryssliste
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
                <NavLink to="/grotta" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
                  Grotta
                </NavLink>
              </div>

              <div className="navAuth">
                {isPending ? (
                  <span className="pill">Sjekker innlogging…</span>
                ) : isAuthenticated ? (
                  <>
                    <span className="pill">{user?.name}</span>
                    <span className="pill">{isAdmin ? "admin" : "member"}</span>
                    <button className="btn" onClick={handleSignOut}>
                      Logg ut
                    </button>
                  </>
                ) : (
                  <NavLink to="/login" className="btn">
                    Login
                  </NavLink>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
