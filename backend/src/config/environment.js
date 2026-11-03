const allowedNodeEnvironments = new Set(["development", "test", "production"])

const jwtSecretMinBytes = 32

function getAllowedOrigins(environment = process.env) {
  const value = environment.FRONTEND_ORIGINS || ""

  if (!value.trim()) return []

  const origins = value.split(",").map((origin) => origin.trim())

  if (origins.some((origin) => !origin)) {
    throw new Error(
      "FRONTEND_ORIGINS must be a comma-separated list of origins.",
    )
  }

  return [...new Set(origins.map(normalizeOrigin))]
}

function normalizeOrigin(origin) {
  let url

  try {
    url = new URL(origin)
  } catch {
    throw new Error("FRONTEND_ORIGINS contains an invalid origin.")
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("FRONTEND_ORIGINS must contain only HTTP or HTTPS origins.")
  }

  return url.origin
}

function isStrongJwtSecret(secret) {
  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < jwtSecretMinBytes
  ) {
    return false
  }

  if (new Set(secret).size < 16 || /^(.{1,8})\1+$/.test(secret)) {
    return false
  }

  return !/(?:replace|change[-_ ]?me|placeholder|example|your[-_ ]?secret)/i.test(
    secret,
  )
}

function validateEnvironment(environment = process.env) {
  const nodeEnv = environment.NODE_ENV || "development"

  if (!allowedNodeEnvironments.has(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production.")
  }

  const rawPort = environment.PORT || "3001"

  if (!/^\d+$/.test(rawPort)) {
    throw new Error("PORT must be an integer between 1 and 65535.")
  }

  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.")
  }

  const allowedOrigins = getAllowedOrigins(environment)
  const mongoUri = environment.MONGODB_URI?.trim()

  if (mongoUri && !/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error(
      "MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.",
    )
  }

  if (nodeEnv === "production") {
    if (!mongoUri) {
      throw new Error("MONGODB_URI is required in production.")
    }

    if (!environment.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in production.")
    }

    if (!isStrongJwtSecret(environment.JWT_SECRET)) {
      throw new Error(
        "JWT_SECRET must be at least 32 bytes and not an obvious placeholder.",
      )
    }

    if (allowedOrigins.length === 0) {
      throw new Error(
        "FRONTEND_ORIGINS must configure at least one origin in production.",
      )
    }
  }

  return { nodeEnv, port, allowedOrigins }
}

module.exports = { getAllowedOrigins, validateEnvironment }
