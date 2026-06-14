'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Navigation state: which category/folder is currently selected in the sidebar.
 * Kept in its own context so category changes don't re-render editor/AI panel.
 */

interface CategoryContextValue {
  selectedCategory: string | null
  setSelectedCategory: (category: string | null) => void
}

const CategoryContext = createContext<CategoryContextValue | null>(null)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const value: CategoryContextValue = { selectedCategory, setSelectedCategory }

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>
}

export function useCategory(): CategoryContextValue {
  const ctx = useContext(CategoryContext)
  if (!ctx) throw new Error('useCategory must be used within a CategoryProvider')
  return ctx
}
