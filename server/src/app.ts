import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import taskRoutes from "./modules/tasks/task.routes.js";
import projectRoutes from "./modules/projects/project.routes.js";
import tagRoutes from "./modules/tags/tag.routes.js";
import diaryRoutes from "./modules/diary/diary.routes.js";
import habitRoutes from "./modules/habits/habit.routes.js";
import calendarRoutes from "./modules/calendar/calendar.routes.js";
import financeRoutes from "./modules/finance/finance.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";
import { requireAuth } from "./modules/auth/auth.middleware.js";
import { notFound } from "./shared/middleware/not-found.js";
import { errorHandler } from "./shared/middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"]
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({
    logger,
    serializers: {
      req(request) {
        return { method: request.method, url: (request.url ?? "").split("?")[0], remoteAddress: request.remoteAddress };
      }
    }
  }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", requireAuth, userRoutes);
  app.use("/api/v1/tasks", requireAuth, taskRoutes);
  app.use("/api/v1/projects", requireAuth, projectRoutes);
  app.use("/api/v1/tags", requireAuth, tagRoutes);
  app.use("/api/v1/diary", requireAuth, diaryRoutes);
  app.use("/api/v1/habits", requireAuth, habitRoutes);
  app.use("/api/v1/calendar", requireAuth, calendarRoutes);
  app.use("/api/v1/finance", requireAuth, financeRoutes);
  app.use("/api/v1/analytics", requireAuth, analyticsRoutes);
  app.use("/api/v1/media", requireAuth, mediaRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
