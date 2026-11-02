import type { NextFunction, Request, Response } from "express";
import { authenticateRequest, enforceCsrf } from "./auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = await authenticateRequest(req);
    req.auth = { userId: auth.userId, sessionId: auth.sessionId, csrfToken: "" };
    if (!safeMethods.has(req.method)) await enforceCsrf(req, auth.csrfHash);
    next();
  } catch (error) {
    next(error instanceof Error ? error : new AppError("Unauthorized", 401));
  }
}
