import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import { api } from "../../lib/api-client";
import { MediaGallery } from "../media/MediaGallery";

type Project = { _id: string; name: string; description: string | null; status: string; priority: string; deadline: string | null; progress: number; completedTasks: number; totalEligibleTasks: number; overdueTasks: number; upcomingTasks: number };
type ProjectResponse = { data: { items: Project[]; total: number } };

export function ProjectsPage() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectResponse>("/projects?page=1&limit=50") });
  const createMutation = useMutation({
    mutationFn: (projectName: string) => api("/projects", { method: "POST", body: JSON.stringify({ name: projectName, status: "planning", priority: "medium" }) }),
    onSuccess: () => { setName(""); setCreating(false); void queryClient.invalidateQueries({ queryKey: ["projects"] }); }
  });
  const projects = projectsQuery.data?.data.items ?? [];
  return <div className="feature-page">
    <div className="feature-heading"><div><span className="eyebrow">THINK BIGGER</span><h1>Projects<span className="heading-period">.</span></h1><p className="page-subtitle">The bigger picture behind the things you're working on.</p></div><button className="button button-primary" onClick={() => setCreating(!creating)}><Plus size={16}/> New project</button></div>
    {creating && <form className="surface-card project-create-form" onSubmit={event => { event.preventDefault(); if(name.trim()) createMutation.mutate(name.trim()); }}><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Project name…"/><button className="button button-primary button-small" disabled={!name.trim()||createMutation.isPending}>Create project</button></form>}
    {projectsQuery.isLoading ? <div className="empty-state">Loading projects…</div> : projectsQuery.isError ? <div className="empty-state"><strong>Couldn't load projects.</strong><span>{projectsQuery.error.message}</span><button className="button button-secondary button-small" onClick={() => void projectsQuery.refetch()}>Try again</button></div> : projects.length===0 ? <div className="surface-card empty-state"><strong>No projects yet.</strong><span>Create a project to group related tasks and deadlines.</span></div> : <div className="project-grid">{projects.map(project => <article className="surface-card project-card" key={project._id}><div className={`project-cover ${project.status==="completed"?"green":project.priority==="urgent"?"coral":"blue"}`}><div className="cover-decoration"/><span>{project.name[0]?.toUpperCase()}</span><span className="project-status-badge">{project.status.replace("-", " ")}</span></div><div className="project-card-body"><div className="project-card-top"><span className="eyebrow">PROJECT WORKSPACE</span><span className="project-date">{project.deadline ? new Date(project.deadline).toLocaleDateString() : "No deadline"}</span></div><h2>{project.name}</h2><p>{typeof project.description==="string"?project.description:""}</p><div className="project-progress-label"><span>{project.completedTasks} / {project.totalEligibleTasks} eligible tasks</span><strong>{project.progress}%</strong></div><div className="progress-track"><span style={{width:`${project.progress}%`}}/></div><div className="project-detail-stats"><span>{project.overdueTasks} overdue</span><span>{project.upcomingTasks} upcoming</span><ArrowUpRight size={15}/></div><MediaGallery parentType="project" parentId={project._id}/></div></article>)}</div>}
    {createMutation.error && <p className="form-error">{createMutation.error.message}</p>}
  </div>;
}
