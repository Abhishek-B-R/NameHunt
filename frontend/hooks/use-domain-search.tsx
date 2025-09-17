"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { validateDomain } from "@/lib/domain-validation"

export interface DomainResult {
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

type InitEvent = {
  ok: boolean
  domain: string
  providers: string[]
  timeoutMs: number
  ts?: number
}

type ResultEvent = {
  provider: string
  result: {
    ok: boolean
    domain: string
    available?: boolean
    registrationPrice?: number
    renewalPrice?: number
    currency?: string
    rawText?: unknown
    error?: unknown
  }
  ts?: number
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
  const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initProvidersRef = useRef<string[] | null>(null)

  const requestedProviders = useMemo(
    () => [
      "godaddy",
      "namecheap",
      "squarespace",
      "hostinger",
      "networksolutions",
      "namecom",
      "porkbun",
      "ionos",
      "hover",
      "dynadot",
      "namesilo",
      "spaceship",
    ],
    []
  )

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (hardTimeoutRef.current) {
      clearTimeout(hardTimeoutRef.current)
      hardTimeoutRef.current = null
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
    initProvidersRef.current = null
  }, [])

  const safeString = (val: unknown): string | undefined => {
    if (val == null) return undefined
    if (typeof val === "string") return val
    try {
      return JSON.stringify(val)
    } catch {
      return undefined
    }
  }

  const bumpIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
    idleTimeoutRef.current = setTimeout(() => {
      console.warn("SSE idle timeout, closing stream")
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isComplete: true,
        error:
          prev.results.length === 0 ? "No response from server" : prev.error,
      }))
      cleanup()
    }, 180_000)
  }, [cleanup])

  const startSearch = useCallback(
    (domain: string) => {
      const q = domain?.trim() ?? ""
      if (!q) return

      const validation = validateDomain(q)
      if (!validation.success) {
        setState({
          results: [],
          isLoading: false,
          isComplete: true,
          error: validation.error || "Invalid domain format",
          progress: 0,
        })
        return
      }

      cleanup()
      setState({
        results: [],
        isLoading: true,
        isComplete: false,
        error: null,
        progress: 0,
      })

      const validatedDomain = validation.data!
      const providers = requestedProviders.join(",")
      const url = `https://api.namehunt.tech/search/stream?domain=${encodeURIComponent(
        validatedDomain
      )}&timeoutMs=180000&providers=${providers}`

      try {
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.onopen = () => {
          console.log("SSE connection opened")
          setState((p) => ({ ...p, error: null }))
          bumpIdleTimer()
        }

        // Your server uses named events; keep default messages only for diagnostics
        es.onmessage = (event) => {
          console.log("default message event:", event.data)
          bumpIdleTimer()
        }

        es.addEventListener("init", (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data) as InitEvent
            initProvidersRef.current = Array.isArray(data.providers)
              ? data.providers
              : null
            console.log("init:", data)
            bumpIdleTimer()
          } catch (e) {
            console.error("Error parsing init:", e)
          }
        })

        es.addEventListener("result", (event) => {
          try {
            const data = JSON.parse(
              (event as MessageEvent).data
            ) as ResultEvent

            const provider = data.provider
            const merged: DomainResult = {
              provider,
              timestamp: data.ts ?? Date.now(),
              ok: !!data.result.ok,
              domain: String(data.result.domain),
              available:
                typeof data.result.available === "boolean"
                  ? data.result.available
                  : undefined,
              registrationPrice:
                typeof data.result.registrationPrice === "number"
                  ? data.result.registrationPrice
                  : undefined,
              renewalPrice:
                typeof data.result.renewalPrice === "number"
                  ? data.result.renewalPrice
                  : undefined,
              currency:
                typeof data.result.currency === "string"
                  ? data.result.currency
                  : undefined,
              rawText: safeString(data.result.rawText),
              error: safeString(data.result.error),
            }

            setState((prev) => {
              const idx = prev.results.findIndex((r) => r.provider === provider)
              const newResults =
                idx >= 0
                  ? prev.results.map((r, i) => (i === idx ? merged : r))
                  : [...prev.results, merged]

              const total =
                initProvidersRef.current?.length ?? requestedProviders.length
              const progress = Math.round(
                Math.min(100, (newResults.length / Math.max(1, total)) * 100)
              )

              return {
                ...prev,
                results: newResults,
                progress,
                error: null,
              }
            })
            bumpIdleTimer()
          } catch (e) {
            console.error("Error parsing result event:", e)
            setState((prev) => ({
              ...prev,
              error: "Failed to parse server response",
            }))
          }
        })

        es.addEventListener("done", () => {
          console.log("done")
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            progress: 100,
          }))
          cleanup()
        })

        // Optional server-sent error payload
        es.addEventListener("error", (ev: Event) => {
          const me = ev as MessageEvent
          if (me.data) {
            console.error("server error:", me.data)
            setState((prev) => ({
              ...prev,
              error:
                typeof me.data === "string"
                  ? me.data
                  : "Server error occurred",
            }))
          }
        })

        es.onerror = (event) => {
          console.error("SSE connection error:", event)
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            error: "Connection to server lost",
          }))
          cleanup()
        }

        // Hard failsafe if done never arrives
        hardTimeoutRef.current = setTimeout(() => {
          console.log("hard timeout reached")
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isComplete: true,
            error:
              prev.results.length === 0
                ? "Search timed out with no results, maybe there is a huge traffic querying our single backend, please check after some time, or click on Compare Manually button and do manual comparison"
                : prev.error,
          }))
          cleanup()
        }, 500_000)
      } catch (error) {
        console.error("Failed to create SSE connection:", error)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to connect to search service",
        }))
      }
    },
    [cleanup, bumpIdleTimer, requestedProviders]
  )

  const cancelSearch = useCallback(() => {
    console.log("Search cancelled")
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

  useEffect(() => cleanup, [cleanup])

  return {
    ...state,
    startSearch,
    cancelSearch,
    connectionStatus: getConnectionStatus(),
    expectedProviders: initProvidersRef.current ?? requestedProviders,
  }
}