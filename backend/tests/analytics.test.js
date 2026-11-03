const assert = require("node:assert/strict")
const { before, after, it, describe } = require("node:test")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { createServer } = require("node:http")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const app = require("../src/app")
const Transaction = require("../src/models/Transaction")
const User = require("../src/models/User")

const databaseName = `budgetflow_test_analytics_${process.pid}_${Date.now()}`
const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`

const email = `analytics-test-${process.pid}-${Date.now()}@example.test`

let server
let baseUrl
let token
let userId

async function request(path, { method = "GET", accessToken, body } = {}) {
  const headers = {}
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`
  }
  if (body) {
    headers["content-type"] = "application/json"
  }
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("Analytics API", () => {
  before(async () => {
    await mongoose.connect(databaseUri)

    const user = await User.create({
      firstName: "Test",
      lastName: "User",
      email,
      password: "password123",
      currency: "EUR",
    })

    userId = user._id.toString()
    token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1d",
    })

    server = createServer(app)
    server.listen(0, "127.0.0.1")
    await new Promise((resolve) => server.on("listening", resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  })

  it("GET /analytics returns 401 without token", async () => {
    const res = await request("/api/analytics")
    assert.equal(res.status, 401)
  })

  it("GET /analytics returns empty arrays for user with no transactions", async () => {
    const res = await request("/api/analytics", { accessToken: token })
    assert.equal(res.status, 200)

    const data = await res.json()
    assert.deepEqual(data.monthlyBalance.length, 6)
    assert.deepEqual(data.expensesByCategory.length, 0)
    assert.deepEqual(data.incomeByCategory.length, 0)
    assert.equal(data.insights.savingsRate, 0)
  })

  it("calculates monthly balance correctly", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Salary",
        category: "Salary",
        type: "income",
        amount: 3000,
        status: "completed",
      },
      {
        userId,
        date: `${month}-10`,
        description: "Food",
        category: "Food",
        type: "expense",
        amount: 200,
        status: "completed",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    assert.equal(res.status, 200)
    const data = await res.json()

    const lastMonth = data.monthlyBalance[5]
    assert.equal(lastMonth.income, 3000)
    assert.equal(lastMonth.expense, 200)
  })

  it("ignores pending transactions in calculations", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Pending Salary",
        category: "Salary",
        type: "income",
        amount: 3000,
        status: "pending",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    const data = await res.json()

    const lastMonth = data.monthlyBalance[5]
    assert.equal(lastMonth.income, 0)
    assert.equal(lastMonth.expense, 0)
  })

  it("calculates expenses by category for current month", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Rent",
        category: "Housing",
        type: "expense",
        amount: 1500,
        status: "completed",
      },
      {
        userId,
        date: `${month}-10`,
        description: "Food",
        category: "Food",
        type: "expense",
        amount: 300,
        status: "completed",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    const data = await res.json()

    assert.equal(data.expensesByCategory.length, 2)
    assert.equal(data.expensesByCategory[0].name, "Housing")
    assert.equal(data.expensesByCategory[0].value, 1500)
  })

  it("calculates income by category for current month", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Salary",
        category: "Salary",
        type: "income",
        amount: 3000,
        status: "completed",
      },
      {
        userId,
        date: `${month}-10`,
        description: "Freelance",
        category: "Freelance",
        type: "income",
        amount: 500,
        status: "completed",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    const data = await res.json()

    assert.equal(data.incomeByCategory.length, 2)
    assert.equal(data.incomeByCategory[0].name, "Salary")
    assert.equal(data.incomeByCategory[0].value, 3000)
  })

  it("calculates savings rate correctly", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Salary",
        category: "Salary",
        type: "income",
        amount: 5000,
        status: "completed",
      },
      {
        userId,
        date: `${month}-10`,
        description: "Rent",
        category: "Housing",
        type: "expense",
        amount: 2000,
        status: "completed",
      },
      {
        userId,
        date: `${month}-15`,
        description: "Food",
        category: "Food",
        type: "expense",
        amount: 1000,
        status: "completed",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    const data = await res.json()

    // (5000 - 3000) / 5000 * 100 = 40%
    assert.equal(data.insights.savingsRate, 40)
  })

  it("identifies top spending category", async () => {
    await Transaction.deleteMany({ userId })

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "Rent",
        category: "Housing",
        type: "expense",
        amount: 1500,
        status: "completed",
      },
      {
        userId,
        date: `${month}-10`,
        description: "Food",
        category: "Food",
        type: "expense",
        amount: 300,
        status: "completed",
      },
    ])

    const res = await request("/api/analytics", { accessToken: token })
    const data = await res.json()

    assert.equal(data.insights.topSpendingCategory, "Housing")
    assert.equal(data.insights.topSpendingAmount, 1500)
  })

  it("isolates analytics data between users", async () => {
    await Transaction.deleteMany({})

    const email2 = `analytics-test-2-${process.pid}-${Date.now()}@example.test`
    const user2 = await User.create({
      firstName: "User2",
      lastName: "Test",
      email: email2,
      password: "password123",
      currency: "EUR",
    })

    const token2 = jwt.sign(
      { sub: user2._id.toString(), email: email2 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1d" },
    )

    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    await Transaction.insertMany([
      {
        userId,
        date: `${month}-05`,
        description: "User1 Salary",
        category: "Salary",
        type: "income",
        amount: 3000,
        status: "completed",
      },
      {
        userId: user2._id,
        date: `${month}-05`,
        description: "User2 Salary",
        category: "Salary",
        type: "income",
        amount: 5000,
        status: "completed",
      },
    ])

    const res1 = await request("/api/analytics", { accessToken: token })
    const data1 = await res1.json()

    const res2 = await request("/api/analytics", { accessToken: token2 })
    const data2 = await res2.json()

    const income1 = data1.monthlyBalance[5].income
    const income2 = data2.monthlyBalance[5].income

    assert.equal(income1, 3000)
    assert.equal(income2, 5000)
  })
})
