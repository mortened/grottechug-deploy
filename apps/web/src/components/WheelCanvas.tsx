import { useEffect, useMemo, useRef } from "react";

type Props = {
  names: string[];
  angle: number;          // radians
  size?: number;          // px
  winnerName?: string;
};

function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 55% / 0.85)`;
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
      fill: hashColor(name)
    }));
  }, [names]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const r = size / 2;
    const cx = r, cy = r;

    ctx.clearRect(0, 0, size, size);

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    // Wheel rotated
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);

    for (const seg of segments) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 6, seg.a0, seg.a1);
      ctx.closePath();
      ctx.fillStyle = seg.fill;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // label
      const mid = (seg.a0 + seg.a1) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);                 // roter til segmentretning
      ctx.translate(r * 0.20, 0);      // start litt ut fra sentrum
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "600 14px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(seg.name, 0, 0);
      ctx.restore();
    }

    // center cap
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();

    ctx.restore();

    // pointer at right
    ctx.beginPath();
    ctx.moveTo(size - 8, cy);
    ctx.lineTo(size - 36, cy - 14);
    ctx.lineTo(size - 36, cy + 14);
    ctx.closePath();
    ctx.fillStyle = "rgba(233,237,255,0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();

    if (winnerName) {
      ctx.fillStyle = "rgba(233,237,255,0.92)";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`Først ut: ${winnerName}`, cx, size - 16);
    }
  }, [segments, angle, size, winnerName]);

  return <canvas ref={canvasRef} />;
}