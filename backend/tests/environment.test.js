const assert = require("node:assert/strict")

const { test } = require("node:test")

const mongoose = require("mongoose")

const {
  getAllowedOrigins,
  validateEnvironment,
} = require("../src/config/environment")

const { connectDB } = require("../src/config/database")

const validProductionEnvironment = {
  NODE_ENV: "production",

  PORT: "3001",

  MONGODB_URI: "mongodb://user:password@db.example.invalid/budgetflow",

  JWT_SECRET: "A1b2-C3d4-E5f6-G7h8-I9j0-K1l2-M3n4-O5p6",

  FRONTEND_ORIGINS: "https://app.example.invalid",
}

test("uses safe development defaults and does not require production settings in tests", () => {
  assert.deepEqual(validateEnvironment({}), {
    nodeEnv: "development",

    port: 3001,

    allowedOrigins: [],
  })

  assert.deepEqual(validateEnvironment({ NODE_ENV: "test" }), {
    nodeEnv: "test",

    port: 3001,

    allowedOrigins: [],
  })
})

test("rejects unknown environments and invalid ports", () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: "staging" }),

    /NODE_ENV must be development, test, or production/,
  )

  assert.throws(
    () => validateEnvironment({ PORT: "70000" }),

    /PORT must be an integer/,
  )
})

test("requires a JWT secret, MongoDB URI, and allowed origins in production", () => {
  const { JWT_SECRET, MONGODB_URI, FRONTEND_ORIGINS, ...withoutJwt } =
    validProductionEnvironment

  assert.throws(
    () => validateEnvironment({ ...withoutJwt, MONGODB_URI, FRONTEND_ORIGINS }),

    /JWT_SECRET is required/,
  )

  const { MONGODB_URI: _uri, ...withoutMongo } = validProductionEnvironment

  assert.throws(
    () => validateEnvironment(withoutMongo),

    /MONGODB_URI is required/,
  )

  assert.throws(
    () =>
      validateEnvironment({
        ...validProductionEnvironment,
        MONGODB_URI: "https://db.example.invalid/budgetflow",
      }),

    /MONGODB_URI must use/,
  )

  const { FRONTEND_ORIGINS: _origins, ...withoutOrigins } =
    validProductionEnvironment

  assert.throws(
    () => validateEnvironment(withoutOrigins),

    /FRONTEND_ORIGINS must configure/,
  )
})

test("rejects weak or placeholder production JWT secrets without exposing them", () => {
  for (const secret of [
    "short-secret",

    "a".repeat(48),

    "A1b2-C3d4-E5f6".repeat(4),

    "replace-this-with-a-long-random-secret-before-deployment",
  ]) {
    assert.throws(
      () =>
        validateEnvironment({
          ...validProductionEnvironment,
          JWT_SECRET: secret,
        }),

      (error) => {
        assert.match(error.message, /JWT_SECRET must be at least 32 bytes/)

        assert.equal(error.message.includes(secret), false)

        return true
      },
    )
  }
})

test("rejects empty FRONTEND_ORIGINS in production (prevents allow-all CORS)", () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "3001",
        MONGODB_URI: "mongodb://user:pass@db.example.invalid/budgetflow",
        JWT_SECRET: "A1b2-C3d4-E5f6-G7h8-I9j0-K1l2-M3n4-O5p6",
        FRONTEND_ORIGINS: "",
      }),

    /FRONTEND_ORIGINS must configure at least one origin in production/,
  )

  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "3001",
        MONGODB_URI: "mongodb://user:pass@db.example.invalid/budgetflow",
        JWT_SECRET: "A1b2-C3d4-E5f6-G7h8-I9j0-K1l2-M3n4-O5p6",
        FRONTEND_ORIGINS: "   ",
      }),

    /FRONTEND_ORIGINS must configure at least one origin in production/,
  )
})

test("normalizes configured origins and rejects non-origin URLs", () => {
  assert.deepEqual(
    getAllowedOrigins({
      FRONTEND_ORIGINS:
        "https://app.example.invalid/,https://app.example.invalid,http://localhost:8443",
    }),

    ["https://app.example.invalid", "http://localhost:8443"],
  )

  for (const value of [
    "https://app.example.invalid/path",

    "ftp://app.example.invalid",

    "https://user:password@app.example.invalid",
  ]) {
    assert.throws(
      () => getAllowedOrigins({ FRONTEND_ORIGINS: value }),

      /FRONTEND_ORIGINS/,
    )
  }
})

test("does not expose MongoDB credentials in connection errors or logs", async () => {
  const originalUri = process.env.MONGODB_URI

  const originalConnect = mongoose.connect

  const originalConsoleError = console.error

  const uri = "mongodb://user:private-password@db.example.invalid/budgetflow"

  let logged = ""

  process.env.MONGODB_URI = uri

  mongoose.connect = async () => {
    throw new Error(`Sensitive connection detail: ${uri}`)
  }

  console.error = (...values) => {
    logged += values.join(" ")
  }

  try {
    await assert.rejects(
      connectDB(),

      (error) => {
        assert.equal(
          error.message,

          "MongoDB connection failed. Check MONGODB_URI and database availability.",
        )

        assert.equal(error.message.includes(uri), false)

        return true
      },
    )

    assert.equal(logged.includes(uri), false)
  } finally {
    mongoose.connect = originalConnect

    console.error = originalConsoleError

    if (originalUri === undefined) {
      delete process.env.MONGODB_URI
    } else {
      process.env.MONGODB_URI = originalUri
    }
  }
})
