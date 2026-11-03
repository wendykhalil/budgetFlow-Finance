const assert = require("node:assert/strict")
const { after, before, describe, it } = require("node:test")
const mongoose = require("mongoose")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const User = require("../src/models/User")
const AdminAuditLog = require("../src/models/AdminAuditLog")
const requireAdmin = require("../src/middlewares/adminMiddleware")

const databaseName = `budgetflow_backend_test_admin_${process.pid}_${Date.now()}`
const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`

let adminUserId
let clientUserId

before(async () => {
  await mongoose.connect(databaseUri)

  const adminUser = await User.create({
    firstName: "Admin",
    lastName: "User",
    email: `admin-${process.pid}-${Date.now()}@example.test`,
    password: "password123",
    role: "admin",
    status: "active",
  })
  adminUserId = adminUser._id.toString()

  const clientUser = await User.create({
    firstName: "Client",
    lastName: "User",
    email: `client-${process.pid}-${Date.now()}@example.test`,
    password: "password123",
    role: "client",
    status: "active",
  })
  clientUserId = clientUser._id.toString()
})

after(async () => {
  try {
    await mongoose.connection.db.dropDatabase()
  } catch (err) {
    // Ignore cleanup errors
  }
  await mongoose.disconnect()
})

describe("requireAdmin Middleware", () => {
  it("rejects request without user object", () => {
    const req = { user: null }
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }
    const next = () => {}

    requireAdmin(req, res, next)

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.body.message, "Authentication required.")
  })

  it("rejects authenticated non-admin user", () => {
    const req = {
      user: {
        _id: clientUserId,
        role: "client",
        status: "active",
      },
    }
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }
    const next = () => {}

    requireAdmin(req, res, next)

    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.body.message, "Admin access required.")
  })

  it("accepts authenticated admin user", () => {
    const req = {
      user: {
        _id: adminUserId,
        role: "admin",
        status: "active",
      },
    }
    let nextCalled = false
    const next = () => {
      nextCalled = true
    }
    const res = {
      status() {
        return this
      },
      json() {
        return this
      },
    }

    requireAdmin(req, res, next)

    assert.strictEqual(nextCalled, true)
  })

  it("validates role from req.user only, not request body", () => {
    const req = {
      user: {
        _id: clientUserId,
        role: "client",
        status: "active",
      },
      body: {
        role: "admin", // Client attempts to override
      },
    }
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }
    const next = () => {}

    requireAdmin(req, res, next)

    assert.strictEqual(res.statusCode, 403)
  })

  it("preserves user object for next handler", () => {
    const req = {
      user: {
        _id: adminUserId,
        role: "admin",
        status: "active",
        firstName: "Admin",
      },
    }
    let nextCalled = false
    let userPreserved = false
    const next = () => {
      nextCalled = true
      userPreserved = req.user.role === "admin"
    }
    const res = {
      status() {
        return this
      },
      json() {
        return this
      },
    }

    requireAdmin(req, res, next)

    assert.strictEqual(nextCalled, true)
    assert.strictEqual(userPreserved, true)
  })
})

describe("User Model - Role Field", () => {
  it("new user has safe default role (client)", async () => {
    const user = await User.create({
      firstName: "Test",
      lastName: "User",
      email: `test-default-${process.pid}-${Date.now()}@example.test`,
      password: "password123",
    })

    assert.strictEqual(user.role, "client")
  })

  it("rejects invalid role values", async () => {
    let error
    try {
      await User.create({
        firstName: "Test",
        lastName: "User",
        email: `test-invalid-${process.pid}-${Date.now()}@example.test`,
        password: "password123",
        role: "superuser",
      })
    } catch (err) {
      error = err
    }

    assert(error, "Should throw validation error")
  })

  it("allows explicit admin role on creation", async () => {
    const user = await User.create({
      firstName: "AdminTest",
      lastName: "User",
      email: `test-admin-${process.pid}-${Date.now()}@example.test`,
      password: "password123",
      role: "admin",
      status: "active",
    })

    assert.strictEqual(user.role, "admin")
  })

  it("ordinary users do not become admins automatically", async () => {
    const user = await User.create({
      firstName: "Ordinary",
      lastName: "User",
      email: `test-ordinary-${process.pid}-${Date.now()}@example.test`,
      password: "password123",
    })

    assert.strictEqual(user.role, "client")
    assert.notStrictEqual(user.role, "admin")
  })
})

describe("AdminAuditLog Model", () => {
  describe("Field Validation", () => {
    it("requires adminUserId", async () => {
      let error
      try {
        await AdminAuditLog.create({
          action: "CREATE",
          targetType: "User",
          details: {},
        })
      } catch (err) {
        error = err
      }

      assert(error, "Should require adminUserId")
    })

    it("requires action", async () => {
      let error
      try {
        await AdminAuditLog.create({
          adminUserId,
          targetType: "User",
          details: {},
        })
      } catch (err) {
        error = err
      }

      assert(error, "Should require action")
    })

    it("requires targetType", async () => {
      let error
      try {
        await AdminAuditLog.create({
          adminUserId,
          action: "CREATE",
          details: {},
        })
      } catch (err) {
        error = err
      }

      assert(error, "Should require targetType")
    })

    it("accepts all valid action enum values", async () => {
      const actions = ["CREATE", "UPDATE", "DELETE", "READ_EXPORT"]

      for (const action of actions) {
        const log = await AdminAuditLog.create({
          adminUserId,
          action,
          targetType: "User",
          details: {},
        })

        assert.strictEqual(log.action, action)
      }
    })

    it("accepts all valid targetType enum values", async () => {
      const targetTypes = [
        "User",
        "Transaction",
        "Category",
        "Budget",
        "Settings",
      ]

      for (const targetType of targetTypes) {
        const log = await AdminAuditLog.create({
          adminUserId,
          action: "CREATE",
          targetType,
          details: {},
        })

        assert.strictEqual(log.targetType, targetType)
      }
    })

    it("rejects invalid action", async () => {
      let error
      try {
        await AdminAuditLog.create({
          adminUserId,
          action: "INVALID",
          targetType: "User",
          details: {},
        })
      } catch (err) {
        error = err
      }

      assert(error, "Should reject invalid action")
    })

    it("rejects invalid targetType", async () => {
      let error
      try {
        await AdminAuditLog.create({
          adminUserId,
          action: "CREATE",
          targetType: "InvalidType",
          details: {},
        })
      } catch (err) {
        error = err
      }

      assert(error, "Should reject invalid targetType")
    })
  })

  describe("Sensitive Data Protection", () => {
    it("does not require password field in model", async () => {
      const log = await AdminAuditLog.create({
        adminUserId,
        action: "CREATE",
        targetType: "User",
        targetId: clientUserId,
        details: {
          email: "test@example.com",
          firstName: "Test",
        },
      })

      assert(!log.details.password, "Password should not be stored")
    })

    it("stores details as mixed type (application-level sanitization expected)", async () => {
      const details = {
        firstName: "Updated",
        status: "suspended",
      }

      const log = await AdminAuditLog.create({
        adminUserId,
        action: "UPDATE",
        targetType: "User",
        targetId: clientUserId,
        details,
      })

      assert.deepStrictEqual(log.details, details)
    })
  })

  describe("Schema and Indexes", () => {
    it("auto-generates createdAt timestamp", async () => {
      const before = Date.now()

      const log = await AdminAuditLog.create({
        adminUserId,
        action: "DELETE",
        targetType: "User",
        targetId: clientUserId,
        details: {},
      })

      const after = Date.now()

      assert(log.createdAt)
      assert(log.createdAt.getTime() >= before - 100)
      assert(log.createdAt.getTime() <= after + 100)
    })

    it("targetId is optional", async () => {
      const log = await AdminAuditLog.create({
        adminUserId,
        action: "READ_EXPORT",
        targetType: "User",
        details: {},
      })

      assert.strictEqual(log.targetId, null)
    })

    it("stores and retrieves audit logs correctly", async () => {
      await AdminAuditLog.create({
        adminUserId,
        action: "CREATE",
        targetType: "User",
        targetId: clientUserId,
        details: { email: "test@example.com" },
      })

      const logs = await AdminAuditLog.find({ adminUserId }).sort({
        createdAt: -1,
      })

      assert(logs.length > 0)
      assert.strictEqual(logs[0].action, "CREATE")
      assert.strictEqual(logs[0].targetType, "User")
    })
  })

  describe("toJSON Transform", () => {
    it("converts _id to id and removes internal fields", async () => {
      const log = await AdminAuditLog.create({
        adminUserId,
        action: "CREATE",
        targetType: "User",
        details: {},
      })

      const json = log.toJSON()

      assert(json.id, "Should have id field")
      assert.strictEqual(json._id, undefined, "Should not have _id")
      assert.strictEqual(json.__v, undefined, "Should not have __v")
    })
  })
})
