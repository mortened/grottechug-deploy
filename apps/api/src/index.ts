import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { auth, isTrustedOrigin } from "./auth.js";
import { appEnv, assertProductionEnv } from "./env.js";
import { participantsRouter } from "./routes/participants.js";
import { wheelRouter } from "./routes/wheel.js";
import { rulesRouter } from "./routes/rules.js";
import { statsRouter } from "./routes/stats.js";
import { importRouter } from "./routes/import.js";
import { sessionsRouter } from "./routes/sessions.js";
import { attemptsRouter } from "./routes/attempts.js";
import { personRouter } from "./routes/person.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { analyticsRouter } from "./routes/analytics.js";
import { crossesRouter } from "./routes/crosses.js";
import { violationsRouter } from "./routes/violations.js";

assertProductionEnv();

const app = express();
const authHandler = toNodeHandler(auth);

app.set("trust proxy", 1);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || isTrustedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
}));

app.all("/api/auth", authHandler);
app.all("/api/auth/*splat", authHandler);

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
app.use("/api/crosses", crossesRouter);
app.use("/api/violations", violationsRouter);

const port = appEnv.port;

app.listen(port, () => {
  console.log(`API running on ${appEnv.betterAuthUrl ?? `http://localhost:${port}`}`);
});
