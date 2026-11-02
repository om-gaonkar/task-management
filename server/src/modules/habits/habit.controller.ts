import type {Request,Response,NextFunction} from "express";
import {z} from "zod";
import * as service from "./habit.service.js";
const owner=(req:Request)=>req.auth!.userId;
export async function list(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listHabits(owner(req))});}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createHabit(owner(req),req.body)});}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.updateHabit(owner(req),req.params.habitId!,req.body)});}catch(e){next(e);}}
export async function archive(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.archiveHabit(owner(req),req.params.habitId!)});}catch(e){next(e);}}
export async function complete(req:Request,res:Response,next:NextFunction){try{const body=z.object({localDate:z.string()}).parse(req.body);res.status(201).json({data:await service.completeHabit(owner(req),req.params.habitId!,body.localDate)});}catch(e){next(e);}}
export async function history(req:Request,res:Response,next:NextFunction){try{const q=z.object({start:z.string().optional(),end:z.string().optional()}).parse(req.query);res.json({data:await service.habitHistory(owner(req),req.params.habitId!,q.start,q.end)});}catch(e){next(e);}}
export async function stats(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.habitStats(owner(req),req.params.habitId!)});}catch(e){next(e);}}
