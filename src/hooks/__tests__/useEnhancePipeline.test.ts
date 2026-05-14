import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useEnhancePipeline } from '@/hooks/useEnhancePipeline'
import type { ParsedProduct, ImageSource } from '@/types'

vi.mock('@/services/enhanceImageService', () => ({ enhanceImage: vi.fn() }))
vi.mock('@/services/removeBackgroundService', () => ({ removeBackground: vi.fn() }))

import * as enhanceModule from '@/services/enhanceImageService'
import * as bgModule from '@/services/removeBackgroundService'

const mockEnhanceImage = vi.mocked(enhanceModule.enhanceImage)
const mockRemoveBackground = vi.mocked(bgModule.removeBackground)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    id: 'p1',
    name: 'Test Product',
    shortDesc: '',
    imageUrl: 'https://example.com/img.jpg',
    hasValidImage: true,
    isVeg: false,
    isRelated: false,
    parentId: null,
    quantitySticker: null,
    provider: {
      brandName: 'Brand',
      brandLogo: 'https://example.com/logo.png',
      companyName: 'Co',
    },
    ...overrides,
  }
}

function makeSource(overrides: Partial<ImageSource> = {}): ImageSource {
  return {
    id: 'src-1',
    label: 'Upload 1',
    originalUrl: 'https://example.com/img.jpg',
    enhancedUrl: null,
    enhancementStatus: 'idle',
    bgRemovedUrl: null,
    bgRemovalStatus: 'idle',
    showBgRemoved: false,
    showOriginal: false,
    source: 'user',
    ...overrides,
  }
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    selectedProduct: makeProduct(),
    productImageSources: [makeSource()],
    activeProductImageSourceId: 'src-1',
    brandLogoOverride: null,
    updateProductImageSourceEnhancement: vi.fn(),
    resetShowOriginal: vi.fn(),
    updateProductImageSourceBg: vi.fn(),
    setBgRemovedLogoUrl: vi.fn(),
    setShowBgRemovedLogo: vi.fn(),
    addLog: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// OE-11 — status reset on product change
// ---------------------------------------------------------------------------

describe('useEnhancePipeline — reset (OE-11)', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useEnhancePipeline(makeParams()))
    expect(result.current.enhanceJobStatus).toBe('idle')
    expect(result.current.enhanceJobStep).toBe('')
  })

  it('resetEnhancePipeline returns status to idle and clears step', async () => {
    // Hang the pipeline so we can observe the running → reset transition
    let resolveEnhance!: (v: string) => void
    mockEnhanceImage.mockReturnValueOnce(new Promise(res => { resolveEnhance = res }))

    const { result } = renderHook(() => useEnhancePipeline(makeParams()))

    act(() => { void result.current.runEnhancePipeline() })
    expect(result.current.enhanceJobStatus).toBe('running')

    act(() => { result.current.resetEnhancePipeline() })
    expect(result.current.enhanceJobStatus).toBe('idle')
    expect(result.current.enhanceJobStep).toBe('')

    // Resolve the hanging promise — status must not flip back to done/error
    await act(async () => { resolveEnhance('https://enhanced.jpg') })
    expect(result.current.enhanceJobStatus).toBe('idle')
  })

  it('cancels an in-flight run: stale state updates are ignored after reset', async () => {
    let resolveBg!: (v: string) => void
    mockEnhanceImage.mockResolvedValueOnce('https://enhanced.jpg')
    mockRemoveBackground.mockReturnValueOnce(new Promise(res => { resolveBg = res }))

    const { result } = renderHook(() => useEnhancePipeline(makeParams()))

    act(() => { void result.current.runEnhancePipeline() })

    // Wait until bg removal step starts
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.enhanceJobStep).toBe('Removing background...')

    act(() => { result.current.resetEnhancePipeline() })

    // Resolve bg removal after reset — status must remain idle
    await act(async () => { resolveBg('blob:done') })
    expect(result.current.enhanceJobStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// OE-12 — runEnhancePipeline behaviour
// ---------------------------------------------------------------------------

describe('useEnhancePipeline — runEnhancePipeline (OE-12)', () => {
  it('happy path: all four steps complete and status becomes done', async () => {
    mockEnhanceImage
      .mockResolvedValueOnce('https://enhanced.com/img.jpg')   // product image
      .mockResolvedValueOnce('https://enhanced.com/logo.jpg')  // logo
    mockRemoveBackground
      .mockResolvedValueOnce('blob:img-bg-removed')             // product image
      .mockResolvedValueOnce('blob:logo-bg-removed')            // logo

    const params = makeParams()
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('done')
    expect(result.current.enhanceJobStep).toBe('')
    expect(params.updateProductImageSourceEnhancement).toHaveBeenCalledWith('src-1', expect.objectContaining({ enhancedUrl: 'https://enhanced.com/img.jpg', enhancementStatus: 'done' }))
    expect(params.updateProductImageSourceBg).toHaveBeenCalledWith('src-1', expect.objectContaining({ bgRemovedUrl: 'blob:img-bg-removed', showBgRemoved: true }))
    expect(params.setBgRemovedLogoUrl).toHaveBeenCalledWith('blob:logo-bg-removed')
    expect(params.setShowBgRemovedLogo).toHaveBeenCalledWith(true)
  })

  it('product image enhancement failure is non-fatal: pipeline continues and can still reach done', async () => {
    mockEnhanceImage
      .mockRejectedValueOnce(new Error('HF timeout'))           // product image fails
      .mockResolvedValueOnce('https://enhanced.com/logo.jpg')   // logo succeeds
    mockRemoveBackground
      .mockResolvedValueOnce('blob:img-bg-removed')
      .mockResolvedValueOnce('blob:logo-bg-removed')

    const params = makeParams()
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('done')
    expect(params.addLog).toHaveBeenCalledWith('warning', expect.stringContaining('enhancement failed'))
  })

  it('product image bg removal failure sets status to error', async () => {
    mockEnhanceImage.mockResolvedValueOnce('https://enhanced.jpg')
    mockRemoveBackground.mockRejectedValueOnce(new Error('bg removal failed'))

    const params = makeParams()
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('error')
    expect(params.addLog).toHaveBeenCalledWith('error', expect.stringContaining('bg removal failed'))
  })

  it('logo bg removal failure sets status to error', async () => {
    mockEnhanceImage
      .mockResolvedValueOnce('https://enhanced.jpg')
      .mockResolvedValueOnce('https://enhanced-logo.jpg')
    mockRemoveBackground
      .mockResolvedValueOnce('blob:img-ok')
      .mockRejectedValueOnce(new Error('logo bg removal failed'))

    const params = makeParams()
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('error')
    expect(params.addLog).toHaveBeenCalledWith('error', expect.stringContaining('logo'))
  })

  it('logo steps are skipped silently when no logo URL is available', async () => {
    mockEnhanceImage.mockResolvedValueOnce('https://enhanced.jpg')
    mockRemoveBackground.mockResolvedValueOnce('blob:img-ok')

    const params = makeParams({
      selectedProduct: makeProduct({ provider: { brandName: 'Brand', brandLogo: null, companyName: 'Co' } }),
      brandLogoOverride: null,
    })
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('done')
    // enhanceImage only called once (product), not twice (logo)
    expect(mockEnhanceImage).toHaveBeenCalledTimes(1)
    expect(params.setBgRemovedLogoUrl).not.toHaveBeenCalled()
  })

  it('is a no-op when called while already running (OE-12 guard)', async () => {
    let resolveEnhance!: (v: string) => void
    mockEnhanceImage.mockReturnValueOnce(new Promise(res => { resolveEnhance = res }))

    const { result } = renderHook(() => useEnhancePipeline(makeParams()))

    act(() => { void result.current.runEnhancePipeline() })
    expect(result.current.enhanceJobStatus).toBe('running')

    // Second call while running — should be ignored
    act(() => { void result.current.runEnhancePipeline() })
    expect(mockEnhanceImage).toHaveBeenCalledTimes(1)

    // Clean up the hanging promise
    await act(async () => { resolveEnhance('https://enhanced.jpg') })
  })

  it('is a no-op when no product is selected', async () => {
    const params = makeParams({ selectedProduct: null })
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('idle')
    expect(mockEnhanceImage).not.toHaveBeenCalled()
  })

  it('is a no-op when no active source is found', async () => {
    const params = makeParams({ activeProductImageSourceId: 'nonexistent' })
    const { result } = renderHook(() => useEnhancePipeline(params))

    await act(async () => { await result.current.runEnhancePipeline() })

    expect(result.current.enhanceJobStatus).toBe('idle')
    expect(mockEnhanceImage).not.toHaveBeenCalled()
  })
})
