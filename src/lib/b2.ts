import  B2 from 'backblaze-b2';
import { env } from '~/env';
import { randomUUID } from 'crypto';

// Initialize B2 client
const b2 = new B2({
  applicationKeyId: env.B2_APPLICATION_KEY_ID,
  applicationKey: env.B2_APPLICATION_KEY,
});

interface UploadOptions {
  fileName?: string;
  contentType?: string;
  bucketId?: string;
}

/**
 * Generate a pre-signed URL for uploading a file to B2
 * @param options Upload options including filename, content type, and bucket ID
 * @returns Object containing the pre-signed URL and file information
 */
export async function getUploadUrl(options: UploadOptions = {}) {
  // Set default values
  const fileName = options.fileName || `${randomUUID()}-${Date.now()}`;
  const contentType = options.contentType || 'application/octet-stream';
  const bucketId = options.bucketId || env.B2_BUCKET_ID;

  try {
    // Authenticate with B2
    await b2.authorize();

    // Get upload URL
    const response = await b2.getUploadUrl({
      bucketId,
    });

    return {
      uploadUrl: response.data.uploadUrl,
      authorizationToken: response.data.authorizationToken,
      fileName,
      bucketId,
      contentType,
    };
  } catch (error) {
    console.error('Error getting B2 upload URL:', error);
    throw new Error('Failed to get upload URL');
  }
}

/**
 * Upload a file to B2 directly
 * @param fileBuffer The file data as a Buffer
 * @param options Upload options including filename, content type, and bucket ID
 * @returns The URL of the uploaded file
 */
export async function uploadToB2(fileBuffer: Buffer, options: UploadOptions = {}) {
  try {
    // Get upload URL
    const uploadData = await getUploadUrl(options);

    // Upload file to B2
    const response = await b2.uploadFile({
      uploadUrl: uploadData.uploadUrl,
      uploadAuthToken: uploadData.authorizationToken,
      fileName: uploadData.fileName,
      data: fileBuffer,
      contentType: uploadData.contentType,
    });

    // Construct public URL for the file
    const publicUrl = `${env.B2_PUBLIC_URL}/file/${env.B2_BUCKET_NAME}/${response.data.fileName}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to B2:', error);
    throw new Error('Failed to upload file to B2');
  }
}

/**
 * Validate file before upload to ensure it meets requirements
 * @param file File to validate
 * @returns True if file is valid, false otherwise
 */
export function validateFile(file: File): boolean {
  // Implement validation logic (size, type, etc.)
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (file.size > maxSize) {
    throw new Error('File too large (max 5MB)');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed');
  }
  
  return true;
}