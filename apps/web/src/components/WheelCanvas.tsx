import { useEffect, useMemo, useRef } from "react";

type Props = {
  names: string[];
  angle: number;          // radians
  size?: number;          // px
  winnerName?: string;
};

// En mye sprekere og mer moderne fargepalett
const PALETTE = [
  "#ef4444", // Rød
  "#3b82f6", // Blå
  "#10b981", // Smaragdgrønn
  "#f59e0b", // Rav/Gul
  "#8b5cf6", // Lilla
  "#ec4899", // Rosa
  "#14b8a6", // Teal
  "#f97316", // Oransje
];

// Funksjon som garanterer at to nabofelter aldri har samme farge
function getSegmentColor(index: number, total: number) {
  let colorIdx = index % PALETTE.length;
  
  // Hvis vi er på den aller siste biten av hjulet...
  if (index === total - 1 && total > 1) {
    const firstIdx = 0;
    const prevIdx = (index - 1) % PALETTE.length;
    
    // Vi skyver fargen ett hakk frem helt til den verken krasjer med 
    // den forrige fargen ELLER den aller første fargen i hjulet.
    while (colorIdx === firstIdx || colorIdx === prevIdx) {
      colorIdx = (colorIdx + 1) % PALETTE.length;
    }
  }
  return PALETTE[colorIdx];
}

export function WheelCanvas({ names, angle, size = 360, winnerName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const segments = useMemo(() => {
    const n = Math.max(names.length, 1);
    const step = (Math.PI * 2) / n;
    return names.map((name, i) => ({
      name,
      a0: i * step,
      a1: (i + 1) * step,
      fill: getSegmentColor(i, n)
    }));
  }, [names]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const scale = size / 360;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const r = size / 2;
    const cx = r, cy = r;

    // Vi gjør selve hjulet litt mindre for å få plass til velgeren på høyresiden
    const wheelR = r - (25 * scale); 

    ctx.clearRect(0, 0, size, size);

    // 1. Ytre skygge for hele hjulet
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15 * scale;
    ctx.shadowOffsetY = 5 * scale;

    // Ytre sirkel (Kant/ramme)
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
    ctx.fillStyle = "#1e1e24"; 
    ctx.fill();

    // Resett skygge for innholdet i hjulet
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // --- START ROTERT HJUL ---
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);

    // 2. Tegn alle segmentene sømløst
    for (const seg of segments) {
      const isWinner = winnerName === seg.name;
      const hasWinner = !!winnerName;
      // Dim ned de andre hvis vi har en vinner
      const opacity = hasWinner && !isWinner ? 0.3 : 1;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wheelR - (6 * scale), seg.a0, seg.a1);
      ctx.closePath();

      ctx.globalAlpha = opacity;
      ctx.fillStyle = seg.fill;
      ctx.fill();
      
      // Trikset for å unngå "usynlige" gliper mellom fargene pga. anti-aliasing i nettleseren:
      // Tegn en 1px strek rundt feltet med akkurat samme farge som fyllet.
      ctx.strokeStyle = seg.fill;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      
      ctx.globalAlpha = 1.0; 

      // Tekst
      const mid = (seg.a0 + seg.a1) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);                 
      ctx.translate(wheelR * 0.6, 0); // Plassering av tekst
      
      // Tekstskygge for lesbarhet over de nye fargene
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 5 * scale;
      ctx.shadowOffsetY = 2 * scale;
      
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.font = `bold ${15 * scale}px system-ui`;
      ctx.textAlign = "center"; 
      ctx.textBaseline = "middle";
      ctx.fillText(seg.name, 0, 0);
      ctx.restore();
    }

    // 3. Tegn "Knotter" (Pegs) rundt kanten
    for (const seg of segments) {
      ctx.beginPath();
      const pegX = cx + Math.cos(seg.a0) * (wheelR - 6 * scale);
      const pegY = cy + Math.sin(seg.a0) * (wheelR - 6 * scale);
      
      ctx.arc(pegX, pegY, 1.5 * scale, 0, Math.PI * 2); 
      ctx.fillStyle = "#ffd700"; 
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 0.5 * scale; 
      ctx.stroke();
    }

    ctx.restore();
    // --- SLUTT ROTERT HJUL ---

    // 4. Senter (Center Cap) 
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 3 * scale;

    ctx.beginPath();
    ctx.arc(cx, cy, wheelR * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = "#e2e2e2"; 
    ctx.fill();
    
    // Indre ring på senter
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR * 0.08, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // 5. Pekeren (Pointer) trukket ut til høyre kant
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 4 * scale;

    ctx.beginPath();
    // Spissen hviler akkurat på den mørke rammen (wheelR)
    ctx.moveTo(cx + wheelR*0.9 - (2.5 * scale), cy); 
    ctx.lineTo(cx + wheelR + (18 * scale), cy - (16 * scale));
    ctx.lineTo(cx + wheelR + (12 * scale), cy); 
    ctx.lineTo(cx + wheelR + (18 * scale), cy + (16 * scale));
    ctx.closePath();

    ctx.fillStyle = "#ff4b4b"; 
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

  }, [segments, angle, size, winnerName]);

  return <canvas ref={canvasRef} />;
}