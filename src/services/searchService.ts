import { ProductGroup, ParsedProduct } from '@/types'

export function searchProducts(query: string, groups: ProductGroup[]): ProductGroup[] {
  if (!query || query.trim() === '') return groups

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)

  return groups.map(group => {
    const parentMatches = words.every(w => group.parent.name.toLowerCase().includes(w))
    if (parentMatches) {
      return group
    }

    const matchingChildren = group.children.filter(child =>
      words.every(w => child.name.toLowerCase().includes(w))
    )

    if (matchingChildren.length > 0) {
      return { ...group, children: matchingChildren }
    }

    return null
  }).filter(Boolean) as ProductGroup[]
}

export function flattenGroupToProducts(groups: ProductGroup[]): ParsedProduct[] {
  const flat: ParsedProduct[] = []
  groups.forEach(g => {
    flat.push(g.parent)
    flat.push(...g.children)
  })
  return flat
}
