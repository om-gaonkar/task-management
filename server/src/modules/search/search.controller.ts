import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { searchWorkspace } from "./search.service.js";

const querySchema = z.object({ q: z.string().trim().min(2).max(100) });

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = querySchema.parse(req.query);
    res.json({ data: await searchWorkspace(req.auth!.userId, q) });
  } catch (error) {
    next(error);
  }
}
