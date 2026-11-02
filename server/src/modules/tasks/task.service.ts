import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { Project } from "../projects/project.model.js";
import { Tag } from "../tags/tag.model.js";
import { Task } from "./task.model.js";

type TaskInput = {
  title?: string;
  description?: unknown;
  projectId?: string | null;
  parentId?: string | null;
  status?: "todo" | "in-progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  startAt?: string | null;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  tagIds?: string[];
  manualProgress?: number;
};

function objectId(value: string) { return new Types.ObjectId(value); }
async function assertProject(userId: Types.ObjectId, projectId?: string | null) {
  if (projectId && !(await Project.exists({ _id: projectId, userId, archivedAt: null }))) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
}
async function assertTags(userId: Types.ObjectId, tagIds: string[] = []) {
  if (!tagIds.length) return;
  const count = await Tag.countDocuments({ _id: { $in: tagIds }, userId });
  if (count !== new Set(tagIds).size) throw new AppError("One or more tags do not belong to this account", 400, "INVALID_TAGS");
}
async function getValidParent(userId: Types.ObjectId, parentId?: string | null, taskId?: string) {
  if (!parentId) return null;
  if (taskId && parentId === taskId) throw new AppError("A task cannot be its own parent", 400, "TASK_CYCLE");
  const parent = await Task.findOne({ _id: parentId, userId, deletedAt: null }).select("_id parentId projectId");
  if (!parent) throw new AppError("Parent task not found", 404, "PARENT_TASK_NOT_FOUND");
  if (parent.parentId) throw new AppError("Subtasks cannot be nested more than one level", 400, "TASK_DEPTH_EXCEEDED");
  return parent;
}
function toUpdate(input: TaskInput) {
  const update: Record<string, unknown> = { ...input };
  if (input.projectId !== undefined) update.projectId = input.projectId ? objectId(input.projectId) : null;
  if (input.parentId !== undefined) update.parentId = input.parentId ? objectId(input.parentId) : null;
  if (input.startAt !== undefined) update.startAt = input.startAt ? new Date(input.startAt) : null;
  if (input.dueAt !== undefined) update.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  delete update.tagIds;
  return update;
}

export async function listTasks(userId: Types.ObjectId, query: { page: number; limit: number; status?: string; projectId?: string; parentId?: string; priority?: string; search?: string }) {
  const filter: Record<string, unknown> = { userId, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.projectId) filter.projectId = objectId(query.projectId);
  if (query.parentId) filter.parentId = objectId(query.parentId);
  if (query.priority) filter.priority = query.priority;
  if (query.search) filter.title = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [items, total] = await Promise.all([
    Task.find(filter).sort({ dueAt: 1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Task.countDocuments(filter)
  ]);
  return { items, page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) };
}

export async function getTask(userId: Types.ObjectId, taskId: string) {
  const task = await Task.findOne({ _id: taskId, userId, deletedAt: null }).lean();
  if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  const subtasks = await Task.find({ userId, parentId: task._id, deletedAt: null }).sort({ createdAt: 1 }).lean();
  const progress = subtasks.length ? Math.round(subtasks.filter(item => item.status === "completed").length / subtasks.length * 100) : task.manualProgress;
  return { ...task, subtasks, progress, subtaskCount: subtasks.length, completedSubtasks: subtasks.filter(item => item.status === "completed").length };
}

export async function createTask(userId: Types.ObjectId, input: TaskInput) {
  const parent = await getValidParent(userId, input.parentId);
  if (parent) {
    const inheritedProjectId = parent.projectId?.toString() ?? null;
    if (input.projectId !== undefined && input.projectId !== inheritedProjectId) {
      throw new AppError("A subtask must remain in its parent's project", 400, "SUBTASK_PROJECT_MISMATCH");
    }
    input = { ...input, projectId: inheritedProjectId };
  }
  await assertProject(userId, input.projectId);
  await assertTags(userId, input.tagIds);
  const data = toUpdate(input);
  if (input.tagIds) data.tagIds = input.tagIds.map(objectId);
  const task = await Task.create({ ...data, userId });
  return task.toObject();
}

export async function updateTask(userId: Types.ObjectId, taskId: string, input: TaskInput) {
  const current = await Task.findOne({ _id: taskId, userId, deletedAt: null });
  if (!current) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  const parentId = input.parentId === undefined ? current.parentId?.toString() : input.parentId;
  const parent = await getValidParent(userId, parentId, taskId);
  if (parent) {
    const parentProject = parent.projectId?.toString() ?? null;
    const nextProject = input.projectId === undefined ? current.projectId?.toString() ?? null : input.projectId;
    if (nextProject !== parentProject) throw new AppError("A subtask must remain in its parent's project", 400, "SUBTASK_PROJECT_MISMATCH");
  }
  const nextProject = input.projectId === undefined ? current.projectId?.toString() : input.projectId;
  await assertProject(userId, nextProject);
  await assertTags(userId, input.tagIds);
  const data = toUpdate(input);
  if (input.tagIds) data.tagIds = input.tagIds.map(objectId);
  if (input.status === "completed") data.completedAt = new Date();
  if (input.status && input.status !== "completed") data.completedAt = null;
  Object.assign(current, data);
  await current.save();
  if (input.projectId !== undefined && !current.parentId) {
    await Task.updateMany({ userId, parentId: current._id, deletedAt: null }, { $set: { projectId: current.projectId } });
  }
  return current.toObject();
}

export async function deleteTask(userId: Types.ObjectId, taskId: string) {
  const task = await Task.findOneAndUpdate({ _id: taskId, userId, deletedAt: null }, { $set: { deletedAt: new Date() }, $unset: { parentId: 1 } }, { new: true });
  if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  await Task.updateMany({ userId, parentId: task._id, deletedAt: null }, { $set: { parentId: null } });
}

export async function completeTask(userId: Types.ObjectId, taskId: string) {
  const task = await Task.findOneAndUpdate({ _id: taskId, userId, deletedAt: null }, { $set: { status: "completed", completedAt: new Date(), manualProgress: 100 } }, { new: true });
  if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  return task.toObject();
}

export async function listSubtasks(userId: Types.ObjectId, taskId: string) {
  if (!(await Task.exists({ _id: taskId, userId, deletedAt: null }))) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  return Task.find({ userId, parentId: taskId, deletedAt: null }).sort({ createdAt: 1 }).lean();
}

export async function setTaskProject(userId: Types.ObjectId, taskId: string, projectId: string | null) {
  await assertProject(userId, projectId);
  const task = await Task.findOne({ _id: taskId, userId, deletedAt: null });
  if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  if (task.parentId) throw new AppError("Change the project on the parent task instead", 400, "SUBTASK_PROJECT_INHERITED");
  task.projectId = projectId ? objectId(projectId) : null;
  await task.save();
  await Task.updateMany({ userId, parentId: task._id, deletedAt: null }, { $set: { projectId: task.projectId } });
  return task.toObject();
}
