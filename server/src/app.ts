import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import { errorHandler } from "./shared/middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "X-CSRF-Token"] }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/v1/auth", authRoutes);
  app.use(errorHandler);
  return app;
}
