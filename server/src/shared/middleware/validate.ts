import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(new AppError(parsed.error.issues.map((issue) => issue.message).join("; "), 400, "VALIDATION_ERROR"));
    req.body = parsed.data;
    next();
  };
}
