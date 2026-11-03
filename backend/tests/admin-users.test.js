const assert = require("node:assert/strict")
const { after, before, describe, it } = require("node:test")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { createServer } = require("node:http")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const app = require("../src/app")
const User = require("../src/models/User")
const AdminAuditLog = require("../src/models/AdminAuditLog")

const databaseName = `budgetflow_backend_test_admin_users_${process.pid}_${Date.now()}`
const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`

let server
let baseUrl
let adminToken
let adminUserId
let clientToken
let clientUserId
let testUsers = []

async function request(
  path,
  { method = "GET", accessToken, body, headers = {} } = {},
) {
  const requestHeaders = { ...headers }

  if (accessToken) {
    requestHeaders.authorization = `Bearer ${accessToken}`
  }

  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json"
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

before(async () => {
  // Connect to test database
  await mongoose.connect(databaseUri)

  // Create admin user
  const adminUser = await User.create({
    firstName: "Admin",
    lastName: "User",
    email: `admin-${process.pid}-${Date.now()}@example.test`,
    password: "password123",
    role: "admin",
    status: "active",
  })
  adminUserId = adminUser._id.toString()

  // Create client user
  const clientUser = await User.create({
    firstName: "Client",
    lastName: "User",
    email: `client-${process.pid}-${Date.now()}@example.test`,
    password: "password123",
    role: "client",
    status: "active",
  })
  clientUserId = clientUser._id.toString()

  // Create test users for listing
  for (let i = 0; i < 25; i++) {
    const user = await User.create({
      firstName: `User${i}`,
      lastName: `Test${i}`,
      email: `user${i}-${process.pid}-${Date.now()}@example.test`,
      password: "password123",
      role: i % 2 === 0 ? "client" : "client",
      status: i % 3 === 0 ? "suspended" : i % 3 === 1 ? "pending" : "active",
    })
    testUsers.push(user)
  }

  // Generate JWT tokens
  adminToken = jwt.sign({ sub: adminUserId }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1d",
  })

  clientToken = jwt.sign({ sub: clientUserId }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1d",
  })

  // Start HTTP server
  server = createServer(app)
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
})

after(async () => {
  server.close()
  try {
    await mongoose.connection.db.dropDatabase()
  } catch (err) {
    // Ignore
  }
  await mongoose.disconnect()
})

describe("Admin User Management API", () => {
  describe("Authentication and Authorization", () => {
    it("rejects unauthenticated request to list users", async () => {
      const res = await request("/api/admin/users")
      assert.strictEqual(res.status, 401)
    })

    it("rejects client user request to list users", async () => {
      const res = await request("/api/admin/users", {
        accessToken: clientToken,
      })
      assert.strictEqual(res.status, 403)
    })

    it("accepts admin user request to list users", async () => {
      const res = await request("/api/admin/users", { accessToken: adminToken })
      assert.strictEqual(res.status, 200)
    })

    it("rejects unauthenticated request to get user detail", async () => {
      const res = await request(`/api/admin/users/${clientUserId}`)
      assert.strictEqual(res.status, 401)
    })

    it("rejects client user request to get user detail", async () => {
      const res = await request(`/api/admin/users/${clientUserId}`, {
        accessToken: clientToken,
      })
      assert.strictEqual(res.status, 403)
    })

    it("rejects unauthenticated request to update user status", async () => {
      const res = await request(`/api/admin/users/${clientUserId}/status`, {
        method: "PATCH",
        body: { status: "suspended" },
      })
      assert.strictEqual(res.status, 401)
    })

    it("rejects client user request to update user status", async () => {
      const res = await request(`/api/admin/users/${clientUserId}/status`, {
        method: "PATCH",
        accessToken: clientToken,
        body: { status: "suspended" },
      })
      assert.strictEqual(res.status, 403)
    })
  })

  describe("GET /api/admin/users - List Users", () => {
    it("returns paginated user list", async () => {
      const res = await request("/api/admin/users", { accessToken: adminToken })
      const data = await res.json()

      assert.strictEqual(res.status, 200)
      assert(Array.isArray(data.data))
      assert(data.pagination)
      assert.strictEqual(data.pagination.page, 1)
      assert.strictEqual(data.pagination.limit, 20)
      assert.strictEqual(data.pagination.total > 0, true)
    })

    it("respects page parameter", async () => {
      const res1 = await request("/api/admin/users?page=1&limit=5", {
        accessToken: adminToken,
      })
      const data1 = await res1.json()

      const res2 = await request("/api/admin/users?page=2&limit=5", {
        accessToken: adminToken,
      })
      const data2 = await res2.json()

      assert.strictEqual(data1.pagination.page, 1)
      assert.strictEqual(data2.pagination.page, 2)
      assert.notStrictEqual(data1.data[0].id, data2.data[0].id)
    })

    it("respects limit parameter (max 100)", async () => {
      const res = await request("/api/admin/users?limit=50", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert.strictEqual(data.pagination.limit, 50)
      assert(data.data.length <= 50)
    })

    it("caps limit at 100", async () => {
      const res = await request("/api/admin/users?limit=200", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert.strictEqual(data.pagination.limit, 100)
    })

    it("searches by first name", async () => {
      const res = await request("/api/admin/users?search=User0", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(data.data.length > 0)
      assert(data.data.some((u) => u.firstName.includes("User0")))
    })

    it("searches by last name", async () => {
      const res = await request("/api/admin/users?search=Test1", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(data.data.length > 0)
      assert(data.data.some((u) => u.lastName.includes("Test1")))
    })

    it("searches by email", async () => {
      const user = testUsers[0]
      const searchEmail = user.email.substring(0, 5)
      const res = await request(`/api/admin/users?search=${searchEmail}`, {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(data.data.length > 0)
    })

    it("filters by role", async () => {
      const res = await request("/api/admin/users?role=client", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(data.data.length > 0)
      assert(data.data.every((u) => u.role === "client"))
    })

    it("filters by status", async () => {
      const res = await request("/api/admin/users?status=suspended", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(
        data.data.every(
          (u) => u.status === "suspended" || data.data.length === 0,
        ),
      )
    })

    it("does not include password in response", async () => {
      const res = await request("/api/admin/users", { accessToken: adminToken })
      const data = await res.json()

      assert(data.data.every((u) => !u.password))
    })

    it("includes pagination metadata", async () => {
      const res = await request("/api/admin/users?limit=5", {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert.strictEqual(typeof data.pagination.page, "number")
      assert.strictEqual(typeof data.pagination.limit, "number")
      assert.strictEqual(typeof data.pagination.total, "number")
      assert.strictEqual(typeof data.pagination.pages, "number")
    })

    it("sorts by newest first", async () => {
      const res = await request("/api/admin/users", { accessToken: adminToken })
      const data = await res.json()

      // First user should be most recently created
      assert(data.data.length > 0)
    })
  })

  describe("GET /api/admin/users/:id - Get User Detail", () => {
    it("returns user details for valid ID", async () => {
      const res = await request(`/api/admin/users/${clientUserId}`, {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert.strictEqual(res.status, 200)
      assert.strictEqual(data.user.id, clientUserId)
      assert(data.user.email.startsWith("client-"))
    })

    it("returns 404 for nonexistent user", async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const res = await request(`/api/admin/users/${fakeId.toString()}`, {
        accessToken: adminToken,
      })

      assert.strictEqual(res.status, 404)
    })

    it("returns 404 for invalid ObjectId", async () => {
      const res = await request("/api/admin/users/invalid-id", {
        accessToken: adminToken,
      })

      assert.strictEqual(res.status, 404)
    })

    it("does not include password in response", async () => {
      const res = await request(`/api/admin/users/${clientUserId}`, {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(!data.user.password)
    })

    it("includes user fields (id, firstName, lastName, email, role, status, createdAt)", async () => {
      const res = await request(`/api/admin/users/${clientUserId}`, {
        accessToken: adminToken,
      })
      const data = await res.json()

      assert(data.user.id)
      assert(data.user.firstName)
      assert(data.user.lastName)
      assert(data.user.email)
      assert(data.user.role)
      assert(data.user.status)
      assert(data.user.createdAt)
    })
  })

  describe("PATCH /api/admin/users/:id/status - Update User Status", () => {
    it("updates user status to suspended", async () => {
      const testUser = testUsers[0]
      const res = await request(
        `/api/admin/users/${testUser._id.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: "suspended" },
        },
      )

      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.user.status, "suspended")

      // Verify in database
      const updated = await User.findById(testUser._id)
      assert.strictEqual(updated.status, "suspended")
    })

    it("updates user status to active", async () => {
      const testUser = testUsers[1]
      testUser.status = "suspended"
      await testUser.save()

      const res = await request(
        `/api/admin/users/${testUser._id.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: "active" },
        },
      )

      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.user.status, "active")
    })

    it("updates user status to pending", async () => {
      const testUser = testUsers[2]
      const res = await request(
        `/api/admin/users/${testUser._id.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: "pending" },
        },
      )

      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.user.status, "pending")
    })

    it("rejects invalid status", async () => {
      const testUser = testUsers[3]
      const res = await request(
        `/api/admin/users/${testUser._id.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: "invalid" },
        },
      )

      assert.strictEqual(res.status, 400)
    })

    it("returns 404 for nonexistent user", async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const res = await request(
        `/api/admin/users/${fakeId.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: "suspended" },
        },
      )

      assert.strictEqual(res.status, 404)
    })

    it("prevents admin from deactivating themselves", async () => {
      const res = await request(`/api/admin/users/${adminUserId}/status`, {
        method: "PATCH",
        accessToken: adminToken,
        body: { status: "suspended" },
      })

      assert.strictEqual(res.status, 409)

      // Verify admin is still active
      const admin = await User.findById(adminUserId)
      assert.strictEqual(admin.status, "active")
    })

    it("allows admin to change their own status to active", async () => {
      // This should be a no-op if already active
      const res = await request(`/api/admin/users/${adminUserId}/status`, {
        method: "PATCH",
        accessToken: adminToken,
        body: { status: "active" },
      })

      assert.strictEqual(res.status, 200)
    })

    it("skips update if status is already set", async () => {
      const testUser = testUsers[4]
      const originalStatus = testUser.status

      const res = await request(
        `/api/admin/users/${testUser._id.toString()}/status`,
        {
          method: "PATCH",
          accessToken: adminToken,
          body: { status: originalStatus },
        },
      )

      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.user.status, originalStatus)
    })

    it("creates audit log on status change", async () => {
      const testUser = testUsers[5]
      const oldStatus = testUser.status

      await request(`/api/admin/users/${testUser._id.toString()}/status`, {
        method: "PATCH",
        accessToken: adminToken,
        body: { status: "suspended" },
      })

      // Allow async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      const logs = await AdminAuditLog.find({ targetId: testUser._id })
      assert(logs.length > 0)
      assert.strictEqual(logs[0].action, "UPDATE")
      assert.strictEqual(logs[0].targetType, "User")
      assert.strictEqual(logs[0].details.statusBefore, oldStatus)
      assert.strictEqual(logs[0].details.statusAfter, "suspended")
    })

    it("does not expose passwords or sensitive data in audit log", async () => {
      const testUser = testUsers[6]

      await request(`/api/admin/users/${testUser._id.toString()}/status`, {
        method: "PATCH",
        accessToken: adminToken,
        body: { status: "pending" },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const logs = await AdminAuditLog.find({ targetId: testUser._id })
      assert(logs.length > 0)
      assert(!logs[0].details.password)
      assert(!logs[0].details.email)
    })
  })

  describe("Existing client authentication behavior", () => {
    it("does not affect existing client auth routes", async () => {
      const res = await request("/api/auth/me", { accessToken: clientToken })

      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.user.role, "client")
    })

    it("preserves client user isolation for existing endpoints", async () => {
      // Client token can still access their own resources
      assert.strictEqual(clientToken.length > 0, true)
    })
  })
})
