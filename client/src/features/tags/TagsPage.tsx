import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash2 } from "lucide-react";
import { api } from "../../lib/api-client";

type TagItem={_id:string;name:string;color:string;description:string|null};
type TagsResponse={data:TagItem[]};
const colors=["#6f9580","#6686a3","#b77d6e","#947eb5","#c19857","#668f9b"];

export function TagsPage(){
 const[name,setName]=useState("");
 const[description,setDescription]=useState("");
 const[color,setColor]=useState(colors[0]!);
 const client=useQueryClient();
 const query=useQuery({queryKey:["tags"],queryFn:()=>api<TagsResponse>("/tags")});
 const create=useMutation({
  mutationFn:()=>api("/tags",{method:"POST",body:JSON.stringify({name:name.trim(),description:description.trim()||undefined,color})}),
  onSuccess:()=>{setName("");setDescription("");void client.invalidateQueries({queryKey:["tags"]});}
 });
 const remove=useMutation({
  mutationFn:(id:string)=>api(`/tags/${id}`,{method:"DELETE"}),
  onSuccess:()=>void client.invalidateQueries({queryKey:["tags"]})
 });
 const tags=query.data?.data??[];
 return <div className="feature-page">
  <div className="feature-heading"><div><span className="eyebrow">ORGANIZATION</span><h1>Tags<span className="heading-period">.</span></h1><p className="page-subtitle">One flexible set of labels across your workspace.</p></div></div>
  <form className="surface-card tag-create-form" onSubmit={event=>{event.preventDefault();if(name.trim())create.mutate();}}>
   <div><label htmlFor="tag-name">Create a tag</label><input id="tag-name" value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Personal, Work, Learning…"/></div>
   <div><label htmlFor="tag-description">Description</label><input id="tag-description" value={description} onChange={event=>setDescription(event.target.value)} placeholder="Optional"/></div>
   <div className="tag-color-picker">{colors.map(value=><button type="button" key={value} aria-label={`Select color ${value}`} className={color===value?"selected":""} style={{background:value}} onClick={()=>setColor(value)}/>)}</div>
   <button className="button button-primary button-small" disabled={!name.trim()||create.isPending}><Plus size={14}/> Add tag</button>
  </form>
  {query.isLoading?<div className="surface-card empty-state">Loading tags…</div>:query.isError?<div className="surface-card empty-state"><strong>Couldn't load tags.</strong><span>{query.error.message}</span><button className="button button-secondary button-small" onClick={()=>void query.refetch()}>Retry</button></div>:tags.length===0?<div className="surface-card empty-state"><Tag size={23}/><strong>No tags created yet.</strong><span>Tags can be reused across tasks, projects, and diary entries.</span></div>:<div className="tags-grid">{tags.map(item=><article className="surface-card tag-card" key={item._id}><span className="tag-color-dot" style={{background:item.color}}/><div><strong>{item.name}</strong><span>{item.description||"Workspace tag"}</span></div><button className="icon-button" title="Delete tag" aria-label={`Delete ${item.name}`} onClick={()=>remove.mutate(item._id)} disabled={remove.isPending}><Trash2 size={15}/></button></article>)}</div>}
  {(create.error||remove.error)&&<p className="form-error">{create.error?.message??remove.error?.message}</p>}
  <p className="implementation-note">Deleting a tag detaches it from tasks, projects, and diary entries. The associated records are not deleted.</p>
 </div>;
}
