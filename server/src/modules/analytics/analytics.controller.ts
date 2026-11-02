import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../shared/errors/app-error.js";
import { User } from "../users/user.model.js";
import * as service from "./analytics.service.js";
const owner = (req: Request) => req.auth!.userId;
export async function overview(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await service.getOverview(owner(req)) }); } catch (error) { next(error); }
}
export async function productivity(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z.object({ from: z.string().datetime(), to: z.string().datetime() }).parse(req.query);
    const user = await User.findById(owner(req)).select("preferences.timezone").lean();
    res.json({ data: await service.getProductivityAnalytics(owner(req), query.from, query.to, user?.preferences?.timezone ?? "Asia/Kolkata") });
  } catch (error) {
    next(error instanceof Error && error.message.startsWith("Analytics date range") ? new AppError(error.message, 400, "INVALID_ANALYTICS_RANGE") : error);
  }
}
export async function finance(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z.object({ from: z.string().datetime(), to: z.string().datetime(), currency: z.string().regex(/^[A-Za-z]{3}$/).optional() }).parse(req.query);
    res.json({ data: await service.getFinanceAnalytics(owner(req), query.from, query.to, query.currency) });
  } catch (error) { next(error); }
}
