import express from "express";
import cors from "cors";
import { wheelRouter } from "./routes/wheel";
import { participantsRouter } from "./routes/participants";
import { rulesRouter } from "./routes/rules";
import { violationsRouter } from "./routes/violations";
import { statsRouter } from "./routes/stats";
import { importRouter } from "./routes/import";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/wheel", wheelRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/violations", violationsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/import", importRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));