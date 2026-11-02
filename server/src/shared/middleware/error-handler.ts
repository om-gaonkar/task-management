import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { logger } from "../../config/logger.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = error instanceof AppError ? error : new AppError("Internal server error");
  if (appError.statusCode >= 500) logger.error({ err: error, requestId: req.get("x-request-id") }, "Request failed");
  res.status(appError.statusCode).json({ error: { code: appError.code, message: appError.message } });
};
