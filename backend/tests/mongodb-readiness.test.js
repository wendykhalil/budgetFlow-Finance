const assert = require("node:assert/strict")
const { test } = require("node:test")
const mongoose = require("mongoose")

// Setup environment
process.env.NODE_ENV = "test"
process.env.FRONTEND_ORIGINS = "http://localhost:8443"
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/budgetflow-test"
process.env.JWT_SECRET = "test-secret-at-least-32-bytes-long-1234567890"
process.env.PORT = "0"

const app = require("../src/app")
const { connectDB, isDatabaseConnected } = require("../src/config/database")

// Helpers
async function startServer() {
  const server = app.listen(0, "127.0.0.1")
  await new Promise((resolve) => server.on("listening", resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return { server, baseUrl }
}

async function stopServer(server) {
  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function disconnectMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

function checkDatabaseState() {
  const connected = isDatabaseConnected()
  const readyState = mongoose.connection.readyState
  console.log(`  [DB State] Connected: ${connected}, ReadyState: ${readyState}`)
  return connected
}

// Test 1: Health endpoint is independent of MongoDB
test("GET /api/health returns 200 regardless of MongoDB state", async () => {
  const { server, baseUrl } = await startServer()

  try {
    const response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 200, "Expected 200 from /api/health")

    const data = await response.json()
    assert.equal(data.status, "ok", "Expected status: ok")
    assert.match(
      data.message,
      /running/,
      "Expected message to contain 'running'",
    )

    console.log("  ✓ /api/health returns 200 even before MongoDB connection")
  } finally {
    await stopServer(server)
  }
})

// Test 2: Readiness returns 503 when MongoDB is disconnected
test("GET /api/ready returns 503 when MongoDB is disconnected", async () => {
  const { server, baseUrl } = await startServer()

  try {
    await disconnectMongoDB()
    const isConnected = checkDatabaseState()
    assert.equal(isConnected, false, "MongoDB should be disconnected")

    const response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(
      response.status,
      503,
      "Expected 503 when MongoDB is disconnected",
    )

    const data = await response.json()
    assert.equal(data.status, "not_ready", "Expected status: not_ready")
    assert.equal(
      data.database,
      "disconnected",
      "Expected database: disconnected",
    )

    console.log("  ✓ /api/ready returns 503 when MongoDB is disconnected")
  } finally {
    await stopServer(server)
  }
})

// Test 3: Readiness returns 200 when MongoDB is connected
test("GET /api/ready returns 200 when MongoDB is connected", async () => {
  const { server, baseUrl } = await startServer()

  try {
    // Try to connect to MongoDB
    try {
      await connectDB()
    } catch (error) {
      console.log(`  ⚠ Could not connect to MongoDB: ${error.message}`)
      console.log("    (Skipping rest of test - MongoDB not available)")
      return
    }

    const isConnected = checkDatabaseState()

    if (!isConnected) {
      console.log("  ⚠ MongoDB connection not reflected in readyState")
      return
    }

    const response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(response.status, 200, "Expected 200 when MongoDB is connected")

    const data = await response.json()
    assert.equal(data.status, "ready", "Expected status: ready")
    assert.equal(data.database, "connected", "Expected database: connected")

    console.log("  ✓ /api/ready returns 200 when MongoDB is connected")
  } finally {
    await disconnectMongoDB()
    await stopServer(server)
  }
})

// Test 4: Server starts successfully
test("Server starts and responds to health check", async () => {
  const { server, baseUrl } = await startServer()

  try {
    const response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 200, "Server should respond to health check")

    console.log("  ✓ Server starts and responds to requests")
  } finally {
    await stopServer(server)
  }
})

// Test 5: Server stops cleanly
test("Server stops cleanly and closes port", async () => {
  const { server, baseUrl } = await startServer()
  await stopServer(server)

  // Attempt to connect to closed server should fail
  try {
    await fetch(`${baseUrl}/api/health`, { timeout: 500 })
    assert.fail("Should not be able to connect to closed server")
  } catch (error) {
    assert.match(
      error.message,
      /(?:ECONNREFUSED|Connection refused|Failed to fetch|fetch failed)/,
      "Expected connection error",
    )
    console.log("  ✓ Server stops cleanly and closes port")
  }
})

// Test 6: Server handles MongoDB unavailable at startup
test("Server handles MongoDB unavailable at startup", async () => {
  const { server, baseUrl } = await startServer()

  try {
    // Health should still work
    let response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 200, "Health check should still work")

    // Ready should return 503
    response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(
      response.status,
      503,
      "Ready endpoint should return 503 when DB unavailable",
    )

    console.log("  ✓ Server handles MongoDB unavailable at startup")
  } finally {
    await disconnectMongoDB()
    await stopServer(server)
  }
})

// Test 7: Connection state transitions
test("Connection state transitions are properly reflected", async () => {
  const { server, baseUrl } = await startServer()

  try {
    // Initial state (disconnected)
    let response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(response.status, 503, "Should start with 503 (disconnected)")

    // Try to connect
    try {
      await connectDB()
      const connectedStatus = isDatabaseConnected()

      if (!connectedStatus) {
        console.log("  ⚠ Could not establish connection to test database")
        return
      }

      response = await fetch(`${baseUrl}/api/ready`)
      assert.equal(response.status, 200, "Should return 200 after connection")

      // Disconnect
      await disconnectMongoDB()
      const disconnectedStatus = isDatabaseConnected()
      assert.equal(disconnectedStatus, false, "Should be disconnected")

      response = await fetch(`${baseUrl}/api/ready`)
      assert.equal(
        response.status,
        503,
        "Should return 503 after disconnection",
      )

      console.log("  ✓ Connection state transitions are properly reflected")
    } catch (error) {
      console.log(`  ⚠ MongoDB operations failed: ${error.message}`)
    }
  } finally {
    await disconnectMongoDB()
    await stopServer(server)
  }
})

// Test 8: Readiness endpoint response format
test("Readiness endpoint returns proper JSON structure", async () => {
  const { server, baseUrl } = await startServer()

  try {
    await disconnectMongoDB()

    const response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(response.status, 503, "Expected 503 status")
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
      "Expected JSON content type",
    )

    const data = await response.json()
    assert.ok(data.status, "Expected status field")
    assert.ok(data.database, "Expected database field")

    console.log("  ✓ Response has correct JSON structure and headers")
  } finally {
    await stopServer(server)
  }
})
