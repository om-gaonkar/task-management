import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../../shared/middleware/validate.js";
import * as controller from "./user.controller.js";
const router = Router();
router.get("/me", controller.getMe);
router.patch("/me", validateBody(z.object({ name: z.string().trim().min(2).max(80) })), controller.updateMe);
router.patch("/me/preferences", validateBody(z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  timezone: z.string().min(1).max(80).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional()
})), controller.updatePreferences);
export default router;
