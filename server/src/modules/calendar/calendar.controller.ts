import type {Request,Response,NextFunction} from "express";
import {z} from "zod";
import * as service from "./calendar.service.js";
const owner=(req:Request)=>req.auth!.userId;
export async function list(req:Request,res:Response,next:NextFunction){try{const q=z.object({start:z.string().datetime(),end:z.string().datetime()}).parse(req.query);res.json({data:await service.getCalendarEvents(owner(req),q.start,q.end)});}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createPersonalEvent(owner(req),req.body)});}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.updatePersonalEvent(owner(req),req.params.eventId!,req.body)});}catch(e){next(e);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await service.deletePersonalEvent(owner(req),req.params.eventId!);res.status(204).send();}catch(e){next(e);}}
