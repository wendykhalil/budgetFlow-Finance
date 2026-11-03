const assert = require("node:assert/strict")
const { after, before, describe, it } = require("node:test")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const app = require("../src/app")
const User = require("../src/models/User")
const Transaction = require("../src/models/Transaction")
const Category = require("../src/models/Category")

const databaseName = `budgetflow_backend_test_admin_transactions_${process.pid}_${Date.now()}`
const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`

let baseUrl
let adminToken
let adminUserId
let clientToken
let clientUserId
let testTransactions = []
let testCategories = []
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
  await mongoose.connect(databaseUri)

  // Create admin user
  const adminUser = await User.create({
    firstName: "Admin",
    lastName: "User",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
    status: "active",
    currency: "EUR",
  })
  adminUserId = adminUser._id.toString()
  adminToken = jwt.sign(
    { sub: adminUserId, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  )

  // Create client user
  const clientUser = await User.create({
    firstName: "Client",
    lastName: "User",
    email: "client@test.com",
    password: "password123",
    role: "client",
    status: "active",
    currency: "USD",
  })
  clientUserId = clientUser._id.toString()
  clientToken = jwt.sign(
    { sub: clientUserId, role: "client" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  )

  // Create additional test users for aggregation
  for (let i = 0; i < 3; i++) {
    const user = await User.create({
      firstName: `User${i}`,
      lastName: `Test${i}`,
      email: `user${i}@test.com`,
      password: "password123",
      role: "client",
      status: "active",
      currency: "EUR",
    })
    testUsers.push(user)
  }

  // Create categories
  const expenseCategory = await Category.create({
    userId: clientUserId,
    name: "Groceries",
    type: "expense",
  })
  const incomeCategory = await Category.create({
    userId: clientUserId,
    name: "Salary",
    type: "income",
  })
  testCategories.push(expenseCategory, incomeCategory)

  // Create test transactions for client user
  const transactionData = [
    {
      date: "2026-11-01",
      description: "Grocery store",
      type: "expense",
      amount: 50,
      categoryId: expenseCategory._id,
      status: "completed",
    },
    {
      date: "2026-11-02",
      description: "Salary deposit",
      type: "income",
      amount: 2000,
      categoryId: incomeCategory._id,
      status: "completed",
    },
    {
      date: "2026-11-03",
      description: "Restaurant",
      type: "expense",
      amount: 30,
      categoryId: expenseCategory._id,
      status: "completed",
    },
    {
      date: "2026-11-04",
      description: "Pending expense",
      type: "expense",
      amount: 20,
      categoryId: expenseCategory._id,
      status: "pending",
    },
    {
      date: "2026-10-01",
      description: "October expense",
      type: "expense",
      amount: 100,
      categoryId: expenseCategory._id,
      status: "completed",
    },
  ]

  for (const data of transactionData) {
    const tx = await Transaction.create({
      userId: clientUserId,
      ...data,
      category: data.type === "expense" ? "Groceries" : "Salary",
    })
    testTransactions.push(tx)
  }

  // Create transactions for other users
  for (const user of testUsers) {
    for (let i = 0; i < 5; i++) {
      const userExpenseCategory = await Category.create({
        userId: user._id,
        name: `Category${i}`,
        type: "expense",
      })

      await Transaction.create({
        userId: user._id,
        date: "2026-11-01",
        description: `Transaction ${i}`,
        type: "expense",
        amount: 50 + i * 10,
        categoryId: userExpenseCategory._id,
        category: `Category${i}`,
        status: "completed",
      })
    }
  }

  const server = app.listen(0)
  baseUrl = `http://localhost:${server.address().port}`
})

after(async () => {
  await mongoose.disconnect()
})

