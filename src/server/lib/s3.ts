import { S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env"; // Ensure these are defined in your .env file

export const s3 = new S3Client({
  region: `${env.B2_REGION}`, // Region used by Backblaze B2 S3-compatible service
  endpoint: `https://s3.${env.B2_REGION}.backblazeb2.com`, // B2 region endpoint
  credentials: {
    accessKeyId: env.B2_APPLICATION_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
  },
  forcePathStyle: false, // Recommended for B2 S3
});
