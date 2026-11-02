import { Router } from "express";
import { validateBody } from "../../shared/middleware/validate.js";
import * as controller from "./task.controller.js";
import { createTaskSchema, updateTaskSchema } from "./task.validation.js";

const router = Router();
router.get("/", controller.list);
router.post("/", validateBody(createTaskSchema), controller.create);
router.get("/:taskId/subtasks", controller.subtasks);
router.post("/:taskId/subtasks", validateBody(createTaskSchema.omit({ parentId: true })), controller.createSubtask);
router.post("/:taskId/complete", controller.complete);
router.put("/:taskId/project", controller.project);
router.get("/:taskId", controller.get);
router.patch("/:taskId", validateBody(updateTaskSchema), controller.update);
router.delete("/:taskId", controller.remove);
export default router;