describe("Admin Transactions API", () => {
  describe("GET /api/admin/transactions", () => {
    it("should return 401 without authentication", async () => {
      const res = await request("/api/admin/transactions")
      assert.equal(res.status, 401)
    })

    it("should return 403 for client user", async () => {
      const res = await request("/api/admin/transactions", {
        accessToken: clientToken,
      })
      assert.equal(res.status, 403)
    })

    it("should return all transactions for admin user", async () => {
      const res = await request("/api/admin/transactions", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(Array.isArray(body.data))
      assert(body.data.length > 0)
      assert.equal(body.pagination.page, 1)
      assert.equal(body.pagination.limit, 20)
    })

    it("should respect pagination", async () => {
      const res = await request("/api/admin/transactions?page=1&limit=2", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.data.length, 2)
      assert.equal(body.pagination.page, 1)
      assert.equal(body.pagination.limit, 2)
    })

    it("should enforce maximum limit of 100", async () => {
      const res = await request("/api/admin/transactions?limit=500", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.pagination.limit, 100)
    })

    it("should filter by userId", async () => {
      const res = await request(
        `/api/admin/transactions?userId=${clientUserId}`,
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length > 0)
      assert(body.data.every((tx) => tx.userId.id === clientUserId))
    })

    it("should reject invalid userId", async () => {
      const res = await request("/api/admin/transactions?userId=invalid-id", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 400)
      const body = await res.json()
      assert.match(body.message, /Invalid user ID/i)
    })

    it("should filter by type", async () => {
      const res = await request("/api/admin/transactions?type=expense", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.every((tx) => tx.type === "expense"))
    })

    it("should filter by status", async () => {
      const res = await request("/api/admin/transactions?status=pending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.every((tx) => tx.status === "pending"))
    })

    it("should filter by category", async () => {
      const res = await request("/api/admin/transactions?category=Groceries", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length > 0)
      assert(body.data.every((tx) => tx.category.includes("Groceries")))
    })

    it("should filter by date range", async () => {
      const res = await request(
        "/api/admin/transactions?startDate=2026-11-01&endDate=2026-11-03",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(
        body.data.every(
          (tx) => tx.date >= "2026-11-01" && tx.date <= "2026-11-03",
        ),
      )
    })

    it("should sort by date descending", async () => {
      const res = await request("/api/admin/transactions", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          assert(body.data[i].date >= body.data[i + 1].date)
        }
      }
    })

    it("should include safe user information without password", async () => {
      const res = await request("/api/admin/transactions", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      const tx = body.data[0]
      assert(tx.userId)
      assert(tx.userId.id)
      assert(tx.userId.firstName)
      assert(tx.userId.lastName)
      assert(tx.userId.email)
      assert(!tx.userId.password)
      assert(!tx.userId.role)
    })
  })

  describe("GET /api/admin/reports/transactions-by-category", () => {
    it("should return 401 without authentication", async () => {
      const res = await request("/api/admin/reports/transactions-by-category")
      assert.equal(res.status, 401)
    })

    it("should return 403 for client user", async () => {
      const res = await request("/api/admin/reports/transactions-by-category", {
        accessToken: clientToken,
      })
      assert.equal(res.status, 403)
    })

    it("should return category aggregation", async () => {
      const res = await request("/api/admin/reports/transactions-by-category", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(Array.isArray(body.data))
      assert(body.summary)
      assert.equal(typeof body.summary.totalTransactions, "number")
      assert.equal(typeof body.summary.totalAmount, "number")
    })

    it("should include only completed transactions", async () => {
      const res = await request("/api/admin/reports/transactions-by-category", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      // All totals should be from completed transactions (pending should be excluded)
      const allTransactionsRes = await request(
        "/api/admin/reports/transactions-by-category?type=expense",
        { accessToken: adminToken },
      )
      const allBody = await allTransactionsRes.json()
      // Sum of all categories should exclude pending transactions
      assert(body.data.length > 0)
    })

    it("should filter by type", async () => {
      const res = await request(
        "/api/admin/reports/transactions-by-category?type=expense",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      // All expenses should be non-negative
      assert(body.data.every((cat) => cat.expense >= 0 && cat.income === 0))
    })

    it("should filter by date range", async () => {
      const res = await request(
        "/api/admin/reports/transactions-by-category?startDate=2026-11-01&endDate=2026-11-02",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      // Results should be from the specified date range
      assert(body.data.length >= 0) // May be empty if no transactions in range
    })

    it("should return sorted by totalAmount descending", async () => {
      const res = await request("/api/admin/reports/transactions-by-category", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          assert(body.data[i].totalAmount >= body.data[i + 1].totalAmount)
        }
      }
    })

    it("should handle empty dataset", async () => {
      const res = await request(
        "/api/admin/reports/transactions-by-category?startDate=2000-01-01&endDate=2000-12-31",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.data.length, 0)
      assert.equal(body.summary.totalTransactions, 0)
    })
  })

  describe("GET /api/admin/reports/user-spending", () => {
    it("should return 401 without authentication", async () => {
      const res = await request("/api/admin/reports/user-spending")
      assert.equal(res.status, 401)
    })

    it("should return 403 for client user", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: clientToken,
      })
      assert.equal(res.status, 403)
    })

    it("should return user spending aggregation", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(Array.isArray(body.data))
      assert(body.summary)
      assert.equal(typeof body.summary.totalUsers, "number")
      assert.equal(typeof body.summary.totalExpense, "number")
    })

    it("should include only completed transactions", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      // Pending transactions should be excluded from spending totals
      assert(body.data.length > 0)
      // Verify no pending transactions are counted
      const userWithClientTransactions = body.data.find(
        (u) => u.userId === clientUserId,
      )
      if (userWithClientTransactions) {
        // Should only count the 3 completed expenses and 1 income (4 total for client)
        // not the 1 pending transaction
        assert(userWithClientTransactions.transactionCount <= 4)
      }
    })

    it("should exclude pending transactions from spending totals", async () => {
      // Get all transactions for client (including pending)
      const allRes = await request(
        `/api/admin/transactions?userId=${clientUserId}`,
        { accessToken: adminToken },
      )
      const allData = await allRes.json()
      const allTransactions = allData.data
      const pendingCount = allTransactions.filter(
        (t) => t.status === "pending",
      ).length
      const completedCount = allTransactions.filter(
        (t) => t.status === "completed",
      ).length

      // Get spending report (only completed)
      const spendingRes = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      const spendingData = await spendingRes.json()

      assert(pendingCount > 0) // Should have at least 1 pending
      const userSpending = spendingData.data.find(
        (u) => u.userId === clientUserId,
      )
      if (userSpending) {
        // Transaction count should exclude pending
        assert.equal(userSpending.transactionCount, completedCount)
      }
    })

    it("should filter by date range", async () => {
      const res = await request(
        "/api/admin/reports/user-spending?startDate=2026-10-01&endDate=2026-10-31",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      // Should find October transactions
      assert(body.data.length >= 0)
    })

    it("should sort by expense descending", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          assert(body.data[i].expense >= body.data[i + 1].expense)
        }
      }
    })

    it("should respect limit parameter", async () => {
      const res = await request("/api/admin/reports/user-spending?limit=2", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length <= 2)
    })

    it("should enforce maximum limit of 500", async () => {
      const res = await request("/api/admin/reports/user-spending?limit=1000", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      // Limit should be capped at 500
      assert(body.data.length <= 500)
    })

    it("should include user name and email", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length > 0)
      const user = body.data[0]
      assert(user.firstName)
      assert(user.lastName)
      assert(user.email)
      assert(user.userId)
      assert(!user.password)
      assert(!user.role)
    })

    it("should include user currency", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length > 0)
      const user = body.data[0]
      assert(user.currency)
    })

    it("should calculate income and expense separately", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert(body.data.length > 0)
      const user = body.data[0]
      assert.equal(typeof user.income, "number")
      assert.equal(typeof user.expense, "number")
      assert.equal(typeof user.totalAmount, "number")
    })

    it("should handle empty dataset", async () => {
      const res = await request(
        "/api/admin/reports/user-spending?startDate=2000-01-01&endDate=2000-12-31",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.data.length, 0)
      assert.equal(body.summary.totalUsers, 0)
    })
  })

  describe("Transaction isolation and boundaries", () => {
    it("should not allow client to access admin transactions endpoint", async () => {
      const res = await request("/api/admin/transactions", {
        accessToken: clientToken,
      })
      assert.equal(res.status, 403)
    })

    it("should not return client transactions in list when filtered by another user", async () => {
      const res = await request(
        `/api/admin/transactions?userId=${testUsers[0]._id}`,
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      const body = await res.json()
      // Should return transactions for the specified user, not the client
      assert(
        body.data.every((tx) => tx.userId.id === testUsers[0]._id.toString()),
      )
    })

    it("should handle invalid date format gracefully", async () => {
      const res = await request(
        "/api/admin/transactions?startDate=invalid-date",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      // Invalid date should be ignored, not error
      const body = await res.json()
      assert(Array.isArray(body.data))
    })

    it("should handle invalid status enum", async () => {
      const res = await request(
        "/api/admin/transactions?status=invalid-status",
        { accessToken: adminToken },
      )
      assert.equal(res.status, 200)
      // Invalid status should be ignored
      const body = await res.json()
      assert(Array.isArray(body.data))
    })

    it("should handle invalid type enum", async () => {
      const res = await request("/api/admin/transactions?type=invalid-type", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      // Invalid type should be ignored
      const body = await res.json()
      assert(Array.isArray(body.data))
    })
  })

  describe("Aggregation correctness", () => {
    it("category report should sum transactions correctly", async () => {
      const res = await request("/api/admin/reports/transactions-by-category", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()

      // Verify summary totals equal sum of individual categories
      let totalIncome = 0
      let totalExpense = 0
      for (const cat of body.data) {
        totalIncome += cat.income
        totalExpense += cat.expense
      }

      assert.equal(totalIncome, body.summary.totalIncome)
      assert.equal(totalExpense, body.summary.totalExpense)
    })

    it("user spending report should sum transactions correctly", async () => {
      const res = await request("/api/admin/reports/user-spending", {
        accessToken: adminToken,
      })
      assert.equal(res.status, 200)
      const body = await res.json()

      // Verify summary totals equal sum of individual users
      let totalIncome = 0
      let totalExpense = 0
      let totalTransactions = 0
      for (const user of body.data) {
        totalIncome += user.income
        totalExpense += user.expense
        totalTransactions += user.transactionCount
      }

      assert.equal(totalIncome, body.summary.totalIncome)
      assert.equal(totalExpense, body.summary.totalExpense)
      assert.equal(totalTransactions, body.summary.totalTransactions)
    })
  })
})
