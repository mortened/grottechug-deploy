import { Router } from "express";
import { prisma } from "../prisma";

export const sessionsRouter = Router();

// GET /api/sessions?semester=...
sessionsRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all");
  const where = semester === "all" ? {} : { semester };
  const sessions = await prisma.session.findMany({
    where,
    orderBy: { date: "asc" },
    select: { id: true, date: true, semester: true, note: true }
  });
  res.json(
    sessions.map(s => ({ ...s, dateISO: s.date.toISOString() }))
  );
});

// GET /api/sessions/:id/stats
// VIKTIG: Denne må ligge FØR ruter som bare har /:id (slik som DELETE og PATCH)
sessionsRouter.get("/:id/stats", async (req, res) => {
  try {
    const id = String(req.params.id);

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        attempts: {
          // FIKS: Bruker { gt: 0 } i stedet for { not: null } for å unngå Prisma-krasj
          where: { seconds: { gt: 0 } },
          include: { 
            participant: {
              select: { name: true, isRegular: true }
            } 
          }
        },
        violations: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Hent alle forsøk for å kunne beregne rankingen til denne dagen
    const allAttempts = await prisma.attempt.findMany({
      // FIKS: Bruker { gt: 0 } her også
      where: { seconds: { gt: 0 } },
      select: { sessionId: true, seconds: true }
    });

    const sessionMap = new Map<string, { total: number, count: number }>();
    for (const a of allAttempts) {
      if (!sessionMap.has(a.sessionId)) sessionMap.set(a.sessionId, { total: 0, count: 0 });
      const data = sessionMap.get(a.sessionId)!;
      data.total += a.seconds!;
      data.count += 1;
    }

    // Lag en sortert liste over alle dagers snitt
    const rankList = Array.from(sessionMap.entries()).map(([sId, data]) => ({
      sessionId: sId,
      avg: data.total / data.count
    })).sort((a, b) => a.avg - b.avg);

    const rankIndex = rankList.findIndex(x => x.sessionId === id);
    const rank = rankIndex !== -1 ? rankIndex + 1 : null;
    const totalSessions = rankList.length;

    // Sorter dagens forsøk fra raskest til tregest
    const validAttempts = session.attempts.map(a => ({
      participantId: a.participantId,
      name: a.participant.name,
      isRegular: a.participant.isRegular,
      seconds: a.seconds!,
      note: a.note
    })).sort((a, b) => a.seconds - b.seconds);

    const participantCount = validAttempts.length;
    const avgTime = participantCount > 0 ? validAttempts.reduce((sum, a) => sum + a.seconds, 0) / participantCount : null;
    const fastest = participantCount > 0 ? validAttempts[0] : null;
    const slowest = participantCount > 0 ? validAttempts[participantCount - 1] : null;

    const wetCount = session.violations.filter(v => ["W", "VW", "MM", "P", "T"].includes(v.ruleCode)).length;
    const wetRate = participantCount > 0 ? (wetCount / participantCount) * 100 : 0;

    res.json({
      id: session.id,
      dateISO: session.date.toISOString(),
      semester: session.semester,
      note: session.note,
      participantCount,
      avgTime,
      fastest,
      slowest,
      rank,
      totalSessions,
      wetRate,
      attempts: validAttempts
    });
  } catch (error) {
    console.error("Feil ved uthenting av session stats:", error);
    res.status(500).json({ error: "Kunne ikke hente session stats" });
  }
});

// POST /api/sessions
sessionsRouter.post("/", async (req, res) => {
  try {
    const { dateISO, semester } = req.body as { dateISO: string; semester: string };
    const date = new Date(dateISO);
    if (!semester || Number.isNaN(date.getTime())) return res.status(400).send("Bad input: dateISO/semester");

    const created = await prisma.session.upsert({
      where: { date },
      update: { semester },
      create: { date, semester },
      select: { id: true, date: true, semester: true, note: true }
    });

    res.json({ ...created, dateISO: created.date.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).send(String(err));
  }
});

// PATCH /api/sessions/:id  body: { note?: string|null }
sessionsRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const noteRaw = req.body?.note;
  const note = noteRaw === undefined ? undefined : String(noteRaw).trim();

  const updated = await prisma.session.update({
    where: { id },
    data: { ...(note !== undefined ? { note: note || null } : {}) },
    select: { id: true, date: true, semester: true, note: true }
  });

  res.json({ ...updated, dateISO: updated.date.toISOString() });
});

// NY: DELETE for å slette en hel dag
sessionsRouter.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    // Husk at du MÅ ha onDelete: Cascade på relationen fra Attempt til Session i schema.prisma 
    // for at dette skal fungere hvis det finnes chugs registrert denne dagen!
    await prisma.session.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Kunne ikke slette session. Har du onDelete: Cascade i schema.prisma?");
  }
});