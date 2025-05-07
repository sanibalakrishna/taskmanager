import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import B2 from "backblaze-b2";
import { env } from "~/env";
import { db } from "~/server/db"; // make sure this points to your drizzle client
import { tasks } from "~/server/db/schema"; // assuming your task table schema is defined here
import { eq } from "drizzle-orm";
const b2 = new B2({
    applicationKeyId: env.B2_APPLICATION_KEY_ID,
    applicationKey: env.B2_APPLICATION_KEY,
  });

export const b2Router = createTRPCRouter({
  getUploadUrl: publicProcedure
    .input(z.object({ fileName: z.string() }))
    .mutation(async ({ input }) => {
      try {
        console.log(env)
      

        console.log("Authorizing with B2...");
await b2.authorize();
console.log("Authorization successful");


        const { data: uploadUrlData } = await b2.getUploadUrl({
          bucketId: env.B2_BUCKET_ID,
        });
        console.log(uploadUrlData)

        return {
          uploadUrl: uploadUrlData.uploadUrl,
          authorizationToken: uploadUrlData.authorizationToken,
          fileName: input.fileName,
          bucketId: env.B2_BUCKET_ID,
          bucketName: env.B2_BUCKET_NAME
        };
      } catch (error) {
        console.error("Error getting B2 upload URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get upload URL from B2",
        });
      }
    }),
    confirmUpload: publicProcedure
  .input(
    z.object({
      fileId: z.string(),
      fileName: z.string(),
      taskId: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Authorize with B2
      await b2.authorize();
      
      const maxDurationSeconds = 7 * 24 * 60 * 60; // 7 days = 604800 seconds
      const fileName = input.fileName;
      
      // Get download authorization token for the specific file
      const { data: authData } = await b2.getDownloadAuthorization({
        bucketId: env.B2_BUCKET_ID,
        fileNamePrefix: fileName,
        validDurationInSeconds: maxDurationSeconds,
      });
      
      // Create the signed URL using the correct B2 download URL format
      // Use the downloadUrl from authorization response instead of hardcoded domain
      const downloadUrl = b2.downloadUrl; // This comes from the authorize() response
      const signedUrl = `${downloadUrl}/file/${env.B2_BUCKET_NAME}/${fileName}?Authorization=${authData.authorizationToken}`;
      
      // Update the task record if taskId is provided
      if (input.taskId) {
        await db
          .update(tasks)
          .set({ imageUrl: signedUrl })
          .where(eq(tasks.id, input.taskId));
      }
      
      return { imageUrl: signedUrl };
    } catch (error) {
      console.error("Error confirming upload:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to confirm upload",
      });
    }
  }),

 
    
   
    
});
