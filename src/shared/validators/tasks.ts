import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["pending", "in-progress", "completed"]).optional(),
  imageUrl: z.string().url().optional(),
});

export const updateTaskSchema = z.object({
  id: z.string(), // CUID regex pattern
  status: z.enum(["pending", "in-progress", "completed"]),
});

export const deleteTaskSchema = z.object({
  id: z.string(), // CUID regex pattern
});

export const getTasksSchema = z.object({
  status: z.enum(["pending", "in-progress", "completed"]).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const imageTaskSchema =z.object({
  imageBase64: z.string(),
  imageType: z.string(),
  taskId: z.string().optional(), // Optional task ID for updates
});
