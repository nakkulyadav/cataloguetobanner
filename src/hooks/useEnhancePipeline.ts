import { useState, useCallback, useRef } from 'react'
import { enhanceImage } from '@/services/enhanceImageService'
import { removeBackground } from '@/services/removeBackgroundService'
import type { ParsedProduct, ImageSource } from '@/types'

export type EnhanceJobStatus = 'idle' | 'running' | 'done' | 'error'

interface UseEnhancePipelineParams {
  selectedProduct: ParsedProduct | null
  productImageSources: ImageSource[]
  activeProductImageSourceId: string | null
  brandLogoOverride: string | null
  updateProductImageSourceEnhancement: (
    id: string,
    update: Pick<ImageSource, 'enhancedUrl' | 'enhancementStatus'>,
  ) => void
  resetShowOriginal: (id: string) => void
  updateProductImageSourceBg: (
    id: string,
    update: Pick<ImageSource, 'bgRemovedUrl' | 'bgRemovalStatus' | 'showBgRemoved'>,
  ) => void
  setBgRemovedLogoUrl: (url: string | null) => void
  setShowBgRemovedLogo: (show: boolean) => void
  addLog: (level: 'info' | 'warning' | 'error', message: string) => void
}

interface UseEnhancePipelineResult {
  enhanceJobStatus: EnhanceJobStatus
  enhanceJobStep: string
  runEnhancePipeline: () => Promise<void>
  /** Call when the active product changes to cancel any in-flight run and reset state. */
  resetEnhancePipeline: () => void
}

/**
 * Manages the on-demand enhance → background-removal pipeline for both the
 * active product image and the brand logo.
 *
 * Pipeline sequence:
 *   1. Enhance product image (4× upscale via HuggingFace)
 *   2. Remove product image background
 *   3. Enhance brand logo
 *   4. Remove brand logo background
 *
 * A cancellation ref ensures in-flight state updates are silently discarded
 * when the product changes mid-run.
 */
export function useEnhancePipeline({
  selectedProduct,
  productImageSources,
  activeProductImageSourceId,
  brandLogoOverride,
  updateProductImageSourceEnhancement,
  updateProductImageSourceBg,
  setBgRemovedLogoUrl,
  setShowBgRemovedLogo,
  addLog,
  resetShowOriginal,
}: UseEnhancePipelineParams): UseEnhancePipelineResult {
  const [enhanceJobStatus, setEnhanceJobStatus] = useState<EnhanceJobStatus>('idle')
  const [enhanceJobStep, setEnhanceJobStep] = useState('')

  // Set to true by resetEnhancePipeline() to discard stale setState calls from
  // an in-flight run that was superseded by a product change.
  const cancelledRef = useRef(false)

  const resetEnhancePipeline = useCallback(() => {
    cancelledRef.current = true
    setEnhanceJobStatus('idle')
    setEnhanceJobStep('')
  }, [])

  const runEnhancePipeline = useCallback(async () => {
    if (enhanceJobStatus === 'running' || !selectedProduct) return

    const activeSource = productImageSources.find(s => s.id === activeProductImageSourceId)
    if (!activeSource) return

    // Reset cancellation flag for this new run
    cancelledRef.current = false
    setEnhanceJobStatus('running')

    try {
      // --- Step 1: Enhance product image ---
      setEnhanceJobStep('Enhancing product image...')
      let imageForBgRemoval = activeSource.originalUrl

      if (activeSource.source !== 'ai') {
        try {
          updateProductImageSourceEnhancement(activeSource.id, {
            enhancedUrl: null,
            enhancementStatus: 'enhancing',
          })
          const enhancedUrl = await enhanceImage(activeSource.originalUrl)
          if (cancelledRef.current) return
          updateProductImageSourceEnhancement(activeSource.id, {
            enhancedUrl,
            enhancementStatus: 'done',
          })
          resetShowOriginal(activeSource.id)
          imageForBgRemoval = enhancedUrl
          addLog('info', 'Image enhanced (4× upscale)')
        } catch (err) {
          if (cancelledRef.current) return
          updateProductImageSourceEnhancement(activeSource.id, {
            enhancedUrl: null,
            enhancementStatus: 'error',
          })
          addLog('warning', `Image enhancement failed, using original: ${err instanceof Error ? err.message : String(err)}`)
          // Fall through — bg removal still runs on the original
        }
      } else {
        updateProductImageSourceEnhancement(activeSource.id, {
          enhancedUrl: null,
          enhancementStatus: 'done',
        })
      }

      if (cancelledRef.current) return

      // --- Step 2: Remove product image background ---
      setEnhanceJobStep('Removing background...')
      updateProductImageSourceBg(activeSource.id, {
        bgRemovedUrl: null,
        bgRemovalStatus: 'removing',
        showBgRemoved: false,
      })
      try {
        const bgRemovedUrl = await removeBackground(imageForBgRemoval)
        if (cancelledRef.current) return
        updateProductImageSourceBg(activeSource.id, {
          bgRemovedUrl,
          bgRemovalStatus: 'done',
          showBgRemoved: true,
        })
      } catch (err) {
        if (cancelledRef.current) return
        updateProductImageSourceBg(activeSource.id, {
          bgRemovedUrl: null,
          bgRemovalStatus: 'error',
          showBgRemoved: false,
        })
        addLog('error', `Failed to remove background: ${err instanceof Error ? err.message : String(err)}`)
        throw err // surface to outer catch so status → 'error'
      }

      if (cancelledRef.current) return

      // --- Steps 3 & 4: Enhance logo then remove its background ---
      const logoUrl = brandLogoOverride ?? selectedProduct.provider.brandLogo
      if (logoUrl) {
        let logoForBgRemoval = logoUrl

        setEnhanceJobStep('Enhancing logo...')
        try {
          logoForBgRemoval = await enhanceImage(logoUrl)
          if (cancelledRef.current) return
          addLog('info', 'Brand logo enhanced (4× upscale)')
        } catch {
          // Enhancement failure is non-fatal — bg removal runs on the original
        }

        if (cancelledRef.current) return

        setEnhanceJobStep('Removing logo background...')
        try {
          const resultUrl = await removeBackground(logoForBgRemoval)
          if (cancelledRef.current) return
          setBgRemovedLogoUrl(resultUrl)
          setShowBgRemovedLogo(true)
          addLog('info', 'Background removed from brand logo')
        } catch (err) {
          if (cancelledRef.current) return
          addLog('error', `Failed to remove background from brand logo: ${err instanceof Error ? err.message : String(err)}`)
          throw err
        }
      }

      if (!cancelledRef.current) {
        setEnhanceJobStatus('done')
        setEnhanceJobStep('')
      }
    } catch {
      if (!cancelledRef.current) {
        setEnhanceJobStatus('error')
        setEnhanceJobStep('')
      }
    }
  }, [
    enhanceJobStatus,
    selectedProduct,
    productImageSources,
    activeProductImageSourceId,
    brandLogoOverride,
    updateProductImageSourceEnhancement,
    resetShowOriginal,
    updateProductImageSourceBg,
    setBgRemovedLogoUrl,
    setShowBgRemovedLogo,
    addLog,
  ])

  return { enhanceJobStatus, enhanceJobStep, runEnhancePipeline, resetEnhancePipeline }
}
