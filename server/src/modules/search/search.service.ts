import { Types } from "mongoose";
import { DiaryEntry } from "../diary/diary.model.js";
import { Transaction } from "../finance/transaction.model.js";
import { Project } from "../projects/project.model.js";
import { Tag } from "../tags/tag.model.js";
import { Task } from "../tasks/task.model.js";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function searchWorkspace(userId: Types.ObjectId, rawQuery: string) {
  const query = rawQuery.trim();
  const regex = new RegExp(escapeRegex(query), "i");
  const [tasks, projects, diary, tags, transactions] = await Promise.all([
    Task.find({ userId, deletedAt: null, title: regex }).select("_id title status dueAt").sort({ updatedAt: -1 }).limit(6).lean(),
    Project.find({ userId, archivedAt: null, name: regex }).select("_id name status deadline").sort({ updatedAt: -1 }).limit(6).lean(),
    DiaryEntry.find({ userId, title: regex }).select("_id title entryDate").sort({ updatedAt: -1 }).limit(6).lean(),
    Tag.find({ userId, name: regex }).select("_id name color").sort({ normalizedName: 1 }).limit(6).lean(),
    Transaction.find({ userId, $or: [{ note: regex }, { categoryName: regex }, { paymentMethod: regex }] })
      .select("_id type amountMinor currency categoryName occurredAt note")
      .sort({ occurredAt: -1 }).limit(6).lean()
  ]);
  return {
    tasks: tasks.map(item => ({ id: item._id.toString(), title: item.title, status: item.status, dueAt: item.dueAt })),
    projects: projects.map(item => ({ id: item._id.toString(), title: item.name, status: item.status, deadline: item.deadline })),
    diary: diary.map(item => ({ id: item._id.toString(), title: item.title || "Untitled entry", entryDate: item.entryDate })),
    tags: tags.map(item => ({ id: item._id.toString(), title: item.name, color: item.color })),
    transactions: transactions.map(item => ({
      id: item._id.toString(),
      title: item.note || item.categoryName,
      type: item.type,
      amountMinor: item.amountMinor,
      currency: item.currency,
      occurredAt: item.occurredAt
    }))
  };
}
