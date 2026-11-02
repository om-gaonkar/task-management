import { Schema, model } from "mongoose";

const taskSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ["todo", "in-progress", "completed", "cancelled"], default: "todo", index: true },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
  startAt: { type: Date, default: null },
  dueAt: { type: Date, default: null, index: true },
  estimatedMinutes: { type: Number, min: 0, default: null },
  actualMinutes: { type: Number, min: 0, default: null },
  completedAt: { type: Date, default: null },
  manualProgress: { type: Number, min: 0, max: 100, default: 0 },
  tagIds: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
  relatedTaskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
  recurrence: { type: Schema.Types.Mixed, default: null },
  reminderAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

taskSchema.index({ userId: 1, status: 1, dueAt: 1 });
taskSchema.index({ userId: 1, projectId: 1, status: 1 });
taskSchema.index({ userId: 1, parentId: 1 });
taskSchema.index({ userId: 1, updatedAt: -1 });
export const Task = model("Task", taskSchema);
