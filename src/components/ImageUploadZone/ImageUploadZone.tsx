import { useRef, useCallback } from 'react'

interface ImageUploadZoneProps {
  /** Current image URL (blob or remote). null = no image set. */
  currentImage: string | null
  /** Called with a blob URL on upload/paste, or null on remove. */
  onImageChange: (blobUrl: string | null) => void
  /** Label shown above the upload zone (e.g. "Brand Logo", "Product Image"). */
  label: string
}

/**
 * Reusable image upload zone with file-picker and clipboard-paste support.
 *
 * - No image: dashed-border rectangle with Upload + Paste buttons.
 * - Image set: thumbnail preview + Remove button.
 * - Revokes old blob URLs before creating new ones to prevent memory leaks.
 */
export default function ImageUploadZone({
  currentImage,
  onImageChange,
  label,
}: ImageUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Revoke the previous blob URL (if any) and set the new one.
   * Only revokes URLs that start with 'blob:' to avoid revoking remote URLs.
   */
  const setImage = useCallback(
    (newUrl: string | null) => {
      if (currentImage?.startsWith('blob:')) {
        URL.revokeObjectURL(currentImage)
      }
      onImageChange(newUrl)
    },
    [currentImage, onImageChange],
  )

  /** Handle file selection from the hidden <input type="file">. */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      setImage(URL.createObjectURL(file))
      // Reset so the same file can be re-selected if needed
      e.target.value = ''
    },
    [setImage],
  )

  /** Read an image from the clipboard via the Clipboard API. */
  const handlePaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          setImage(URL.createObjectURL(blob))
          return
        }
      }
      // No image found in clipboard — silent no-op
    } catch {
      // Clipboard API denied or unavailable — silent no-op
    }
  }, [setImage])

  const handleRemove = useCallback(() => setImage(null), [setImage])

  // --- Image set state: show thumbnail + remove ---
  if (currentImage) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={currentImage}
          alt={label}
          className="h-14 max-w-[80px] object-contain rounded border border-[var(--border-muted)] bg-[var(--surface-2)]"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-interaction"
        >
          Remove
        </button>
      </div>
    )
  }

  // --- No image state: dashed upload zone ---
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-muted)] px-3 py-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-muted)] rounded px-2.5 py-1 cursor-pointer transition-interaction"
      >
        Upload
      </button>
      <button
        type="button"
        onClick={handlePaste}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-muted)] rounded px-2.5 py-1 cursor-pointer transition-interaction"
      >
        Paste
      </button>
    </div>
  )
}
