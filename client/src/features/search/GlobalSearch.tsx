import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileText, FolderKanban, Search, Tag, Wallet, X, CheckSquare } from "lucide-react";
import { api } from "../../lib/api-client";

type SearchResults = {
  data: {
    tasks: Array<{id:string;title:string;status:string}>;
    projects: Array<{id:string;title:string;status:string}>;
    diary: Array<{id:string;title:string;entryDate:string}>;
    tags: Array<{id:string;title:string;color:string}>;
    transactions: Array<{id:string;title:string;type:string;currency:string;amountMinor:number;occurredAt:string}>;
  };
};
type Props = { onClose: () => void; onNavigate: (path:string) => void };

export function GlobalSearch({onClose,onNavigate}:Props) {
  const [value,setValue]=useState("");
  const [query,setQuery]=useState("");
  useEffect(()=>{const timer=window.setTimeout(()=>setQuery(value.trim()),250);return()=>window.clearTimeout(timer);},[value]);
  const results=useQuery({queryKey:["search",query],queryFn:()=>api<SearchResults>(`/search?q=${encodeURIComponent(query)}`),enabled:query.length>=2,staleTime:15_000});
  const groups = [
    {name:"Tasks",icon:CheckSquare,path:"/tasks",items:results.data?.data.tasks??[]},
    {name:"Projects",icon:FolderKanban,path:"/projects",items:results.data?.data.projects??[]},
    {name:"Diary",icon:FileText,path:"/diary",items:results.data?.data.diary??[]},
    {name:"Tags",icon:Tag,path:"/tags",items:results.data?.data.tags??[]},
    {name:"Transactions",icon:Wallet,path:"/finance",items:results.data?.data.transactions??[]}
  ];
  const total=groups.reduce((sum,group)=>sum+group.items.length,0);
  return <div className="modal-backdrop search-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="quick-modal search-modal" role="dialog" aria-modal="true" aria-label="Search workspace">
    <div className="global-search-head"><div className="global-search-input-wrap"><Search size={18}/><input autoFocus value={value} onChange={event=>setValue(event.target.value)} onKeyDown={event=>{if(event.key==="Escape")onClose();}} placeholder="Search tasks, projects, diary, tags…"/></div><button className="icon-button" onClick={onClose} aria-label="Close search"><X size={18}/></button></div>
    {value.trim().length<2?<div className="search-hint">Type at least 2 characters to search your workspace.</div>:results.isLoading?<div className="search-hint">Searching your records…</div>:results.isError?<div className="search-hint search-error">{results.error.message}<button className="button button-secondary button-small" onClick={()=>void results.refetch()}>Retry</button></div>:total===0?<div className="search-hint">No matching records found.</div>:<div className="search-results">{groups.filter(group=>group.items.length>0).map(group=>{const Icon=group.icon;return <div className="search-group" key={group.name}><div className="search-group-label">{group.name}</div>{group.items.map(item=><button className="search-result" key={item.id} onClick={()=>{onClose();onNavigate(`${group.path}?item=${encodeURIComponent(item.id)}`);}}><span className="search-result-icon"><Icon size={15}/></span><span className="search-result-title">{item.title}</span><span className="search-result-meta">{group.name}</span><ArrowUpRight size={14}/></button>)}</div>;})}</div>}
    <div className="search-modal-footer"><span><kbd>Esc</kbd> to close</span><span>{query.length>=2&&total? `${total} results` : "Private to your account"}</span></div>
  </section></div>;
}
