import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Download, Plus, Wallet } from "lucide-react";
import { addMonths, format, startOfMonth } from "date-fns";
import { api, API_BASE_URL } from "../../lib/api-client";
import { authQueryKey, type AuthUser } from "../auth/auth.api";

type Category={_id:string;name:string;type:"income"|"expense";color:string};
type CategoriesResponse={data:Category[]};
type Transaction={_id:string;type:"income"|"expense";amountMinor:number;currency:string;categoryName:string;occurredAt:string;note:string;paymentMethod:string};
type TransactionResponse={data:{items:Transaction[];total:number}};
type Summary={currency:string;incomeMinor:string;expenseMinor:string;netMinor:string;spendingByCategory:Array<{name:string;amountMinor:string}>};
type SummaryResponse={data:Summary[]};
type Budget={_id:string;currency:string;amountMinor:number;spentMinor:string;remainingMinor:string;usagePercent:number;categoryId:string|null};
type BudgetsResponse={data:Budget[]};

function digits(currency:string):number{return new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;}
function parseMinor(value:string,currency:string){
  const places=digits(currency);const match=value.trim().match(/^(\d+)(?:\.(\d*))?$/);if(!match)return null;
  const fraction=(match[2]??"").padEnd(places,"0");if(fraction.length>places)return null;
  const minor=BigInt(match[1]!)*10n**BigInt(places)+BigInt(fraction||"0");
  return minor>0n&&minor<=BigInt(Number.MAX_SAFE_INTEGER)?Number(minor):null;
}
function money(minor:string|number,currency:string){
  const places=digits(currency);return new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:places}).format(Number(minor)/10**places);
}
export function FinancePage(){
  const client=useQueryClient();
  const currentUser=client.getQueryData<AuthUser>(authQueryKey);
  const defaultCurrency=currentUser?.preferences?.currency??"INR";
  const [searchParams,setSearchParams]=useSearchParams();
  const [exportError,setExportError]=useState<string|null>(null);
  useEffect(()=>{if(searchParams.get("create")!=="1")return;setShowForm(true);const nextParams=new URLSearchParams(searchParams);nextParams.delete("create");setSearchParams(nextParams,{replace:true});},[searchParams,setSearchParams]);
  const [month,setMonth]=useState(startOfMonth(new Date()));
  const [showForm,setShowForm]=useState(false);
  const [type,setType]=useState<"income"|"expense">("expense");
  const [amount,setAmount]=useState("");
  const [currency,setCurrency]=useState(defaultCurrency);
  const [categoryId,setCategoryId]=useState("");
  const [occurredAt,setOccurredAt]=useState(format(new Date(),"yyyy-MM-dd"));
  const [note,setNote]=useState("");
  const [budgetAmount,setBudgetAmount]=useState("");
  const [showBudget,setShowBudget]=useState(false);
  const monthKey=format(month,"yyyy-MM");
  const start=startOfMonth(month);const end=addMonths(start,1);
  const rangeQuery=`from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
  const transactions=useQuery({queryKey:["finance","transactions",monthKey],queryFn:()=>api<TransactionResponse>(`/finance/transactions?page=1&limit=100&${rangeQuery}`)});
  const categories=useQuery({queryKey:["finance","categories"],queryFn:()=>api<CategoriesResponse>("/finance/categories")});
  const summary=useQuery({queryKey:["finance","summary",monthKey],queryFn:()=>api<SummaryResponse>(`/finance/summary?${rangeQuery}`)});
  const budgets=useQuery({queryKey:["finance","budgets",monthKey],queryFn:()=>api<BudgetsResponse>(`/finance/budgets?month=${monthKey}`)});
  const invalidate=()=>{void client.invalidateQueries({queryKey:["finance"]});void client.invalidateQueries({queryKey:["analytics","overview"]});};
  const createTransaction=useMutation({mutationFn:()=>api("/finance/transactions",{method:"POST",body:JSON.stringify({
    type,amountMinor:parseMinor(amount,currency),currency,categoryId:categoryId||null,occurredAt:new Date(`${occurredAt}T12:00:00`).toISOString(),note
  })}),onSuccess:()=>{setAmount("");setNote("");setShowForm(false);invalidate();}});
  const createBudget=useMutation({mutationFn:()=>api("/finance/budgets",{method:"POST",body:JSON.stringify({periodMonth:monthKey,currency,amountMinor:parseMinor(budgetAmount,currency),categoryId:null})}),onSuccess:()=>{setBudgetAmount("");setShowBudget(false);invalidate();}});
  const createCategory=useMutation({mutationFn:(input:{name:string;type:"income"|"expense"})=>api("/finance/categories",{method:"POST",body:JSON.stringify(input)}),onSuccess:()=>void client.invalidateQueries({queryKey:["finance","categories"]})});
  const totals=summary.data?.data??[];
  const currencySummary=totals.find(item=>item.currency===currency)??totals[0];
  const budgetList=budgets.data?.data??[];
  const transactionList=transactions.data?.data.items??[];
  const filteredCategories=useMemo(()=>categories.data?.data.filter(item=>item.type===type)??[],[categories.data,type]);
  const amountMinor=parseMinor(amount,currency);
  async function exportCsv(){
    const response=await fetch(`${API_BASE_URL}/finance/export?${rangeQuery}`,{credentials:"include"});
    if(!response.ok)throw new Error("Could not export transactions");
    const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`daymark-transactions-${monthKey}.csv`;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="feature-page finance-page">
    <div className="feature-heading"><div><span className="eyebrow">MONEY, MADE CLEAR</span><h1>Finance<span className="heading-period">.</span></h1><p className="page-subtitle">Understand where your money comes from and where it goes.</p></div><div className="finance-actions"><button className="button button-secondary" onClick={()=>{setExportError(null);void exportCsv().catch(error=>setExportError(error instanceof Error?error.message:"Could not export transactions."));}}><Download size={15}/> Export CSV</button><button className="button button-primary" onClick={()=>setShowForm(!showForm)}><Plus size={15}/> Add transaction</button></div></div>
    {exportError&&<p className="form-error">{exportError}</p>}
    <div className="month-switcher"><button className="icon-button" onClick={()=>setMonth(value=>addMonths(value,-1))}>‹</button><strong>{format(month,"MMMM yyyy")}</strong><button className="icon-button" onClick={()=>setMonth(value=>addMonths(value,1))}>›</button><span className="eyebrow">CURRENCY</span><select value={currency} onChange={event=>setCurrency(event.target.value)}><option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option></select></div>
    <div className="finance-metrics"><article className="surface-card"><span>Income</span><strong>{money(currencySummary?.incomeMinor??"0",currencySummary?.currency??currency)}</strong><ArrowDownLeft size={17}/></article><article className="surface-card"><span>Expenses</span><strong>{money(currencySummary?.expenseMinor??"0",currencySummary?.currency??currency)}</strong><ArrowUpRight size={17}/></article><article className="surface-card"><span>Net cash flow</span><strong>{money(currencySummary?.netMinor??"0",currencySummary?.currency??currency)}</strong><Wallet size={17}/></article></div>
    <div className="finance-grid"><section className="surface-card"><div className="section-heading"><div><span className="eyebrow">TRANSACTION HISTORY</span><h2>Recent activity</h2></div></div>{transactions.isLoading?<div className="empty-state">Loading transactions…</div>:transactions.isError?<div className="empty-state"><span>{transactions.error.message}</span><button className="button button-secondary button-small" onClick={()=>void transactions.refetch()}>Retry</button></div>:transactionList.length===0?<div className="empty-state"><strong>No transactions for this month.</strong><span>Record income or spending to start your report.</span></div>:<div className="transaction-list">{transactionList.map(item=><div className="transaction-row" key={item._id}><span className={`transaction-type-icon ${item.type}`}>{item.type==="income"?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</span><div className="transaction-copy"><strong>{item.note||item.categoryName}</strong><span>{item.categoryName} · {format(new Date(item.occurredAt),"dd MMM yyyy")}</span></div><strong className={item.type==="income"?"income-value":"expense-value"}>{item.type==="income"?"+":"−"}{money(item.amountMinor,item.currency)}</strong></div>)}</div>}</section>
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">SPENDING PLAN</span><h2>Monthly budgets</h2></div><button className="icon-button" onClick={()=>setShowBudget(!showBudget)} aria-label="Add budget"><Plus size={17}/></button></div>{showBudget&&<form className="budget-create-form" onSubmit={event=>{event.preventDefault();if(parseMinor(budgetAmount,currency))createBudget.mutate();}}><label>Total monthly limit ({currency})</label><input value={budgetAmount} onChange={event=>setBudgetAmount(event.target.value)} placeholder="e.g. 25000"/><button className="button button-primary button-small" disabled={!parseMinor(budgetAmount,currency)||createBudget.isPending}>Save budget</button></form>}{budgetList.length?budgetList.map(budget=><div className="budget-row" key={budget._id}><div><strong>{budget.categoryId?"Category budget":"Overall budget"}</strong><span>{money(budget.spentMinor,budget.currency)} of {money(budget.amountMinor,budget.currency)}</span></div><b>{budget.usagePercent}%</b><div className="progress-track"><span style={{width:`${Math.min(budget.usagePercent,100)}%`}}/></div><small>{money(budget.remainingMinor,budget.currency)} remaining</small></div>):<div className="empty-inline">No budget set for this month.</div>}</section>
      <section className="surface-card"><div className="section-heading"><div><span className="eyebrow">SPENDING BY CATEGORY</span><h2>Where it goes</h2></div></div>{currencySummary?.spendingByCategory.length?currencySummary.spendingByCategory.map(category=><div className="category-spend-row" key={category.name}><span>{category.name}</span><strong>{money(category.amountMinor,currency)}</strong></div>):<div className="empty-inline">Your expense categories will appear here.</div>}<form className="inline-category-form" onSubmit={event=>{event.preventDefault();const value=new FormData(event.currentTarget).get("name");if(typeof value==="string"&&value.trim())createCategory.mutate({name:value.trim(),type:"expense"});event.currentTarget.reset();}}><input name="name" placeholder="New expense category…"/><button className="icon-button" type="submit" aria-label="Add category"><Plus size={16}/></button></form>{createCategory.error&&<p className="form-error">{createCategory.error.message}</p>}</section>
    </div>
    {showForm&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowForm(false);}}><form className="quick-modal finance-form" onSubmit={event=>{event.preventDefault();if(amountMinor)createTransaction.mutate();}}><div className="modal-heading"><div><span className="eyebrow">NEW TRANSACTION</span><h2>Record money movement</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}>×</button></div><div className="finance-type-toggle"><button type="button" className={type==="expense"?"active":""} onClick={()=>{setType("expense");setCategoryId("");}}>Expense</button><button type="button" className={type==="income"?"active":""} onClick={()=>{setType("income");setCategoryId("");}}>Income</button></div><label>Amount ({currency})</label><input required inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/>{amount&&!amountMinor&&<small className="field-error">Enter a valid positive amount with no more than {digits(currency)} decimal places.</small>}<label>Category</label><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">Uncategorized</option>{filteredCategories.map(category=><option key={category._id} value={category._id}>{category.name}</option>)}</select><label>Date</label><input required type="date" value={occurredAt} onChange={event=>setOccurredAt(event.target.value)}/><label>Note</label><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Optional note"/>{createTransaction.error&&<p className="form-error">{createTransaction.error.message}</p>}<button className="button button-primary auth-submit" disabled={!amountMinor||createTransaction.isPending}>{createTransaction.isPending?"Saving…":"Save transaction"}</button></form></div>}
  </div>;
}
