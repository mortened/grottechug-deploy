import { Router } from "express";
import { prisma } from "../prisma";

export const wheelRouter = Router();

async function getQuantumUint16(): Promise<number> {
  const url = "https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16";
  const res = await fetch(url);
  if (!res.ok) throw new Error("QRNG request failed");
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.data)) throw new Error("Bad QRNG response");
  return Number(json.data[0]);
}

wheelRouter.post("/spin", async (req, res) => {
  const { participantIds } = req.body as { participantIds: string[] };
  if (!participantIds?.length) return res.status(400).json({ error: "No candidates" });

  const q = await getQuantumUint16();
  const idx = q % participantIds.length;
  const winnerId = participantIds[idx];

  const winner = await prisma.participant.findUnique({ where: { id: winnerId } });
  res.json({ winner, quantum: q, idx });
});