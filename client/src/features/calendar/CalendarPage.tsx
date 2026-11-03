import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { format } from "date-fns";
import { Plus, X } from "lucide-react";
import { api } from "../../lib/api-client";

type CalendarEvent={id:string;sourceType:string;title:string;start:string;end?:string|null;allDay:boolean;metadata:Record<string,unknown>};
type CalendarResponse={data:CalendarEvent[]};
type Range={start:string;end:string};
type PickedEvent={title:string;sourceType:string;start:string};
const colors:Record<string,string>={task:"#6686a3","project-deadline":"#b77d6e",diary:"#927eb1",habit:"#70987b",personal:"#bd9659"};
export function CalendarPage(){
 const[range,setRange]=useState<Range|null>(null);const[selected,setSelected]=useState<PickedEvent|null>(null);const[showCreate,setShowCreate]=useState(false);const[draft,setDraft]=useState({title:"",description:"",startAt:format(new Date(),"yyyy-MM-dd'T'HH:mm"),endAt:""});const[searchParams,setSearchParams]=useSearchParams();
 useEffect(()=>{if(searchParams.get("create")!=="1")return;setDraft({title:"",description:"",startAt:format(new Date(),"yyyy-MM-dd'T'HH:mm"),endAt:""});setShowCreate(true);const nextParams=new URLSearchParams(searchParams);nextParams.delete("create");setSearchParams(nextParams,{replace:true});},[searchParams,setSearchParams]);
 const client=useQueryClient();
 const eventsQuery=useQuery({queryKey:["calendar","events",range],queryFn:()=>api<CalendarResponse>(`/calendar/events?start=${encodeURIComponent(range!.start)}&end=${encodeURIComponent(range!.end)}`),enabled:Boolean(range)});
 const create=useMutation({mutationFn:()=>api("/calendar/events",{method:"POST",body:JSON.stringify({title:draft.title.trim(),description:draft.description,startAt:new Date(draft.startAt).toISOString(),endAt:draft.endAt?new Date(draft.endAt).toISOString():null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata"})}),onSuccess:()=>{setShowCreate(false);setDraft({title:"",description:"",startAt:"",endAt:""});void client.invalidateQueries({queryKey:["calendar","events"]});}});
 const events=useMemo(()=> (eventsQuery.data?.data??[]).map(item=>({id:item.id,title:item.title,start:item.start,end:item.end??undefined,allDay:item.allDay,backgroundColor:colors[item.sourceType]??"#6686a3",borderColor:colors[item.sourceType]??"#6686a3",extendedProps:{sourceType:item.sourceType,metadata:item.metadata}})),[eventsQuery.data]);
 function onDatesSet(info:DatesSetArg){setRange(old=>old?.start===info.start.toISOString()&&old.end===info.end.toISOString()?old:{start:info.start.toISOString(),end:info.end.toISOString()});}
 function onSelect(info:DateSelectArg){const start=info.start;const end=info.end;setDraft({title:"",description:"",startAt:format(start,"yyyy-MM-dd'T'HH:mm"),endAt:end?format(new Date(end.getTime()-60_000),"yyyy-MM-dd'T'HH:mm"):""});setShowCreate(true);}
 function onEventClick(info:EventClickArg){setSelected({title:info.event.title,sourceType:String(info.event.extendedProps.sourceType??"event"),start:info.event.startStr});}
 return <div className="feature-page calendar-page"><div className="feature-heading"><div><span className="eyebrow">YOUR TIME, IN ONE VIEW</span><h1>Calendar<span className="heading-period">.</span></h1><p className="page-subtitle">Tasks, deadlines, habits, diary entries, and personal events.</p></div><button className="button button-primary" onClick={()=>{setDraft({title:"",description:"",startAt:format(new Date(),"yyyy-MM-dd'T'HH:mm"),endAt:""});setShowCreate(true);}}><Plus size={16}/> Add event</button></div>
 <div className="calendar-legend">{Object.entries(colors).map(([type,color])=><span key={type}><i style={{background:color}}/>{type.replace("-"," ")}</span>)}</div>
 {eventsQuery.isError&&<div className="form-error">{eventsQuery.error.message} <button className="button button-secondary button-small" onClick={()=>void eventsQuery.refetch()}>Retry</button></div>}
 <section className="surface-card calendar-card"><FullCalendar plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]} initialView="dayGridMonth" headerToolbar={{left:"prev,next today",center:"title",right:"dayGridMonth,timeGridWeek,timeGridDay"}} height="auto" events={events} datesSet={onDatesSet} selectable selectMirror select={onSelect} eventClick={onEventClick} dayMaxEvents={3} nowIndicator weekends eventDisplay="block" fixedWeekCount={false}/>{eventsQuery.isFetching&&<div className="calendar-loading">Updating calendar…</div>}</section>
 {selected&&<div className="calendar-event-detail"><div><span className="eyebrow">{selected.sourceType.replace("-"," ")}</span><strong>{selected.title}</strong><small>{selected.start}</small></div><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Close event details"><X size={16}/></button></div>}
 {showCreate&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowCreate(false);}}><form className="quick-modal event-form" onSubmit={event=>{event.preventDefault();if(draft.title.trim()&&draft.startAt)create.mutate();}}><div className="modal-heading"><div><span className="eyebrow">PERSONAL CALENDAR</span><h2>Create an event</h2></div><button type="button" className="icon-button" onClick={()=>setShowCreate(false)} aria-label="Close"><X size={17}/></button></div><label>Event title</label><input required value={draft.title} onChange={event=>setDraft(old=>({...old,title:event.target.value}))} placeholder="What is happening?"/><label>Starts</label><input required type="datetime-local" value={draft.startAt} onChange={event=>setDraft(old=>({...old,startAt:event.target.value}))}/><label>Ends (optional)</label><input type="datetime-local" value={draft.endAt} onChange={event=>setDraft(old=>({...old,endAt:event.target.value}))}/><label>Description</label><textarea value={draft.description} onChange={event=>setDraft(old=>({...old,description:event.target.value}))} placeholder="Add a note…" rows={3}/>{create.error&&<p className="form-error">{create.error.message}</p>}<button className="button button-primary auth-submit" disabled={!draft.title.trim()||!draft.startAt||create.isPending}>{create.isPending?"Saving…":"Save event"}</button></form></div>}
 <p className="implementation-note">Events are aggregated from their source records; only personal events create a separate calendar document. Google Calendar sync is not connected.</p></div>;
}
