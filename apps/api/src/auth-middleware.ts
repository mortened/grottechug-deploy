import type { NextFunction, Request, Response } from "express";
import { getRequestSession } from "./auth.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getRequestSession(req.headers);

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (session.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.locals.authSession = session;
    next();
  } catch (error) {
    next(error);
  }
}
