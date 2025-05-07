import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { eq } from "drizzle-orm";
import { createTaskSchema, updateTaskSchema,
    deleteTaskSchema,
    getTasksSchema,
    imageTaskSchema, } from "~/shared/validators/tasks";
import { tasks } from "~/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { uploadToB2, validateFile } from "~/lib/b2";

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

    uploadImage: publicProcedure
    .input(imageTaskSchema)
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to buffer
        const base64Data = input.imageBase64.split(";base64,").pop();
        if (!base64Data) {
          throw new Error("Invalid image data");
        }
        
        const buffer = Buffer.from(base64Data, "base64");
        
        // Create a mock File object for validation
        const mockFile = {
          size: buffer.length,
          type: input.imageType
        } as File;
        
        // Validate the file
        validateFile(mockFile);
        
        // Generate a unique filename
        const filename = input.taskId 
          ? `task-${input.taskId}-${Date.now()}.${input.imageType.split("/")[1]}`
          : `task-${Date.now()}.${input.imageType.split("/")[1]}`;
        
        // Upload to B2
        const imageUrl = await uploadToB2(buffer, {
          fileName: filename,
          contentType: input.imageType,
        });

        return { imageUrl };
      } catch (error) {
        console.error("Image upload error:", error);
        throw new Error(`Failed to upload image: ${(error as Error).message}`);
      }
    }),

});
