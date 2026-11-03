import { afterEach, describe, expect, it, vi } from "vitest"

import { apiRequest } from "@/lib/api"

import { resolveApiBaseUrl } from "@/lib/apiUrl"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("resolveApiBaseUrl", () => {
  it("uses the configured API URL and removes trailing slashes", () => {
    expect(resolveApiBaseUrl("https://api.example.invalid/api///", false)).toBe(
      "https://api.example.invalid/api",
    )
  })

  it("uses the local backend default only in development", () => {
    expect(resolveApiBaseUrl("", true)).toBe("http://localhost:5000/api")

    expect(() => resolveApiBaseUrl("", false)).toThrow("VITE_API_URL")
  })

  it("rejects invalid or unsafe API URLs", () => {
    expect(() => resolveApiBaseUrl("/api", false)).toThrow(
      "absolute HTTP or HTTPS URL",
    )

    expect(() =>
      resolveApiBaseUrl("https://user:password@api.example.invalid/api", false),
    ).toThrow("without credentials")
  })
})

describe("apiRequest", () => {
  it("rejects a stalled request when its timeout expires", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (url, options) =>
        new Promise((resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
          })
        }),
    )

    await expect(apiRequest("transactions", { timeoutMs: 5 })).rejects.toThrow(
      "Request timed out after 5 ms.",
    )
  })
})
