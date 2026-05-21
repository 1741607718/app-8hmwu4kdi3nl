import { useMemo, useState } from "react"

interface UseTableSearchOptions {
  searchFields?: string[]
  pageSize?: number
}

export function useTableSearch<T extends Record<string, any>>(
  data: T[],
  options: UseTableSearchOptions = {}
) {
  const { searchFields, pageSize = 10 } = options
  const [searchText, setSearchText] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const filteredData = useMemo(() => {
    if (!searchText.trim()) {
      return data
    }
    const keyword = searchText.toLowerCase()
    return data.filter((item) => {
      if (searchFields && searchFields.length > 0) {
        return searchFields.some((field) => {
          const value = item[field]
          if (value == null) return false
          return String(value).toLowerCase().includes(keyword)
        })
      }
      return Object.values(item).some((value) => {
        if (value == null) return false
        return String(value).toLowerCase().includes(keyword)
      })
    })
  }, [data, searchText, searchFields])

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))

  const isSearching = searchText.trim().length > 0

  const resetSearch = () => {
    setSearchText("")
    setCurrentPage(1)
  }

  return {
    searchText,
    setSearchText,
    filteredData,
    pagedData,
    filteredCount: filteredData.length,
    totalCount: data.length,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    isSearching,
    resetSearch,
  }
}