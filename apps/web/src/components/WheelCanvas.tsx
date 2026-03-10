import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  names: string[];
  angle: number;          // radians
  size?: number;          // px
  winnerName?: string;
  isSpinning?: boolean;
  imageSrc?: string;      // Valgfritt bilde i senter
};

const PALETTE = [
  "#547ae8", // Blå
  "#d33335", // Rød
  "#e5b73b", // Gul
  "#5ca147", // Grønn
];

function getSegmentColor(index: number, total: number) {
  let colorIdx = index % PALETTE.length;
  if (index === total - 1 && total > 1) {
    const firstIdx = 0;
    const prevIdx = (index - 1) % PALETTE.length;
    while (colorIdx === firstIdx || colorIdx === prevIdx) {
      colorIdx = (colorIdx + 1) % PALETTE.length;
    }
  }
  return PALETTE[colorIdx];
}

export function WheelCanvas({ names, angle, size = 360, winnerName, isSpinning = false, imageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [centerImg, setCenterImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setCenterImg(img);
  }, [imageSrc]);

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
    const wheelR = r - (15 * scale); 

    ctx.clearRect(0, 0, size, size);

    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 4 * scale;

    // --- 1. TEGN DET ROTERENDE HJULET ---
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);

    for (const seg of segments) {
      const isWinner = winnerName === seg.name;
      const hasWinner = !!winnerName;
      const opacity = hasWinner && !isWinner ? 0.3 : 1;

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wheelR, seg.a0, seg.a1); 
      ctx.closePath();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = seg.fill;
      ctx.fill();
      ctx.strokeStyle = seg.fill;
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
      ctx.globalAlpha = 1.0; 

      const mid = (seg.a0 + seg.a1) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid + Math.PI);        
      ctx.translate(-wheelR * 0.9, 0); 
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.font = `400 ${22 * scale}px system-ui, sans-serif`;
      ctx.textAlign = "left"; 
      ctx.textBaseline = "middle";
      ctx.fillText(seg.name, 0, 0);
      ctx.restore();
    }
    ctx.restore(); 


    // --- 2. STATISK TEKST CURVET RUNDT TOPPEN OG BUNNEN ---
    if (!isSpinning && !winnerName) {
      
      const staticTextRadius = wheelR * 0.82; 
      const textFontSize = 20 * scale;
      
      ctx.save();
      ctx.font = `900 ${textFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Innstillinger for den tynne sorte outlinen
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5 * scale; // Tykkelse på outline
      ctx.lineJoin = "round"; // Gjør at hjørnene på outlinen ikke blir "spisse"
      
      ctx.shadowColor = "rgba(0,0,0,0.8)"; 
      ctx.shadowBlur = 6 * scale;
      ctx.shadowOffsetY = 2 * scale;

      // --- LINJE 1: TOPP-BUEN ---
      ctx.save();
      ctx.translate(cx, cy);
      const text1 = "TRYKK PÅ HJULET";
      
      const totalWidth1 = ctx.measureText(text1).width;
      const angleSpread1 = totalWidth1 / staticTextRadius;
      
      ctx.rotate(-angleSpread1 / 2); 

      for (let i = 0; i < text1.length; i++) {
        const char = text1[i];
        const charWidth = ctx.measureText(char).width;
        const charAngle = charWidth / staticTextRadius;

        ctx.rotate(charAngle / 2);
        
        // Tegn outline FØR fyllet!
        ctx.strokeText(char, 0, -staticTextRadius); 
        ctx.fillText(char, 0, -staticTextRadius); 
        
        ctx.rotate(charAngle / 2);
      }
      ctx.restore();


      // --- LINJE 2: BUNN-BUEN ---
      ctx.save();
      ctx.translate(cx, cy);
      const text2 = "FOR Å VELGE CHUGGER";
      
      const totalWidth2 = ctx.measureText(text2).width;
      const angleSpread2 = totalWidth2 / staticTextRadius;
      
      ctx.rotate(Math.PI); 
      ctx.rotate(angleSpread2 / 2); 

      for (let i = 0; i < text2.length; i++) {
        const char = text2[i];
        const charWidth = ctx.measureText(char).width;
        const charAngle = charWidth / staticTextRadius;

        ctx.rotate(-charAngle / 2);
        
        ctx.save();
        ctx.translate(0, -staticTextRadius);
        ctx.rotate(Math.PI); 
        
        // Tegn outline FØR fyllet!
        ctx.strokeText(char, 0, 0); 
        ctx.fillText(char, 0, 0); 
        
        ctx.restore();
        
        ctx.rotate(-charAngle / 2);
      }
      ctx.restore();

      ctx.restore(); 
    }


    // --- 3. ROTERENDE SENTER MED BILDE ---
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle); 

    ctx.beginPath();
    ctx.arc(0, 0, wheelR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff"; 
    ctx.fill();

    if (centerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, wheelR * 0.22, 0, Math.PI * 2);
      ctx.clip(); 
      const imgSize = wheelR * 0.44; 
      ctx.drawImage(centerImg, -imgSize/2, -imgSize/2, imgSize, imgSize);
      ctx.restore();
    }
    ctx.restore();


    // --- 4. FINN AKTIV FARGE FOR PEKEREN ---
    const n = Math.max(names.length, 1);
    const step = (Math.PI * 2) / n;
    let pointerAngle = (-angle) % (Math.PI * 2);
    if (pointerAngle < 0) pointerAngle += Math.PI * 2; 
    
    const activeIndex = Math.floor(pointerAngle / step) % n;
    const activeColor = segments[activeIndex]?.fill || "#4f72df";

    // --- 5. PEKEREN (Pointer) ---
    ctx.shadowColor = "rgba(0,0,0,0.4)"; 
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;

    ctx.beginPath();
    ctx.moveTo(cx + wheelR - (2 * scale), cy); 
    ctx.lineTo(cx + wheelR + (22 * scale), cy - (14 * scale));
    ctx.lineTo(cx + wheelR + (18 * scale), cy); 
    ctx.lineTo(cx + wheelR + (22 * scale), cy + (14 * scale));
    ctx.closePath();

    ctx.fillStyle = activeColor; 
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)"; 
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

  }, [segments, angle, size, winnerName, isSpinning, centerImg]);

  return <canvas ref={canvasRef} />;
}