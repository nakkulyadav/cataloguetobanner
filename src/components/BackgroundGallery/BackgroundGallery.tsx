import type { BackgroundOption } from '@/types'

interface BackgroundGalleryProps {
  backgrounds: BackgroundOption[]
  selectedId: string | null
  onSelect: (bg: BackgroundOption) => void
  isOpen: boolean
  onClose: () => void
}

export default function BackgroundGallery({
  backgrounds,
  selectedId,
  onSelect,
  isOpen,
  onClose,
}: BackgroundGalleryProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Choose Background</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                onSelect(bg)
                onClose()
              }}
              className={`relative rounded-lg overflow-hidden border-2 transition-colors aspect-[722/312] ${
                selectedId === bg.id
                  ? 'border-blue-500'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <img
                src={bg.url}
                alt="Background option"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
