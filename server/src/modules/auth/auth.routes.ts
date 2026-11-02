import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validateBody } from "../../shared/middleware/validate.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import {
  changePasswordSchema, emailSchema, loginSchema, preferencesSchema,
  registerSchema, resetPasswordSchema, verifyEmailSchema
} from "./auth.validation.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/register", authLimiter, validateBody(registerSchema), controller.register);
router.post("/login", authLimiter, validateBody(loginSchema), controller.login);
router.post("/verify-email", authLimiter, validateBody(verifyEmailSchema), controller.verifyEmail);
router.post("/verify-email/resend", resetLimiter, validateBody(emailSchema), controller.resendVerification);
router.post("/forgot-password", resetLimiter, validateBody(emailSchema), controller.forgotPassword);
router.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), controller.resetPassword);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/google", authLimiter, controller.googleLogin);
router.get("/google/callback", authLimiter, controller.googleCallback);
router.get("/google/link", requireAuth, controller.googleLink);
router.get("/me", requireAuth, controller.me);
router.get("/sessions", requireAuth, controller.sessions);
router.delete("/sessions/:sessionId", requireAuth, controller.revokeSession);
router.post("/logout-all", requireAuth, controller.logoutAll);
router.patch("/change-password", requireAuth, validateBody(changePasswordSchema), controller.changePassword);
router.patch("/deactivate", requireAuth, controller.deactivate);
router.patch("/preferences", requireAuth, validateBody(preferencesSchema), controller.updatePreferences);

export default router;
