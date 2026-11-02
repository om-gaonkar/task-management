import { Router } from "express";
import * as controller from "./analytics.controller.js";
const router = Router();
router.get("/overview", controller.overview);
router.get("/productivity", controller.productivity);
router.get("/finance", controller.finance);
export default router;
