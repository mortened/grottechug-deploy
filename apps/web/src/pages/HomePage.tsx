import { Link } from "react-router-dom";
import { useEffect } from "react";

export function HomePage() {
  // Låser scrolling mens man er på forsiden
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div style={{ 
      height: "70vh", // Tar hele skjermens høyde
      width: "100%", // Tvinger full bredde for perfekt horisontal sentrering
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      textAlign: "center",
      paddingLeft: "20px",
      paddingRight: "20px",
      boxSizing: "border-box",
      overflow: "hidden" 
    }}>
      
      {/* Sentral Logo og Velkomst */}
      <div style={{ maxWidth: "800px", width: "100%", marginBottom: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        
        {/* Logoen er lagt til her på selve siden */}
        <img 
          src="/logo-enkel.png" 
          alt="Grotta Logo" 
          style={{ 
            width: "100%",
            maxWidth: "320px", // Hindrer at logoen blir massiv på store skjermer, men krymper på mobil
            marginBottom: "20px",
            filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))"
          }} 
        />

        <p style={{ 
          fontSize: "1.2rem", 
          color: "var(--muted)", 
          lineHeight: "1.5",
          marginBottom: "30px",
          marginTop: "10px",
          maxWidth: "600px" // Gjør at tekstlinjene ikke blir for lange og uleselige
        }}>
          Den offisielle plattformen for chugge-statistikk, hjulet og de harde fakta fra Grotta.
        </p>
        
        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/wheel" className="btn btnPrimary" style={{ padding: "14px 28px", fontSize: "1.1rem" }}>
            Spinn Hjulet
          </Link>
          <Link to="/leaderboard" className="btn" style={{ padding: "14px 28px", fontSize: "1.1rem" }}>
            Toppliste
          </Link>
        </div>
      </div>

      {/* Oversikt over funksjoner */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
        gap: "20px",
        width: "100%",
        maxWidth: "1100px" // Samme maksimale bredde som .container
      }}>
        <Link to="/wheel" className="card cardCard" style={{ padding: "20px", textDecoration: "none" }}>
          <h2 style={{ color: "var(--accent2)", fontSize: "1.3rem", marginBottom: "8px" }}>Hjulet</h2>
          <p style={{ fontSize: "0.95rem", margin: 0 }}>Trekk neste chugger på en rettferdig måte.</p>
        </Link>
        
        <Link to="/stats" className="card cardCard" style={{ padding: "20px", textDecoration: "none" }}>
          <h2 style={{ color: "var(--accent)", fontSize: "1.3rem", marginBottom: "8px" }}>Statistikk</h2>
          <p style={{ fontSize: "0.95rem", margin: 0 }}>Følg med på utvikling og personlige rekorder.</p>
        </Link>
        
        <Link to="/rules" className="card cardCard" style={{ padding: "20px", textDecoration: "none" }}>
          <h2 style={{ color: "var(--danger)", fontSize: "1.3rem", marginBottom: "8px" }}>Regelverk</h2>
          <p style={{ fontSize: "0.95rem", margin: 0 }}>Lær deg forskjellen på de ulike chugge-typene.</p>
        </Link>
      </div>
      
    </div>
  );
}