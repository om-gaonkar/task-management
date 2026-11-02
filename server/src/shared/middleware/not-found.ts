import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error.js";
export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("The requested route was not found", 404, "ROUTE_NOT_FOUND"));
}
