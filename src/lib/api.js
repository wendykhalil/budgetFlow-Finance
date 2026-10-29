const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

export async function apiRequest(endpoint, options = {}) {
  const { token, headers, body, ...fetchOptions } = options
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  let requestBody = body
  if (body !== undefined && body !== null) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    if (!isFormData && typeof body === 'object') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json')
      }
      requestBody = JSON.stringify(body)
    }
  }

  const path = endpoint.replace(/^\/+/, '')
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...fetchOptions,
    headers: requestHeaders,
    body: requestBody,
  })

  const responseText = await response.text()
  let responseData = null

  if (responseText) {
    try {
      responseData = JSON.parse(responseText)
    } catch (error) {
      responseData = null
    }
  }

  if (!response.ok) {
    const message =
      typeof responseData?.message === 'string'
        ? responseData.message
        : `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return responseData
}
