import express from "express";
import cors from "cors";

import { participantsRouter } from "./routes/participants";
import { wheelRouter } from "./routes/wheel";
import { rulesRouter } from "./routes/rules";
import { statsRouter } from "./routes/stats";
import { importRouter } from "./routes/import";
import { sessionsRouter } from "./routes/sessions";
import { attemptsRouter } from "./routes/attempts";
import { personRouter } from "./routes/person";
import { leaderboardRouter } from "./routes/leaderboard";
import { analyticsRouter } from "./routes/analytics";


const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/participants", participantsRouter);
app.use("/api/wheel", wheelRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/import", importRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/person", personRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/analytics", analyticsRouter);


const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));