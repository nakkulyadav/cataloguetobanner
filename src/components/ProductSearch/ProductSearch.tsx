import { useState } from 'react'
import type { ParsedProduct, ProductGroup } from '@/types'
import { searchProducts } from '@/services/searchService'

interface ProductSearchProps {
  groups: ProductGroup[]
  onSelectProduct: (product: ParsedProduct) => void
  selectedProductId: string | null
}

export default function ProductSearch({
  groups,
  onSelectProduct,
  selectedProductId,
}: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const filteredGroups = searchProducts(query, groups)

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredGroups.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            {query ? 'No products found' : 'No products available'}
          </p>
        )}

        {filteredGroups.map((group) => (
          <div key={group.parent.id} className="mb-2">
            {/* Parent Product */}
            <ProductItem
              product={group.parent}
              isSelected={selectedProductId === group.parent.id}
              onClick={() => onSelectProduct(group.parent)}
            />

            {/* Children (indented) */}
            {group.children.length > 0 && (
              <div className="ml-4 border-l border-gray-700 pl-2">
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
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
        isSelected
          ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
          : 'hover:bg-gray-800 text-gray-300'
      } ${isChild ? 'text-xs' : ''}`}
    >
      {/* Veg/Non-veg indicator */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          product.isVeg ? 'bg-green-500' : 'bg-red-500'
        }`}
      />

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

      {/* Missing image indicator */}
      {!product.hasValidImage && (
        <span className="text-yellow-500 text-xs flex-shrink-0" title="No image">
          !
        </span>
      )}
    </button>
  )
}
