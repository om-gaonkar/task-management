import type { Request, Response, NextFunction } from "express";
import * as service from "./task.service.js";
import { taskListQuerySchema } from "./task.validation.js";

const userId = (req: Request) => req.auth!.userId;
export async function list(req: Request, res: Response, next: NextFunction) { try { const query = taskListQuerySchema.parse(req.query); res.json({ data: await service.listTasks(userId(req), query) }); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ data: await service.createTask(userId(req), req.body) }); } catch (error) { next(error); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json({ data: await service.getTask(userId(req), String(req.params.taskId)) }); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json({ data: await service.updateTask(userId(req), String(req.params.taskId), req.body) }); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { await service.deleteTask(userId(req), String(req.params.taskId)); res.status(204).send(); } catch (error) { next(error); } }
export async function complete(req: Request, res: Response, next: NextFunction) { try { res.json({ data: await service.completeTask(userId(req), String(req.params.taskId)) }); } catch (error) { next(error); } }
export async function subtasks(req: Request, res: Response, next: NextFunction) { try { res.json({ data: await service.listSubtasks(userId(req), String(req.params.taskId)) }); } catch (error) { next(error); } }
export async function createSubtask(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ data: await service.createTask(userId(req), { ...req.body, parentId: req.params.taskId }) }); } catch (error) { next(error); } }
export async function project(req: Request, res: Response, next: NextFunction) { try { res.json({ data: await service.setTaskProject(userId(req), String(req.params.taskId), req.body.projectId ?? null) }); } catch (error) { next(error); } }
