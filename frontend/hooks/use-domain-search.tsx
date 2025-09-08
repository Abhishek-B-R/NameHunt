"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface DomainResult {
  provider: string
  ok: boolean
  domain: string
  available?: boolean
  registrationPrice?: number
  renewalPrice?: number
  currency?: string
  rawText?: string
  error?: string
  timestamp?: number
}

interface SearchState {
  results: DomainResult[]
  isLoading: boolean
  isComplete: boolean
  error: string | null
  progress: number
}

export function useDomainSearch() {
  const [state, setState] = useState<SearchState>({
    results: [],
    isLoading: false,
    isComplete: false,
    error: null,
    progress: 0,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expectedProviders = ["godaddy", "namecheap", "squarespace", "hostinger", "porkbun", "cloudflare", "google"]

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const startSearch = useCallback(
    (domain: string) => {
      if (!domain.trim()) return

      cleanup()

      setState({
        results: [],
        isLoading: true,
        isComplete: false,
        error: null,
        progress: 0,
      })

      const providers = expectedProviders.join(",")
      const url = `http://localhost:8080/search/stream?domain=${encodeURIComponent(domain)}&timeoutMs=45000&providers=${providers}`

      try {
        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log("[v0] SSE connection opened successfully")
          setState((prev) => ({ ...prev, error: null }))
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            const provider = Object.keys(data)[0]
            const result: DomainResult = {
              provider,
              timestamp: Date.now(),
              ...data[provider],
            }

            console.log(`[v0] Received result for ${provider}:`, result)

            setState((prev) => {
              const newResults = prev.results.find((r) => r.provider === provider)
                ? prev.results.map((r) => (r.provider === provider ? result : r))
                : [...prev.results, result]

              const progress = Math.round((newResults.length / expectedProviders.length) * 100)

              return {
                ...prev,
                results: newResults,
                progress,
                error: null,
              }
            })
          } catch (error) {
            console.error("[v0] Error parsing SSE data:", error)
            setState((prev) => ({
              ...prev,
              error: "Failed to parse server response",
            }))
          }
        }

        eventSource.onerror = (event) => {
          console.error("[v0] SSE connection error:", event)
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            error: "Connection to server lost",
          }))
          cleanup()
        }

        eventSource.addEventListener("end", () => {
          console.log("[v0] Search stream completed")
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            progress: 100,
          }))
          cleanup()
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventSource.addEventListener("error", (event: any) => {
          console.error("[v0] Server error event:", event.data)
          setState((prev) => ({
            ...prev,
            error: event.data || "Server error occurred",
          }))
        })

        timeoutRef.current = setTimeout(() => {
          console.log("[v0] Search timeout reached, completing...")
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            error: prev.results.length === 0 ? "Search timed out with no results" : null,
          }))
          cleanup()
        }, 50000) // 50 second timeout
      } catch (error) {
        console.error("[v0] Failed to create SSE connection:", error)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to connect to search service",
        }))
      }
    },
    [cleanup, expectedProviders],
  )

  const cancelSearch = useCallback(() => {
    console.log("[v0] Search cancelled by user")
    setState((prev) => ({
      ...prev,
      isLoading: false,
      isComplete: true,
    }))
    cleanup()
  }, [cleanup])

  const getConnectionStatus = useCallback(() => {
    if (!eventSourceRef.current) return "disconnected"

    switch (eventSourceRef.current.readyState) {
      case EventSource.CONNECTING:
        return "connecting"
      case EventSource.OPEN:
        return "connected"
      case EventSource.CLOSED:
        return "disconnected"
      default:
        return "unknown"
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    ...state,
    startSearch,
    cancelSearch,
    connectionStatus: getConnectionStatus(),
    expectedProviders,
  }
}
