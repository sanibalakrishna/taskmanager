import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { s3 } from "~/server/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { tasks } from "~/server/db/schema"; // assuming task table is defined here

export const b2Router = createTRPCRouter({
  getUploadUrl: publicProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(async ({ input }) => {
      try {
        console.log("Bucket value is:", env);

        const command = new PutObjectCommand({
          Bucket: env.B2_BUCKET_NAME,
          Key: input.fileName,
          ContentType: input.contentType,
        });

        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 }); // 5 mins

        return {
          uploadUrl: signedUrl,
          fileName: input.fileName,
          bucketName: env.B2_BUCKET_NAME,
          b2DownloadUrl: `${env.B2_DOWNLOAD_URL}/file/${env.B2_BUCKET_NAME}/${input.fileName}`,
        };
      } catch (error) {
        console.error("Error getting B2 signed upload URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get signed upload URL",
        });
      }
    }),

  confirmUpload: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        taskId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const imageUrl = `${env.B2_DOWNLOAD_URL}/file/${env.B2_BUCKET_NAME}/${input.fileName}`;

        if (input.taskId) {
          await ctx.db
            .update(tasks)
            .set({ imageUrl })
            .where(eq(tasks.id, input.taskId));
        }

        return { imageUrl };
      } catch (error) {
        console.error("Error confirming upload:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to confirm upload",
        });
      }
    }),
});
