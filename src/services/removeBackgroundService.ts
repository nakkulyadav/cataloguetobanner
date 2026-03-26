/**
 * Service for removing image backgrounds via the remove.bg API.
 *
 * Sends an image URL to remove.bg and returns a same-origin blob URL
 * containing the transparent PNG result. Blob URLs work natively with
 * html-to-image for banner export (no CORS issues).
 *
 * API docs: https://www.remove.bg/api
 */

const REMOVEBG_ENDPOINT = '/api/removebg';

/**
 * Returns true when the URL is a local blob or data URI that
 * remove.bg's servers cannot fetch remotely.
 */
function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

/**
 * Removes the background from an image via the remove.bg API.
 *
 * Local images (blob/data URIs from uploads or clipboard pastes) are
 * sent as `image_file` (binary upload). Remote URLs are sent as
 * `image_url` so remove.bg fetches them directly — this avoids CORS
 * errors that block browser-side `fetch()` on cross-origin image hosts.
 *
 * @param imageUrl — URL of the image to process (public URL, blob URL, or data URI).
 * @returns A same-origin blob URL (`blob:...`) pointing to the
 *          transparent PNG. Caller is responsible for revoking
 *          the blob URL via `URL.revokeObjectURL()` when done.
 * @throws If the request fails or the response is not OK (includes status + statusText).
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  const formData = new FormData();

  if (isLocalUrl(imageUrl)) {
    // Local blob/data URI — fetch the binary locally and send as file upload
    const localResponse = await fetch(imageUrl);
    const imageBlob = await localResponse.blob();
    formData.append('image_file', imageBlob, 'image.png');
  } else {
    // Remote URL — Worker forwards image_url to remove.bg directly
    formData.append('image_url', imageUrl);
  }

  const response = await fetch(REMOVEBG_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as { errors?: Array<{ title: string }> }
      detail = body.errors?.map(e => e.title).join(', ') ?? ''
    } catch { /* ignore parse errors */ }
    throw new Error(
      `remove.bg API error: ${response.status}${detail ? ` — ${detail}` : ''}`,
    )
  }

  // Convert the binary PNG response into a same-origin blob URL
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
