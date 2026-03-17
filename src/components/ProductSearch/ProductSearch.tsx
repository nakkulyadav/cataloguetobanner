import { useState } from 'react'
import type { ParsedProduct, ProductGroup } from '@/types'
import { searchProducts } from '@/services/searchService'

interface ProductSearchProps {
  groups: ProductGroup[]
  onSelectProduct: (product: ParsedProduct) => void
  selectedProductId: string | null
  /** Name of the currently selected provider (shown in the header) */
  selectedProviderName?: string
  /** Callback to deselect provider and return to provider list */
  onBackToProviders?: () => void
  /** Whether products are still loading from the API */
  isLoading?: boolean
  /** Whether more products are available for pagination */
  hasMore?: boolean
  /** Callback to fetch the next page of products */
  onLoadMore?: () => void
}

export default function ProductSearch({
  groups,
  onSelectProduct,
  selectedProductId,
  selectedProviderName,
  onBackToProviders,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const filteredGroups = searchProducts(query, groups)

  return (
    <div className="flex flex-col h-full">
      {/* Back to providers header */}
      {onBackToProviders && (
        <div className="border-b border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onBackToProviders}
            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--surface-2)] transition-interaction cursor-pointer text-[var(--text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
              <path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to providers
          </button>
          {selectedProviderName && (
            <div className="px-3 pb-2">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {selectedProviderName}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Search input with magnifier icon */}
      <div className="p-3">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-base !pl-8"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* Loading state when fetching initial products */}
        {isLoading && groups.length === 0 && (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-4">
            Loading products...
          </p>
        )}

        {!isLoading && filteredGroups.length === 0 && (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-4">
            {query ? 'No products found' : 'No products available'}
          </p>
        )}

        {filteredGroups.map((group) => (
          <div key={group.parent.id} className="mb-1">
            {/* Parent Product */}
            <ProductItem
              product={group.parent}
              isSelected={selectedProductId === group.parent.id}
              onClick={() => onSelectProduct(group.parent)}
            />

            {/* Children (indented) */}
            {group.children.length > 0 && (
              <div className="ml-4 border-l border-[var(--border-subtle)] pl-1">
                {group.children.map((child) => (
                  <ProductItem
                    key={child.id}
                    product={child}
                    isSelected={selectedProductId === child.id}
                    onClick={() => onSelectProduct(child)}
                    isChild
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Load More button for pagination */}
        {hasMore && !isLoading && (
          <button
            type="button"
            onClick={onLoadMore}
            className="w-full py-2 mt-1 text-xs text-[var(--accent-base)] hover:text-[var(--accent-hover)] transition-interaction cursor-pointer"
          >
            Load more products
          </button>
        )}

        {/* Loading indicator for additional pages */}
        {isLoading && groups.length > 0 && (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-2">
            Loading more...
          </p>
        )}
      </div>
    </div>
  )
}

function ProductItem({
  product,
  isSelected,
  onClick,
  isChild = false,
}: {
  product: ParsedProduct
  isSelected: boolean
  onClick: () => void
  isChild?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-interaction cursor-pointer ${
        isSelected
          ? 'bg-[var(--accent-soft)] border-l-2 border-l-[var(--accent-base)] text-[var(--text-primary)]'
          : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
      } ${isChild ? 'text-xs' : ''}`}
    >
      {/* Product image thumbnail */}
      {product.hasValidImage && (
        <img
          src={product.imageUrl}
          alt=""
          className="w-8 h-8 object-contain flex-shrink-0 rounded"
        />
      )}

      {/* Product name */}
      <span className="truncate">{product.name}</span>

      {/* Missing image warning triangle */}
      {!product.hasValidImage && (
        <span title="No image" className="flex-shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-[var(--status-warning)]"
          >
            <path
              d="M7 1.5L13 12H1L7 1.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M7 6V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7" cy="10.25" r="0.75" fill="currentColor" />
          </svg>
        </span>
      )}
    </button>
  )
}
