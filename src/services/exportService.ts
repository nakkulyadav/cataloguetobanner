import { toPng, toJpeg, toCanvas } from 'html-to-image';

export type ExportFormat = 'png' | 'jpg' | 'webp';

/**
 * Generates a sanitised download filename from a product name.
 * Falls back to "digihaat-banner" when no name is provided.
 */
export function generateFilename(productName?: string): string {
  if (!productName || !productName.trim()) return 'digihaat-banner';

  const slug = productName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // strip non-alphanumeric
    .replace(/\s+/g, '-')         // spaces → hyphens
    .replace(/-+/g, '-')          // collapse consecutive hyphens
    .replace(/^-|-$/g, '');       // trim leading/trailing hyphens

  return `digihaat-${slug}`;
}

/**
 * Captures a DOM node as an image and triggers a browser download.
 * Accepts the node directly (works with forwardRef) rather than an element ID.
 */
export const exportBanner = async (
  node: HTMLElement,
  filename: string,
  format: ExportFormat = 'png',
): Promise<void> => {
  const options = {
    quality: 0.95,
    backgroundColor: '#FFFFFF',
    pixelRatio: 2,
    skipFonts: false,
  };

  try {
    let dataUrl = '';

    if (format === 'png') {
      dataUrl = await toPng(node, options);
    } else if (format === 'jpg') {
      dataUrl = await toJpeg(node, options);
    } else if (format === 'webp') {
      const canvas = await toCanvas(node, options);
      dataUrl = canvas.toDataURL('image/webp', 0.95);
    }

    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `${filename}.${format}`;
      link.href = dataUrl;
      link.click();
    } else {
      throw new Error('Failed to generate image data URL');
    }
  } catch (error) {
    console.error('Export failed', error);
    throw error;
  }
};
