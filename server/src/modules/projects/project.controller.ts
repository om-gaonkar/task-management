import type { Request, Response, NextFunction } from "express";
import * as service from "./project.service.js";
const owner = (req: Request) => req.auth!.userId;
export async function list(req: Request,res: Response,next: NextFunction){try{const page=Math.max(1,Number(req.query.page)||1);const limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));res.json({data:await service.listProjects(owner(req),page,limit)});}catch(error){next(error);}}
export async function create(req: Request,res: Response,next: NextFunction){try{res.status(201).json({data:await service.createProject(owner(req),req.body)});}catch(error){next(error);}}
export async function get(req: Request,res: Response,next: NextFunction){try{res.json({data:await service.getProject(owner(req),String(req.params.projectId))});}catch(error){next(error);}}
export async function update(req: Request,res: Response,next: NextFunction){try{res.json({data:await service.updateProject(owner(req),String(req.params.projectId),req.body)});}catch(error){next(error);}}
export async function archive(req: Request,res: Response,next: NextFunction){try{res.json({data:await service.archiveProject(owner(req),String(req.params.projectId))});}catch(error){next(error);}}
export async function tasks(req: Request,res: Response,next: NextFunction){try{res.json({data:await service.getProjectTasks(owner(req),String(req.params.projectId))});}catch(error){next(error);}}
