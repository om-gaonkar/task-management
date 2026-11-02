import type {Request,Response,NextFunction} from "express";
import {z} from "zod";
import * as service from "./finance.service.js";
const owner=(req:Request)=>req.auth!.userId;
const listQuery=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),type:z.enum(["income","expense"]).optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional(),projectId:z.string().regex(/^[a-f\d]{24}$/i).optional(),currency:z.string().regex(/^[A-Za-z]{3}$/).optional()});
export async function categories(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listCategories(owner(req))});}catch(e){next(e);}}
export async function createCategory(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createCategory(owner(req),req.body)});}catch(e){next(e);}}
export async function archiveCategory(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.archiveCategory(owner(req),req.params.categoryId!)});}catch(e){next(e);}}
export async function list(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.listTransactions(owner(req),listQuery.parse(req.query))});}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createTransaction(owner(req),req.body)});}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json({data:await service.updateTransaction(owner(req),req.params.transactionId!,req.body)});}catch(e){next(e);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await service.deleteTransaction(owner(req),req.params.transactionId!);res.status(204).send();}catch(e){next(e);}}
export async function summary(req:Request,res:Response,next:NextFunction){try{const q=z.object({from:z.string().datetime(),to:z.string().datetime(),currency:z.string().regex(/^[A-Za-z]{3}$/).optional()}).parse(req.query);res.json({data:await service.financeSummary(owner(req),q.from,q.to,q.currency)});}catch(e){next(e);}}
export async function budgets(req:Request,res:Response,next:NextFunction){try{const q=z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).parse(req.query);res.json({data:await service.listBudgets(owner(req),q.month)});}catch(e){next(e);}}
export async function upsertBudget(req:Request,res:Response,next:NextFunction){try{res.status(201).json({data:await service.createOrUpdateBudget(owner(req),req.body)});}catch(e){next(e);}}
export async function projectExpenses(req:Request,res:Response,next:NextFunction){try{const q=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional()}).parse(req.query);res.json({data:await service.projectExpenses(owner(req),req.params.projectId!,q.from,q.to)});}catch(e){next(e);}}
export async function exportCsv(req:Request,res:Response,next:NextFunction){try{const q=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional()}).parse(req.query);const csv=await service.exportTransactions(owner(req),q.from,q.to);res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition",'attachment; filename="transactions.csv"');res.send(csv);}catch(e){next(e);}}
