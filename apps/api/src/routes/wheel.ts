import { Router } from "express";
import { prisma } from "../prisma.js";
import { randomInt } from "crypto";

export const wheelRouter = Router();

async function getQuantumUint16WithTimeout(ms = 2500): Promise<number> {
  const url = "https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16";
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`QRNG HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.data)) throw new Error("Bad QRNG response");
    return Number(json.data[0]);
  } finally {
    clearTimeout(t);
  }
}

function pickIndexFromUint(q: number, n: number): number {
  return ((q % n) + n) % n;
}

wheelRouter.post("/spin", async (req, res) => {
  const { participantIds } = req.body as { participantIds: string[] };
  if (!participantIds?.length) return res.status(400).json({ error: "No candidates" });

  let idx: number;
  let source: "quantum" | "crypto" = "quantum";
  let q: number | null = null;

  try {
    q = await getQuantumUint16WithTimeout(2500);
    idx = pickIndexFromUint(q, participantIds.length);
  } catch {
    // Fallback: kryptografisk random (stabilt)
    source = "crypto";
    idx = randomInt(0, participantIds.length);
  }

  const winnerId = participantIds[idx];
  const winner = await prisma.participant.findUnique({ where: { id: winnerId } });

  res.json({ winner, idx, source, quantum: q });
});
