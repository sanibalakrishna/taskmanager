import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { eq } from "drizzle-orm";
import { createTaskSchema, updateTaskSchema,
    deleteTaskSchema,
    getTasksSchema, } from "~/shared/validators/tasks";
import { tasks } from "~/server/db/schema";
import { createId } from "@paralleldrive/cuid2";

export const taskRouter = createTRPCRouter({
  createTask: publicProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
        console.log(input)
      await ctx.db.insert(tasks).values({
        id:createId(),
        title: input.title,
        description: input.description,
        status: input.status ?? "pending",
        imageUrl: input.imageUrl,
      });
    }),

  getTasks: publicProcedure
    .input(getTasksSchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const offset = input?.page ? (input.page - 1) * limit : 0;

      const result = await ctx.db
        .select()
        .from(tasks)
        .where(input?.status ? eq(tasks.status, input.status) : undefined)
        .limit(limit)
        .offset(offset)
        .orderBy(tasks.createdAt);

      return result;
    }),

  updateTask: publicProcedure
    .input(updateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db
        .update(tasks)
        .set({ status: input.status })
        .where(eq(tasks.id, input.id));
    }),

  deleteTask: publicProcedure
    .input(deleteTaskSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
    }),
});
