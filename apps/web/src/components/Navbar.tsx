import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      // Aktiver krymping når man scroller mer enn 50px
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Viser Hero-størrelse KUN hvis vi er på Home og er øverst på siden
  const isHeroMode = isHome && !scrolled;

  return (
    <>
      {/* PLACEHOLDER: Denne er avgjørende! 
        Den sørger for at innholdet på de andre sidene ikke forsvinner opp under den tykkere navbaren. 
      */}
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
              <NavLink to="/grotta" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
                Grotta
              </NavLink>
            </div>
            
          </div>
        </div>
      </nav>
    </>
  );
}