/**
 * Service for removing image backgrounds via the remove.bg API.
 *
 * Sends an image URL to remove.bg and returns a same-origin blob URL
 * containing the transparent PNG result. Blob URLs work natively with
 * html-to-image for banner export (no CORS issues).
 *
 * API docs: https://www.remove.bg/api
 */

const REMOVEBG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

/**
 * Reads the remove.bg API key from Vite environment variables.
 * Throws immediately if the key is missing or empty — fail fast
 * rather than making an unauthorized API call.
 */
function getApiKey(): string {
  const key = import.meta.env.VITE_REMOVEBG_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error(
      'VITE_REMOVEBG_API_KEY is not set. Add it to your .env file.',
    );
  }
  return key.trim();
}

/**
 * Removes the background from an image via the remove.bg API.
 *
 * @param imageUrl — Public URL of the image to process.
 * @returns A same-origin blob URL (`blob:...`) pointing to the
 *          transparent PNG. Caller is responsible for revoking
 *          the blob URL via `URL.revokeObjectURL()` when done.
 * @throws If the API key is missing, the request fails, or the
 *         response is not OK (includes status + statusText).
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  const apiKey = getApiKey();

  // Build multipart form — remove.bg accepts image_url for remote images
  const formData = new FormData();
  formData.append('image_url', imageUrl);
  formData.append('size', 'auto');

  const response = await fetch(REMOVEBG_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `remove.bg API error: ${response.status} ${response.statusText}`,
    );
  }

  // Convert the binary PNG response into a same-origin blob URL
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
