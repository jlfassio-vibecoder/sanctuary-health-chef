/**
 * Image Service - Handles image resizing, compression, and Firebase Storage upload
 */

import { storage } from '../src/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImage } from '../utils/imageResizer';

const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit for Storage uploads to keep things snappy
const JPEG_QUALITY = 0.85;

/**
 * Uploads a recipe image to Firebase Storage and returns the download URL
 * @param imageSource - File, Blob, or base64 data URL
 * @param userId - User ID for organizing storage
 * @param recipeId - Recipe ID to use in the storage path
 * @returns Download URL from Firebase Storage, or null if upload fails
 */
export async function uploadRecipeImage(
  imageSource: File | Blob | string,
  userId: string,
  recipeId: string
): Promise<string | null> {
  console.log('📤 [Phase 3] uploadRecipeImage called:', {
    recipeId,
    userId,
    imageSourceType: typeof imageSource,
    imageSourcePreview: typeof imageSource === 'string' ? imageSource.substring(0, 100) + '...' : `${imageSource.constructor.name}`
  });
  
  if (!recipeId) {
    console.error('❌ [Phase 3] recipeId is missing - cannot upload image');
    return null;
  }
  
  if (!userId) {
    console.error('❌ [Phase 3] userId is missing - cannot upload image');
    return null;
  }
  
  try {
    // 1. Resize and compress the image first
    // This solves the "too large" issue before it even reaches Storage
    console.log(`🖼️ [Phase 3] Resizing image for recipe ${recipeId}...`);
    const resizedBlob = await resizeImage(imageSource, MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, JPEG_QUALITY);
    console.log('✅ [Phase 3] Image resized:', {
      blobSize: resizedBlob.size,
      blobSizeKB: Math.round(resizedBlob.size / 1024),
      blobType: resizedBlob.type,
      withinLimit: resizedBlob.size <= MAX_FILE_SIZE
    });
    
    // 2. Check final size for logging
    if (resizedBlob.size > MAX_FILE_SIZE) {
      console.warn(`⚠️ [Phase 3] Resized image is still large: ${Math.round(resizedBlob.size / 1024)}KB`);
    }

    // 3. Create storage reference: recipes/{userId}/{recipeId}-{timestamp}.jpg
    // Using timestamp to avoid cache issues when updating images
    const filename = `recipe-${recipeId}-${Date.now()}.jpg`;
    const storageRef = ref(storage, `recipes/${userId}/${filename}`);
    console.log('📤 [Phase 3] Created storage reference:', {
      path: `recipes/${userId}/${filename}`,
      fullPath: storageRef.fullPath
    });
    
    // 4. Upload the blob with a timeout to prevent hanging
    console.log(`📤 [Phase 3] Starting upload to Storage: recipes/${userId}/${filename}...`);
    const uploadTask = uploadBytes(storageRef, resizedBlob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    });

    // Add timeout (10 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Image upload timeout')), 10000)
    );
    
    console.log('⏳ [Phase 3] Waiting for upload to complete (10s timeout)...');
    const snapshot = await Promise.race([uploadTask, timeoutPromise]);
    console.log('✅ [Phase 3] Upload completed:', {
      bytesTransferred: snapshot.metadata.size,
      contentType: snapshot.metadata.contentType
    });
    
    // 5. Get and return download URL
    console.log('🔗 [Phase 3] Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`✅ [Phase 3] Image uploaded successfully:`, {
      downloadURL,
      sizeKB: Math.round(resizedBlob.size / 1024),
      isStorageUrl: isStorageUrl(downloadURL)
    });
    return downloadURL;
  } catch (error: any) {
    console.error('❌ [Phase 3] Error uploading recipe image:', {
      error: error?.message || String(error),
      code: error?.code,
      recipeId,
      userId
    });
    
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('CORS') || errorMessage.includes('preflight') || errorMessage.includes('timeout')) {
      console.warn('⚠️ [Phase 3] Firebase Storage connection error (CORS/timeout).');
      console.info('💡 [Phase 3] See docs/FIREBASE_STORAGE_CORS_FIX.md for troubleshooting.');
    } else if (errorMessage.includes('permission')) {
      console.warn('⚠️ [Phase 3] Firebase Storage permission denied. Check storage rules.');
    }
    
    // Return null instead of throwing - let the recipe save without an image
    return null;
  }
}

/**
 * Legacy support for existing code that uses uploadRecipeImageToStorage
 */
export const uploadRecipeImageToStorage = uploadRecipeImage;

/**
 * Checks if an image URL is a base64 data URL
 */
export const isBase64DataUrl = (url: string | undefined | null): boolean => {
  const result = !!url && url.startsWith('data:image/');
  if (url) {
    console.log('🔍 [Phase 3] isBase64DataUrl check:', {
      urlPreview: url.substring(0, 100) + '...',
      isBase64: result
    });
  }
  return result;
};

/**
 * Checks if an image URL is a Firebase Storage URL
 */
export const isStorageUrl = (url: string | undefined | null): boolean => {
  const result = !!url && (
    url.includes('firebasestorage.googleapis.com') || 
    url.includes('firebase.storage') || 
    url.startsWith('gs://')
  );
  if (url) {
    console.log('🔍 [Phase 3] isStorageUrl check:', {
      urlPreview: url.substring(0, 100) + '...',
      isStorage: result
    });
  }
  return result;
};
