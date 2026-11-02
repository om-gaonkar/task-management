import type {Request,Response,NextFunction} from "express";
import * as service from "./diary.service.js";
import {z} from "zod";
const owner=(req:Request)=>req.auth!.userId;
const querySchema=z.object({start:z.string().datetime().optional(),end:z.string().datetime().optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),search:z.string().trim().max(100).optional()});
export async function list(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listEntries(owner(req),querySchema.parse(req.query))});}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createEntry(owner(req),req.body)});}catch(e){next(e);}}
export async function get(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.getEntry(owner(req),req.params.entryId!)});}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.updateEntry(owner(req),req.params.entryId!,req.body)});}catch(e){next(e);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await service.deleteEntry(owner(req),req.params.entryId!);res.status(204).send();}catch(e){next(e);}}
export async function calendar(req:Request,res:Response,next:NextFunction){try{const q=z.object({start:z.string().datetime(),end:z.string().datetime()}).parse(req.query);res.json({data:await service.diaryCalendar(owner(req),q.start,q.end)});}catch(e){next(e);}}
