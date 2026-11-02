import type { Request, Response, NextFunction } from "express";
import * as service from "./auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ data: await service.register(req.body) }); } catch (error) { next(error); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.login(req.body, req, res) } }); } catch (error) { next(error); }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.verifyEmail(req.body.token) }); } catch (error) { next(error); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new AppError("Authentication required", 401);
    res.json({ data: { user: await service.currentUser(req.auth.userId) } });
  } catch (error) { next(error); }
}

export async function logout(_req: Request, res: Response, next: NextFunction) {
  try { await service.logout(_req, res); res.status(204).send(); } catch (error) { next(error); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.refreshSession(req, res) } }); } catch (error) { next(error); }
}
