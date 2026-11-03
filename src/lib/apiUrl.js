const DEVELOPMENT_API_URL = "http://localhost:5000/api"

export function resolveApiBaseUrl(configuredUrl, isDevelopment) {
  const value =
    typeof configuredUrl === "string" && configuredUrl.trim()
      ? configuredUrl.trim()
      : isDevelopment
        ? DEVELOPMENT_API_URL
        : ""

  if (!value) {
    throw new Error("VITE_API_URL must be set for production builds.")
  }

  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP or HTTPS URL.")
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "VITE_API_URL must be an absolute HTTP or HTTPS URL without credentials, query, or fragment.",
    )
  }

  return value.replace(/\/+$/, "")
}
