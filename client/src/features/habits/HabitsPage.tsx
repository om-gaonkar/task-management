import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, Plus, Target } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../lib/api-client";

type Habit={_id:string;name:string;description:string;frequency:"daily"|"weekly";weekdays:number[];targetCount:number;timezone:string};
type HabitResponse={data:Habit[]};

const weekdays=[{label:"S",value:0},{label:"M",value:1},{label:"T",value:2},{label:"W",value:3},{label:"T",value:4},{label:"F",value:5},{label:"S",value:6}];

export function HabitsPage(){
 const[name,setName]=useState("");
 const[description,setDescription]=useState("");
 const[frequency,setFrequency]=useState<"daily"|"weekly">("daily");
 const[days,setDays]=useState([1,2,3,4,5]);
 const[showForm,setShowForm]=useState(false);
 const queryClient=useQueryClient();
 const today=format(new Date(),"yyyy-MM-dd");
 const habitsQuery=useQuery({queryKey:["habits"],queryFn:()=>api<HabitResponse>("/habits")});
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["habits"]});
 const create=useMutation({
  mutationFn:()=>api("/habits",{method:"POST",body:JSON.stringify({name:name.trim(),description,frequency,weekdays:frequency==="weekly"?days:[],timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata",targetCount:1})}),
  onSuccess:()=>{setName("");setDescription("");setShowForm(false);void invalidate();}
 });
 const complete=useMutation({
  mutationFn:(id:string)=>api(`/habits/${id}/completions`,{method:"POST",body:JSON.stringify({localDate:today})}),
  onSuccess:()=>void invalidate()
 });
 const archive=useMutation({
  mutationFn:(id:string)=>api(`/habits/${id}`,{method:"DELETE"}),
  onSuccess:()=>void invalidate()
 });
 const items=habitsQuery.data?.data??[];
 return <div className="feature-page">
  <div className="feature-heading">
   <div><span className="eyebrow">PERSONAL GROWTH</span><h1>Habits<span className="heading-period">.</span></h1><p className="page-subtitle">Small actions, repeated with intention.</p></div>
   <button className="button button-primary" onClick={()=>setShowForm(value=>!value)}><Plus size={16}/> Add habit</button>
  </div>
  {showForm&&<form className="surface-card habit-create-form" onSubmit={event=>{event.preventDefault();if(name.trim())create.mutate();}}>
   <label>Habit name</label><input value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Read for 20 minutes"/>
   <label>Description (optional)</label><input value={description} onChange={event=>setDescription(event.target.value)} placeholder="A little context…"/>
   <label>Schedule</label><select value={frequency} onChange={event=>setFrequency(event.target.value as "daily"|"weekly")}><option value="daily">Every day</option><option value="weekly">Selected weekdays</option></select>
   {frequency==="weekly"&&<div className="weekday-picker">{weekdays.map(day=><button type="button" key={day.value} className={days.includes(day.value)?"selected":""} onClick={()=>setDays(current=>current.includes(day.value)?current.filter(value=>value!==day.value):[...current,day.value])}>{day.label}</button>)}</div>}
   {create.error&&<p className="form-error">{create.error.message}</p>}
   <button className="button button-primary button-small" disabled={!name.trim()||create.isPending||(frequency==="weekly"&&!days.length)}>{create.isPending?"Saving…":"Save habit"}</button>
  </form>}
  {habitsQuery.isLoading?<div className="surface-card empty-state">Loading habits…</div>:habitsQuery.isError?<div className="surface-card empty-state"><strong>Couldn't load habits.</strong><span>{habitsQuery.error.message}</span><button className="button button-secondary button-small" onClick={()=>void habitsQuery.refetch()}>Retry</button></div>:items.length===0?<div className="surface-card empty-state"><div className="placeholder-icon"><Target size={21}/></div><strong>No habits yet.</strong><span>Create a habit and begin tracking your consistency.</span></div>:<div className="habit-page-grid">{items.map(habit=><article className="surface-card habit-card" key={habit._id}>
   <div className="habit-card-top"><span className="habit-large-icon"><Target size={18}/></span><button className="icon-button" title="Archive habit" aria-label={`Archive ${habit.name}`} onClick={()=>archive.mutate(habit._id)} disabled={archive.isPending}><Archive size={16}/></button></div>
   <h2>{habit.name}</h2><p>{habit.description|| (habit.frequency==="daily"?"Every day":`Weekly · ${habit.weekdays.length} days`)}</p>
   <div className="habit-card-footer"><span>{habit.timezone}</span><button className="button button-soft button-small" onClick={()=>complete.mutate(habit._id)} disabled={complete.isPending}><Check size={14}/> Mark today done</button></div>
  </article>)}</div>}
  {(complete.error||archive.error)&&<p className="form-error">{complete.error?.message??archive.error?.message}</p>}
  <p className="implementation-note">A completion is recorded against the habit's local date. Duplicate check-ins for the same date are safely ignored.</p>
 </div>;
}
