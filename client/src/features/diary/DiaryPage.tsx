import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Feather, Plus, Save } from "lucide-react";
import { api, ApiError } from "../../lib/api-client";
import { MediaGallery } from "../media/MediaGallery";

type DiaryEntry={_id:string;title:string;content:unknown;entryDate:string;timezone:string;version:number;createdAt:string;updatedAt:string};
type DiaryListResponse={data:{items:DiaryEntry[];total:number}};
type DiaryResponse={data:DiaryEntry};
export function DiaryPage(){
 const[day,setDay]=useState(()=>{const value=new URLSearchParams(window.location.search).get("date");const parsed=value?new Date(value+"T12:00:00"):new Date();return startOfDay(Number.isNaN(parsed.getTime())?new Date():parsed);});const[activeEntry,setActiveEntry]=useState<string|null>(null);const[title,setTitle]=useState("");const[content,setContent]=useState("");const[savedSnapshot,setSavedSnapshot]=useState({title:"",content:""});const[version,setVersion]=useState(1);const[saveState,setSaveState]=useState<"saved"|"dirty"|"saving"|"error"|"conflict">("saved");const[isNewEntry,setIsNewEntry]=useState(false);const savingRef=useRef(false);const skipAutoSelectRef=useRef(false);
 const[searchParams,setSearchParams]=useSearchParams();
 const queryClient=useQueryClient();const start=startOfDay(day);const end=endOfDay(day);const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata";const dateKey=format(day,"yyyy-MM-dd");const listKey=["diary","entries",dateKey] as const;
 const entriesQuery=useQuery({queryKey:listKey,queryFn:()=>api<DiaryListResponse>(`/diary/entries?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(new Date(end.getTime()+1).toISOString())}&page=1&limit=50`)});
 const entries=entriesQuery.data?.data.items??[];
 useEffect(()=>{
  const create=searchParams.get("create")==="1";
  const item=searchParams.get("item");
  if(create){skipAutoSelectRef.current=true;setIsNewEntry(true);setActiveEntry(null);setTitle("");setContent("");setSavedSnapshot({title:"",content:""});setVersion(1);setSaveState("saved");}
  else if(item){
   const entry=entries.find(candidate=>candidate._id===item);
   if(!entry)return;
   skipAutoSelectRef.current=true;
   const nextContent=typeof entry.content==="string"?entry.content:"";
   setIsNewEntry(false);setActiveEntry(entry._id);setTitle(entry.title);setContent(nextContent);setSavedSnapshot({title:entry.title,content:nextContent});setVersion(entry.version);setSaveState("saved");
  }
  if(create||(item&&entries.some(candidate=>candidate._id===item))){const next=new URLSearchParams(searchParams);next.delete("create");next.delete("item");setSearchParams(next,{replace:true});}
 },[entries,searchParams,setSearchParams]);
 useEffect(()=>{
  if(isNewEntry)return;
  if(skipAutoSelectRef.current){skipAutoSelectRef.current=false;return;}
  if(!entries.length){if(activeEntry){setActiveEntry(null);setTitle("");setContent("");setSavedSnapshot({title:"",content:""});setVersion(1);setSaveState("saved");}return;}
  if(!activeEntry||!entries.some(entry=>entry._id===activeEntry)){const first=entries[0]!;const nextContent=typeof first.content==="string"?first.content:"";setActiveEntry(first._id);setTitle(first.title);setContent(nextContent);setSavedSnapshot({title:first.title,content:nextContent});setVersion(first.version);setSaveState("saved");}
 },[entries,activeEntry,isNewEntry]);
 const dirty=title!==savedSnapshot.title||content!==savedSnapshot.content;
 useEffect(()=>{
  if(!dirty||saveState==="conflict"||saveState==="error"||savingRef.current)return;
  if(!title.trim()&&!content.trim())return;
  const snapshot={title,content};
  const timeout=window.setTimeout(async()=>{
   if(savingRef.current)return;savingRef.current=true;setSaveState("saving");
   try{
    let response:DiaryResponse;
    if(activeEntry)response=await api<DiaryResponse>(`/diary/entries/${activeEntry}`,{method:"PATCH",body:JSON.stringify({title:snapshot.title,content:snapshot.content,version})});
    else response=await api<DiaryResponse>("/diary/entries",{method:"POST",body:JSON.stringify({title:snapshot.title,content:snapshot.content,entryDate:start.toISOString(),timezone})});
    skipAutoSelectRef.current=true;setIsNewEntry(false);setActiveEntry(response.data._id);setVersion(response.data.version);setSavedSnapshot(snapshot);setSaveState("saved");await queryClient.invalidateQueries({queryKey:listKey});
   }catch(error){const conflict=error instanceof ApiError&&error.status===409;setSaveState(conflict?"conflict":"error");}
   finally{savingRef.current=false;}
  },850);
  return()=>window.clearTimeout(timeout);
 },[dirty,title,content,activeEntry,version,saveState,start,timezone,queryClient,dateKey]);
 const statusLabel=useMemo(()=>({saved:"Saved",dirty:"Unsaved changes",saving:"Saving…",error:"Save failed",conflict:"Edit conflict"}[saveState]),[saveState]);
 function confirmDiscard(){if(savingRef.current){window.alert("A save is still in progress. Wait for it to finish before switching entries.");return false;}return !dirty||window.confirm("You have unsaved changes. Discard them and continue?");}
 function selectEntry(entry:DiaryEntry){if(!confirmDiscard())return;const nextContent=typeof entry.content==="string"?entry.content:"";setIsNewEntry(false);setActiveEntry(entry._id);setTitle(entry.title);setContent(nextContent);setSavedSnapshot({title:entry.title,content:nextContent});setVersion(entry.version);setSaveState("saved");}
 function newEntry(){if(!confirmDiscard())return;skipAutoSelectRef.current=true;setIsNewEntry(true);setActiveEntry(null);setTitle("");setContent("");setSavedSnapshot({title:"",content:""});setVersion(1);setSaveState("saved");}
 function changeDay(next:Date){if(!confirmDiscard())return;setIsNewEntry(false);setDay(startOfDay(next));}
 async function reloadAfterConflict(){const fresh=await entriesQuery.refetch();const latest=fresh.data?.data.items.find(entry=>entry._id===activeEntry);if(latest)selectEntry({...latest,title:latest.title});else setSaveState("error");}
 return <div className="feature-page diary-page"><div className="feature-heading"><div><span className="eyebrow">A SPACE OF YOUR OWN</span><h1>The diary<span className="heading-period">.</span></h1><p className="page-subtitle">Private entries, saved to your account as you write.</p></div><div className="date-switcher"><button className="icon-button" aria-label="Previous day" onClick={()=>changeDay(addDays(day,-1))}><ChevronLeft size={17}/></button><span>{format(day,"EEEE, MMM d, yyyy")}</span><button className="icon-button" aria-label="Next day" onClick={()=>changeDay(addDays(day,1))}><ChevronRight size={17}/></button></div></div>
 <div className="diary-layout"><aside className="surface-card diary-aside"><div className="diary-month"><strong>{format(day,"MMMM yyyy")}</strong><CalendarDays size={17}/></div><button className="button button-secondary button-small diary-new-button" onClick={newEntry}><Plus size={14}/> New entry</button><div className="aside-divider"/><span className="eyebrow">ENTRIES THIS DAY</span>{entriesQuery.isLoading?<p className="aside-helper">Loading entries…</p>:entries.length?entries.map(entry=><button key={entry._id} className={`recent-entry-button ${activeEntry===entry._id?"selected":""}`} onClick={()=>selectEntry(entry)}><strong>{entry.title||"Untitled entry"}</strong><span>Updated {format(new Date(entry.updatedAt),"h:mm a")}</span></button>):<p className="aside-helper">No entries for this date yet.</p>}</aside>
 <section className="surface-card diary-editor"><div className="editor-topline"><span><Feather size={15}/> PRIVATE JOURNAL</span><span className={saveState==="saved"?"saved-status":saveState==="error"||saveState==="conflict"?"error-status":"draft-status"}>{statusLabel}</span></div><input className="diary-title-input" value={title} onChange={event=>{setTitle(event.target.value);setSaveState("dirty");}} placeholder="Give this entry a title…"/><div className="editor-toolbar"><span className="editor-format-label">Plain text editor</span><span/><span className="editor-format-label">{content.trim()?content.trim().split(/\s+/).length:0} words</span></div><textarea value={content} onChange={event=>{setContent(event.target.value);setSaveState("dirty");}} placeholder={"Dear diary…\n\nWhat is on your mind today?"}/>{saveState==="conflict"&&<div className="editor-alert"><span>This entry was updated somewhere else. Reload the latest saved version before continuing.</span><button className="button button-secondary button-small" onClick={()=>void reloadAfterConflict()}>Reload latest</button></div>}{saveState==="error"&&<div className="editor-alert"><span>Your changes haven't been saved. They remain in this editor.</span><button className="button button-secondary button-small" onClick={()=>setSaveState("dirty")}>Retry save</button></div>}{activeEntry&&<MediaGallery parentType="diary" parentId={activeEntry}/>}<div className="editor-footer"><span>{activeEntry?"Editing a saved entry":"New entry"} · Autosaves after you pause</span><span><Save size={14}/> {statusLabel}</span></div></section></div></div>;
}
