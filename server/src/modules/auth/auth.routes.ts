import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validateBody } from "../../shared/middleware/validate.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { loginSchema, registerSchema, verifyEmailSchema } from "./auth.validation.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/register", authLimiter, validateBody(registerSchema), controller.register);
router.post("/login", authLimiter, validateBody(loginSchema), controller.login);
router.post("/verify-email", authLimiter, validateBody(verifyEmailSchema), controller.verifyEmail);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);

export default router;
