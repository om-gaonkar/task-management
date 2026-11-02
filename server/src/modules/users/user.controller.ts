import type { Request, Response, NextFunction } from "express";
import * as service from "./user.service.js";
const owner = (req: Request) => req.auth!.userId;
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.getProfile(owner(req)) } }); } catch (error) { next(error); }
}
export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.updateProfile(owner(req), req.body) } }); } catch (error) { next(error); }
}
export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: { user: await service.updatePreferences(owner(req), req.body) } }); } catch (error) { next(error); }
}
