import { Router } from "express";
import { prisma } from "../prisma";

export const participantsRouter = Router();

// GET /api/participants?includeGuests=true|false
participantsRouter.get("/", async (req, res) => {
  const includeGuests = req.query.includeGuests === "true";
  const where = includeGuests ? {} : { isRegular: true };

  const people = await prisma.participant.findMany({
    where,
    orderBy: [{ isRegular: "desc" }, { name: "asc" }]
  });

  res.json(people);
});

// POST /api/participants/guest
participantsRouter.post("/guest", async (req, res) => {
  const nameRaw = (req.body?.name ?? "") as string;
  const name = nameRaw.trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  const created = await prisma.participant.create({
    data: { name, isRegular: false }
  });
  res.json(created);
});

participantsRouter.delete("/:id", async (req, res) => {
  await prisma.participant.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});