import { Router } from "express";
import { prisma } from "../prisma";

export const participantsRouter = Router();

/**
 * SEARCH (må ligge før /:id routes)
 * GET /api/participants/search?query=Maria
 */
participantsRouter.get("/search", async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (!query) return res.json([]);

  const q = query.toLowerCase();

  const people = await prisma.participant.findMany({
    where: { nameLower: { contains: q } }, // ✅ ingen "mode"
    orderBy: [{ isRegular: "desc" }, { name: "asc" }],
    take: 12
  });

  res.json(people);
});

/**
 * GET /api/participants?includeGuests=true|false
 */
participantsRouter.get("/", async (req, res) => {
  const includeGuests = req.query.includeGuests === "true";
  const where = includeGuests ? {} : { isRegular: true };

  const people = await prisma.participant.findMany({
    where,
    orderBy: [{ isRegular: "desc" }, { name: "asc" }]
  });

  res.json(people);
});

/**
 * POST /api/participants/guest-upsert
 * body: { name: "Maria" }
 * - returnerer eksisterende (case-insensitive) hvis den finnes
 * - ellers oppretter ny gjest
 */
participantsRouter.post("/guest-upsert", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  const nameLower = name.toLowerCase();

  // ✅ Finn på nameLower (case-insensitive)
  const existing = await prisma.participant.findUnique({ where: { nameLower } });
  if (existing) return res.json(existing);

  const created = await prisma.participant.create({
    data: {
      name,
      nameLower,
      isRegular: false
    }
  });

  res.json(created);
});

/**
 * DELETE /api/participants/:id
 * (legg disse til sist!)
 */
participantsRouter.delete("/:id", async (req, res) => {
  await prisma.participant.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/**
 * DELETE /api/participants/:id/hard
 * (sletter attempts + violations først)
 */
participantsRouter.delete("/:id/hard", async (req, res) => {
  const { id } = req.params;
  await prisma.attempt.deleteMany({ where: { participantId: id } });
  await prisma.violation.deleteMany({ where: { participantId: id } });
  await prisma.participant.delete({ where: { id } });
  res.json({ ok: true });
});