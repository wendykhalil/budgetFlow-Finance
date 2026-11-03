const assert = require("node:assert/strict")

const { after, before, beforeEach, describe, it } = require("node:test")

const mongoose = require("mongoose")

const jwt = require("jsonwebtoken")

const { createServer } = require("node:http")

const { io: createSocketClient } = require("socket.io-client")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"

process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const app = require("../src/app")

const Category = require("../src/models/Category")

const Budget = require("../src/models/Budget")

const Transaction = require("../src/models/Transaction")

const Notification = require("../src/models/Notification")

const User = require("../src/models/User")

const { attachSocketServer } = require("../src/socket")

const {
  loginRateLimiter,
  registerRateLimiter,
} = require("../src/middlewares/authRateLimiters")

const {
  createNotificationBestEffort,
} = require("../src/services/notificationService")

const databaseName = `budgetflow_backend_test_${process.pid}_${Date.now()}`

const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`

const email = `client-${process.pid}-${Date.now()}@example.test`

let server

let baseUrl

let token

let userId

let transactionId

let otherToken

let socketServer

async function request(
  path,
  { method = "GET", accessToken, body, rawBody, headers = {} } = {},
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

    body:
      rawBody !== undefined
        ? rawBody
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  })
}

function connectSocket(auth = {}) {
  const socket = createSocketClient(baseUrl, {
    auth,

    autoConnect: false,

    reconnection: false,

    timeout: 1000,
  })

  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket))

    socket.once("connect_error", (error) => {
      socket.disconnect()

      reject(error)
    })

    socket.connect()
  })
}

function nextSocketEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}.`)),
      2000,
    )

    socket.once(event, (payload) => {
      clearTimeout(timer)

      resolve(payload)
    })
  })
}

async function socketEventNotReceived(socket, event, duration = 100) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)

      resolve(true)
    }, duration)

    function onEvent() {
      clearTimeout(timer)

      resolve(false)
    }

    socket.once(event, onEvent)
  })
}

async function createBudgetCategory(
  ownerId,
  type = "expense",
  isArchived = false,
) {
  const category = await Category.create({
    userId: ownerId,
    name: `Budget category ${new mongoose.Types.ObjectId()}`,
    type,
    isArchived,
  })

  return category
}

async function createTestBudget(ownerId, categoryId, startDate, limit = 100) {
  return Budget.create({
    userId: ownerId,
    categoryId,
    name: `Notification budget ${new mongoose.Types.ObjectId()}`,
    limit,
    period: "monthly",
    startDate,
  })
}

function transactionInput(category, overrides = {}) {
  return {
    date: "2024-01-15",
    description: "Notification test transaction",
    category: category.name,
    categoryId: category.id,
    type: "expense",
    amount: 10,
    status: "completed",
    ...overrides,
  }
}

function createTestNotification(ownerId, overrides = {}) {
  return Notification.create({
    userId: ownerId,
    type: "transaction_created",
    title: "Test notification",
    message: "A test notification message.",
    ...overrides,
  })
}

async function cleanTestNotifications(notifications) {
  const ids = notifications.filter(Boolean).map(({ _id }) => _id)
  if (ids.length > 0) await Notification.deleteMany({ _id: { $in: ids } })
}

async function cleanNotificationFixtures({
  transactionIds = [],
  budgetIds = [],
  categoryIds = [],
  relatedIds = [],
}) {
  const notificationRelatedIds = [
    ...transactionIds,
    ...budgetIds,
    ...relatedIds,
  ]
  if (notificationRelatedIds.length > 0) {
    await Notification.deleteMany({
      relatedId: { $in: notificationRelatedIds },
    })
  }
  if (transactionIds.length > 0) {
    await Transaction.deleteMany({ _id: { $in: transactionIds } })
  }
  if (budgetIds.length > 0) {
    await Budget.deleteMany({ _id: { $in: budgetIds } })
  }
  if (categoryIds.length > 0) {
    await Category.deleteMany({ _id: { $in: categoryIds } })
  }
}

describe("BudgetFlow API integration", () => {
  before(async () => {
    await mongoose.connect(databaseUri)

    server = createServer(app)

    socketServer = attachSocketServer(server, app)

    server.listen(0, "127.0.0.1")

    await new Promise((resolve) => server.once("listening", resolve))

    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  beforeEach(async () => {
    // Notification triggers persist records while older API tests exercise transactions.
    await Notification.deleteMany({})

    await Promise.all([
      loginRateLimiter.resetKey("127.0.0.1"),
      registerRateLimiter.resetKey("127.0.0.1"),
    ])
  })

  after(async () => {
    if (socketServer) {
      await new Promise((resolve) => socketServer.close(resolve))
    } else if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase()

      await mongoose.disconnect()
    }
  })

  it("returns health and connected readiness", async () => {
    const health = await request("/api/health")

    assert.equal(health.status, 200)

    assert.equal((await health.json()).status, "ok")

    const ready = await request("/api/ready")

    assert.equal(ready.status, 200)

    assert.deepEqual(await ready.json(), {
      status: "ready",
      database: "connected",
    })
  })

  it("registers a client, hashes the password, and rejects invalid registration", async () => {
    const response = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Alex",

        lastName: "Martin",

        email,

        phone: "+33 6 12 34 56 78",

        password: "Client123!",

        country: "France",

        role: "admin",
      },
    })

    assert.equal(response.status, 201)

    const result = await response.json()

    token = result.token

    userId = result.user.id

    assert.equal(result.user.role, "client")

    assert.equal(result.user.email, email)

    assert.equal(result.user.currency, "EUR")

    assert.equal(Object.hasOwn(result.user, "password"), false)

    const storedUser = await User.findById(userId).select("+password")

    assert.notEqual(storedUser.password, "Client123!")

    assert.equal(
      await require("bcryptjs").compare("Client123!", storedUser.password),
      true,
    )

    const invalidRegistrations = [
      { lastName: "Martin", email, password: "Client123!" },

      { firstName: "Alex", email, password: "Client123!" },

      { firstName: "Alex", lastName: "Martin", password: "Client123!" },

      {
        firstName: "Alex",
        lastName: "Martin",
        email: "not-an-email",
        password: "Client123!",
      },

      { firstName: "Alex", lastName: "Martin", email },

      { firstName: "Alex", lastName: "Martin", email, password: "short" },

      {
        firstName: "Alex",
        lastName: "Martin",
        email,
        password: "a".repeat(73),
      },

      {
        firstName: "Alex",
        lastName: "Martin",
        email,
        password: "Client123!",
        currency: "XYZ",
      },
    ]

    for (const body of invalidRegistrations) {
      await registerRateLimiter.resetKey("127.0.0.1")

      const invalid = await request("/api/auth/register", {
        method: "POST",
        body,
      })

      assert.equal(invalid.status, 400)

      if (body.currency === "XYZ") {
        assert.equal((await invalid.json()).code, "UNSUPPORTED_CURRENCY")
      }
    }

    await registerRateLimiter.resetKey("127.0.0.1")

    const duplicate = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Alex",
        lastName: "Martin",
        email,
        password: "Client123!",
      },
    })

    assert.equal(duplicate.status, 409)
  })

  it("logs in and rejects invalid credentials", async () => {
    const success = await request("/api/auth/login", {
      method: "POST",

      body: { email: email.toUpperCase(), password: "Client123!" },
    })

    assert.equal(success.status, 200)

    const result = await success.json()

    token = result.token

    assert.equal(result.user.id, userId)

    assert.equal(Object.hasOwn(result.user, "password"), false)

    const currentUser = await request("/api/auth/me", { accessToken: token })

    assert.equal(currentUser.status, 200)

    assert.equal(
      Object.hasOwn((await currentUser.json()).user, "password"),
      false,
    )

    const failure = await request("/api/auth/login", {
      method: "POST",

      body: { email, password: "wrong-password" },
    })

    assert.equal(failure.status, 401)

    const failureBody = await failure.json()

    assert.equal(failureBody.message, "Invalid email or password.")

    const unknownEmail = await request("/api/auth/login", {
      method: "POST",

      body: {
        email: `unknown-${process.pid}-${Date.now()}@example.test`,
        password: "wrong-password",
      },
    })

    assert.equal(unknownEmail.status, 401)

    assert.deepEqual(await unknownEmail.json(), failureBody)
  })

  it("limits login attempts after five requests and leaves other endpoints available", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request("/api/auth/login", {
        method: "POST",
        body: { email: "unknown@example.test", password: "wrong-password" },
      })

      assert.equal(response.status, 401)
    }

    const limited = await request("/api/auth/login", {
      method: "POST",
      body: { email: "unknown@example.test", password: "wrong-password" },
    })

    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), {
      message: "Too many login attempts. Please try again later.",
    })
    assert.ok(Number(limited.headers.get("retry-after")) > 0)
    assert.ok(limited.headers.get("ratelimit"))
    assert.ok(limited.headers.get("ratelimit-policy"))

    const health = await request("/api/health")
    assert.equal(health.status, 200)

    const register = await request("/api/auth/register", {
      method: "POST",
      body: {},
    })
    assert.equal(register.status, 400)
  })

  it("limits registration independently and resets the limiters between tests", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request("/api/auth/register", {
        method: "POST",
        body: {},
      })

      assert.equal(response.status, 400)
    }

    const limited = await request("/api/auth/register", {
      method: "POST",
      body: {},
    })

    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), {
      message: "Too many registration attempts. Please try again later.",
    })
    assert.ok(Number(limited.headers.get("retry-after")) > 0)

    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "unknown@example.test", password: "wrong-password" },
    })
    assert.equal(login.status, 401)

    for (let attempt = 1; attempt < 5; attempt += 1) {
      const response = await request("/api/auth/login", {
        method: "POST",
        body: { email: "unknown@example.test", password: "wrong-password" },
      })

      assert.equal(response.status, 401)
    }

    const limitedLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "unknown@example.test", password: "wrong-password" },
    })
    assert.equal(limitedLogin.status, 429)

    await Promise.all([
      loginRateLimiter.resetKey("127.0.0.1"),
      registerRateLimiter.resetKey("127.0.0.1"),
    ])

    const resetLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "unknown@example.test", password: "wrong-password" },
    })
    assert.equal(resetLogin.status, 401)

    const resetRegister = await request("/api/auth/register", {
      method: "POST",
      body: {},
    })
    assert.equal(resetRegister.status, 400)
  })

  it("rejects login for pending accounts", async () => {
    const pendingEmail = `pending-${process.pid}-${Date.now()}@example.test`

    await User.create({
      firstName: "Pat",

      lastName: "Pending",

      email: pendingEmail,

      password: "Client123!",

      status: "pending",
    })

    const response = await request("/api/auth/login", {
      method: "POST",

      body: { email: pendingEmail, password: "Client123!" },
    })

    assert.equal(response.status, 401)

    assert.equal((await response.json()).message, "Invalid email or password.")
  })

  it("rejects login for suspended accounts", async () => {
    const suspendedEmail = `suspended-${process.pid}-${Date.now()}@example.test`

    await User.create({
      firstName: "Sam",

      lastName: "Suspended",

      email: suspendedEmail,

      password: "Client123!",

      status: "suspended",
    })

    const response = await request("/api/auth/login", {
      method: "POST",

      body: { email: suspendedEmail, password: "Client123!" },
    })

    assert.equal(response.status, 401)

    assert.equal((await response.json()).message, "Invalid email or password.")
  })

  it("rejects a previously issued token after the account is suspended", async () => {
    const activeEmail = `active-token-${process.pid}-${Date.now()}@example.test`

    const activeUser = await User.create({
      firstName: "Avery",

      lastName: "Active",

      email: activeEmail,

      password: "Client123!",
    })

    const login = await request("/api/auth/login", {
      method: "POST",

      body: { email: activeEmail, password: "Client123!" },
    })

    assert.equal(login.status, 200)

    const activeToken = (await login.json()).token

    await User.findByIdAndUpdate(activeUser.id, { status: "suspended" })

    const currentUser = await request("/api/auth/me", {
      accessToken: activeToken,
    })

    assert.equal(currentUser.status, 401)

    assert.equal(
      (await currentUser.json()).message,
      "Invalid or expired token.",
    )

    const transactions = await request("/api/transactions", {
      accessToken: activeToken,
    })

    assert.equal(transactions.status, 401)

    assert.equal(
      (await transactions.json()).message,
      "Invalid or expired token.",
    )
  })

  it("protects the current-user and transaction routes", async () => {
    const currentUser = await request("/api/auth/me", { accessToken: token })

    assert.equal(currentUser.status, 200)

    assert.equal((await currentUser.json()).user.id, userId)

    for (const path of [
      "/api/auth/me",
      "/api/transactions",
      "/api/categories",
    ]) {
      const noToken = await request(path)

      assert.equal(noToken.status, 401)

      const malformedHeader = await request(path, {
        headers: { authorization: "Bearer" },
      })

      assert.equal(malformedHeader.status, 401)

      const invalidToken = await request(path, { accessToken: "not-a-token" })

      assert.equal(invalidToken.status, 401)
    }

    for (const options of [
      {},

      { headers: { authorization: "Bearer" } },

      { accessToken: "not-a-token" },
    ]) {
      const currencyUpdate = await request("/api/auth/currency", {
        method: "PATCH",

        ...options,
      })

      assert.equal(currencyUpdate.status, 401)
    }
  })

  it("rejects an active-looking token after its user has been deleted", async () => {
    const deletedUser = await User.create({
      firstName: "Delete",

      lastName: "Me",

      email: `deleted-${process.pid}-${Date.now()}@example.test`,

      password: "Client123!",
    })

    const login = await request("/api/auth/login", {
      method: "POST",

      body: { email: deletedUser.email, password: "Client123!" },
    })

    assert.equal(login.status, 200)

    const deletedUserToken = (await login.json()).token

    await User.findByIdAndDelete(deletedUser.id)

    const currentUser = await request("/api/auth/me", {
      accessToken: deletedUserToken,
    })

    assert.equal(currentUser.status, 401)

    const transactions = await request("/api/transactions", {
      accessToken: deletedUserToken,
    })

    assert.equal(transactions.status, 401)
  })

  it("registers selected currency and synchronizes valid account currency changes", async () => {
    const selectedCurrencyRegistration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Currency",

        lastName: "Owner",

        email: `currency-owner-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",

        currency: "TND",
      },
    })

    assert.equal(selectedCurrencyRegistration.status, 201)

    const registered = await selectedCurrencyRegistration.json()

    assert.equal(registered.user.currency, "TND")

    const currencyToken = registered.token

    const socket = await connectSocket({ token: currencyToken })

    const observerRegistration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Currency",

        lastName: "Observer",

        email: `currency-observer-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",
      },
    })

    assert.equal(observerRegistration.status, 201)

    const observerSocket = await connectSocket({
      token: (await observerRegistration.json()).token,
    })

    try {
      const eventPromise = nextSocketEvent(socket, "account:currency-updated")

      const noForeignEvent = socketEventNotReceived(
        observerSocket,

        "account:currency-updated",
      )

      const update = await request("/api/auth/currency", {
        method: "PATCH",

        accessToken: currencyToken,

        body: { currency: "USD", userId: "000000000000000000000001" },
      })

      assert.equal(update.status, 200)

      const updatedProfile = (await update.json()).user

      assert.equal(updatedProfile.id, registered.user.id)

      assert.equal(updatedProfile.currency, "USD")

      assert.deepEqual(await eventPromise, { currency: "USD" })

      assert.equal(await noForeignEvent, true)

      const unsupported = await request("/api/auth/currency", {
        method: "PATCH",

        accessToken: currencyToken,

        body: { currency: "JPY" },
      })

      assert.equal(unsupported.status, 400)

      assert.equal((await unsupported.json()).code, "UNSUPPORTED_CURRENCY")
    } finally {
      socket.disconnect()

      observerSocket.disconnect()
    }
  })

  it("locks currency after transactions and preserves their stored amounts", async () => {
    const registration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Euro",

        lastName: "Account",

        email: `eur-owner-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",

        currency: "EUR",
      },
    })

    assert.equal(registration.status, 201)

    const { token: currencyToken, user: currencyUser } =
      await registration.json()

    const created = await request("/api/transactions", {
      method: "POST",

      accessToken: currencyToken,

      body: {
        date: "2026-10-24",

        description: "Euro transaction",

        category: "Food",

        type: "expense",

        amount: 123.45,
      },
    })

    assert.equal(created.status, 201)

    const amount = (await created.json()).transaction.amount

    assert.equal(amount, 123.45)

    const tooPrecise = await request("/api/transactions", {
      method: "POST",

      accessToken: currencyToken,

      body: {
        date: "2026-10-24",

        description: "Over-precision transaction",

        category: "Food",

        type: "expense",

        amount: 1.234,
      },
    })

    assert.equal(tooPrecise.status, 400)

    const change = await request("/api/auth/currency", {
      method: "PATCH",

      accessToken: currencyToken,

      body: { currency: "TND" },
    })

    assert.equal(change.status, 409)

    assert.equal(
      (await change.json()).code,
      "CURRENCY_CHANGE_REQUIRES_CONVERSION",
    )

    const profile = await request("/api/auth/me", {
      accessToken: currencyToken,
    })

    assert.equal((await profile.json()).user.currency, "EUR")

    const transactions = await request("/api/transactions", {
      accessToken: currencyToken,
    })

    const storedTransaction = (await transactions.json()).transactions[0]

    assert.equal(storedTransaction.amount, amount)

    assert.equal(currencyUser.currency, "EUR")
  })

  it("accepts three-decimal amounts for TND accounts", async () => {
    const registration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Tunisian",

        lastName: "Account",

        email: `tnd-precision-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",

        currency: "TND",
      },
    })

    assert.equal(registration.status, 201)

    const { token: currencyToken } = await registration.json()

    const response = await request("/api/transactions", {
      method: "POST",

      accessToken: currencyToken,

      body: {
        date: "2026-10-24",

        description: "TND amount",

        category: "Food",

        type: "expense",

        amount: 12.345,
      },
    })

    assert.equal(response.status, 201)

    assert.equal((await response.json()).transaction.amount, 12.345)
  })

  it("updates user profile via PATCH /api/auth/profile", async () => {
    // Update profile with valid data
    const updateResponse = await request("/api/auth/profile", {
      method: "PATCH",
      accessToken: token,
      body: {
        firstName: "UpdatedFirst",
        lastName: "UpdatedLast",
        phone: "+1234567890",
        country: "Germany",
      },
    })

    assert.equal(updateResponse.status, 200)

    const updated = await updateResponse.json()
    assert.equal(updated.user.firstName, "UpdatedFirst")
    assert.equal(updated.user.lastName, "UpdatedLast")
    assert.equal(updated.user.phone, "+1234567890")
    assert.equal(updated.user.country, "Germany")
    assert.equal(updated.user.id, userId)
    assert.equal(Object.hasOwn(updated.user, "password"), false)

    // Verify changes persist
    const verifyResponse = await request("/api/auth/me", { accessToken: token })
    assert.equal(verifyResponse.status, 200)
    const verified = await verifyResponse.json()
    assert.equal(verified.user.firstName, "UpdatedFirst")
    assert.equal(verified.user.lastName, "UpdatedLast")
  })

  it("rejects profile update with missing required fields", async () => {
    const missingFirst = await request("/api/auth/profile", {
      method: "PATCH",
      accessToken: token,
      body: {
        firstName: "",
        lastName: "Last",
      },
    })
    assert.equal(missingFirst.status, 400)
    assert.equal(
      (await missingFirst.json()).message,
      "First name and last name are required.",
    )

    const missingLast = await request("/api/auth/profile", {
      method: "PATCH",
      accessToken: token,
      body: {
        firstName: "First",
        lastName: "  ",
      },
    })
    assert.equal(missingLast.status, 400)
  })

  it("requires authentication for profile updates", async () => {
    const noAuth = await request("/api/auth/profile", {
      method: "PATCH",
      body: {
        firstName: "Test",
        lastName: "User",
      },
    })
    assert.equal(noAuth.status, 401)

    const invalidToken = await request("/api/auth/profile", {
      method: "PATCH",
      accessToken: "invalid-token",
      body: {
        firstName: "Test",
        lastName: "User",
      },
    })
    assert.equal(invalidToken.status, 401)
  })

  it("creates, lists, reads, updates, and deletes the signed-in user transaction", async () => {
    const created = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-24",

        description: "Grocery Store",

        category: "Food",

        type: "expense",

        amount: 86.4,

        paymentMethod: "Debit card",

        note: "Weekly groceries",

        userId: "000000000000000000000001",
      },
    })

    assert.equal(created.status, 201)

    const createdResult = await created.json()

    transactionId = createdResult.transaction.id

    assert.equal(createdResult.transaction.userId, userId)

    assert.equal(createdResult.transaction.amount, 86.4)

    assert.equal(createdResult.transaction.date, "2026-10-24")

    assert.equal(createdResult.transaction.status, "completed")

    const list = await request("/api/transactions", { accessToken: token })

    assert.equal(list.status, 200)

    assert.deepEqual(
      (await list.json()).transactions.map((item) => item.id),
      [transactionId],
    )

    const read = await request(`/api/transactions/${transactionId}`, {
      accessToken: token,
    })

    assert.equal(read.status, 200)

    assert.equal((await read.json()).transaction.category, "Food")

    const update = await request(`/api/transactions/${transactionId}`, {
      method: "PATCH",

      accessToken: token,

      body: { amount: 90, note: "Updated note", status: "pending" },
    })

    assert.equal(update.status, 200)

    const updatedTransaction = (await update.json()).transaction

    assert.equal(updatedTransaction.amount, 90)

    assert.equal(updatedTransaction.note, "Updated note")

    assert.equal(updatedTransaction.status, "pending")

    const deleted = await request(`/api/transactions/${transactionId}`, {
      method: "DELETE",

      accessToken: token,
    })

    assert.equal(deleted.status, 200)

    assert.equal((await deleted.json()).message, "Transaction deleted.")

    const missing = await request(`/api/transactions/${transactionId}`, {
      accessToken: token,
    })

    assert.equal(missing.status, 404)
  })

  it("accepts leap-day calendar dates without converting the stored value", async () => {
    const response = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2024-02-29",

        description: "Leap day transaction",

        category: "Food",

        type: "expense",

        amount: 1,
      },
    })

    assert.equal(response.status, 201)

    assert.equal((await response.json()).transaction.date, "2024-02-29")
  })

  it("rejects invalid transaction input and unknown routes", async () => {
    const validInput = {
      date: "2026-10-24",

      description: "Valid transaction",

      category: "Food",

      type: "expense",

      amount: 1,

      status: "completed",
    }

    for (const field of ["date", "description", "category", "type", "amount"]) {
      const missingFieldInput = { ...validInput }

      delete missingFieldInput[field]

      const missingField = await request("/api/transactions", {
        method: "POST",

        accessToken: token,

        body: missingFieldInput,
      })

      assert.equal(missingField.status, 400, `${field} should be required`)
    }

    for (const [field, value] of [
      ["amount", 0],

      ["amount", -1],

      ["type", "transfer"],

      ["date", "2026-02-30"],

      ["date", "2026-02-29"],

      ["date", "1900-02-29"],

      ["date", "2026-04-31"],

      ["date", "2026-13-01"],

      ["status", "cancelled"],

      ["description", "  "],

      ["category", "  "],
    ]) {
      const invalidInput = await request("/api/transactions", {
        method: "POST",

        accessToken: token,

        body: { ...validInput, [field]: value },
      })

      assert.equal(
        invalidInput.status,
        400,
        `${field}=${value} should be rejected`,
      )
    }

    const invalidUpdate = await request(
      "/api/transactions/000000000000000000000001",
      {
        method: "PATCH",

        accessToken: token,

        body: { amount: "10" },
      },
    )

    assert.equal(invalidUpdate.status, 400)

    const invalidStatusUpdate = await request(
      "/api/transactions/000000000000000000000001",
      {
        method: "PATCH",

        accessToken: token,

        body: { status: "cancelled" },
      },
    )

    assert.equal(invalidStatusUpdate.status, 400)

    const unknown = await request("/api/not-a-route")

    assert.equal(unknown.status, 404)

    assert.equal((await unknown.json()).message, "Route not found.")

    const invalidJson = await request("/api/health", {
      method: "POST",

      headers: { "content-type": "application/json" },

      rawBody: "{",
    })

    assert.equal(invalidJson.status, 400)

    assert.equal((await invalidJson.json()).message, "Invalid request JSON.")
  })

  it("prevents a different user from reading, changing, or deleting a transaction", async () => {
    const ownerTransaction = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-25",

        description: "Owner transaction",

        category: "Food",

        type: "expense",

        amount: 20,
      },
    })

    const ownerTransactionId = (await ownerTransaction.json()).transaction.id

    const secondUser = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Taylor",

        lastName: "Other",

        email: `other-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",
      },
    })

    assert.equal(secondUser.status, 201)

    otherToken = (await secondUser.json()).token

    const otherList = await request("/api/transactions", {
      accessToken: otherToken,
    })

    assert.equal((await otherList.json()).transactions.length, 0)

    const otherRead = await request(`/api/transactions/${ownerTransactionId}`, {
      accessToken: otherToken,
    })

    assert.equal(otherRead.status, 404)

    const otherUpdate = await request(
      `/api/transactions/${ownerTransactionId}`,
      {
        method: "PATCH",

        accessToken: otherToken,

        body: { amount: 999 },
      },
    )

    assert.equal(otherUpdate.status, 404)

    const otherDelete = await request(
      `/api/transactions/${ownerTransactionId}`,
      {
        method: "DELETE",

        accessToken: otherToken,
      },
    )

    assert.equal(otherDelete.status, 404)

    const ownerRead = await request(`/api/transactions/${ownerTransactionId}`, {
      accessToken: token,
    })

    assert.equal(ownerRead.status, 200)

    assert.equal((await ownerRead.json()).transaction.amount, 20)
  })

  it("emits category-created only to sockets authenticated for the category owner", async () => {
    const ownerRegistration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Category",

        lastName: "Owner",

        email: `category-owner-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",
      },
    })

    const ownerToken = (await ownerRegistration.json()).token

    const ownerSocket = await connectSocket({ token: ownerToken })

    const ownerSecondSession = await connectSocket({ token: ownerToken })

    const otherRegistration = await request("/api/auth/register", {
      method: "POST",

      body: {
        firstName: "Category",

        lastName: "Observer",

        email: `category-observer-${process.pid}-${Date.now()}@example.test`,

        password: "Client123!",
      },
    })

    const otherSocket = await connectSocket({
      token: (await otherRegistration.json()).token,
    })

    try {
      const ownerEvent = nextSocketEvent(ownerSecondSession, "category:created")

      const otherEvent = socketEventNotReceived(otherSocket, "category:created")

      const response = await request("/api/categories", {
        method: "POST",

        accessToken: ownerToken,

        body: { name: "Inline category", type: "expense", color: "#155C4F" },
      })

      assert.equal(response.status, 201)

      const createdCategory = (await response.json()).category

      const event = await ownerEvent

      assert.equal(event.category.id, createdCategory.id)

      assert.equal(event.category.type, "expense")

      assert.equal(Object.hasOwn(event.category, "userId"), false)

      assert.equal(await otherEvent, true)
    } finally {
      ownerSocket.disconnect()

      ownerSecondSession.disconnect()

      otherSocket.disconnect()
    }
  })

  it("creates, lists, updates, isolates, and deletes personal categories", async () => {
    for (const [path, method, body] of [
      ["/api/categories", "GET"],

      ["/api/categories", "POST", { name: "No auth", type: "expense" }],

      [
        "/api/categories/000000000000000000000001",
        "PATCH",
        { name: "No auth" },
      ],

      ["/api/categories/000000000000000000000001", "DELETE"],
    ]) {
      const response = await request(path, { method, body })

      assert.equal(
        response.status,
        401,
        `${method} ${path} requires authentication`,
      )
    }

    const created = await request("/api/categories", {
      method: "POST",

      accessToken: token,

      body: {
        name: "  Travel  ",

        type: "expense",

        color: "#12aBcD",

        icon: "plane",

        userId: "000000000000000000000001",
      },
    })

    assert.equal(created.status, 201)

    const category = (await created.json()).category

    assert.equal(category.name, "Travel")

    assert.equal(category.userId, userId)

    assert.equal(category.type, "expense")

    assert.equal(category.isArchived, false)

    assert.equal(Object.hasOwn(category, "normalizedName"), false)

    const ownerList = await request("/api/categories", { accessToken: token })

    assert.equal(ownerList.status, 200)

    assert.ok(
      (await ownerList.json()).categories.some(
        (item) => item.id === category.id,
      ),
    )

    const otherList = await request("/api/categories", {
      accessToken: otherToken,
    })

    assert.equal(otherList.status, 200)

    assert.deepEqual((await otherList.json()).categories, [])

    const otherUpdate = await request(`/api/categories/${category.id}`, {
      method: "PATCH",

      accessToken: otherToken,

      body: { name: "Hijacked" },
    })

    assert.equal(otherUpdate.status, 404)

    const otherDelete = await request(`/api/categories/${category.id}`, {
      method: "DELETE",

      accessToken: otherToken,
    })

    assert.equal(otherDelete.status, 404)

    const duplicate = await request("/api/categories", {
      method: "POST",

      accessToken: token,

      body: { name: " travel ", type: "expense" },
    })

    assert.equal(duplicate.status, 409)

    for (const invalidBody of [
      { name: "Invalid type", type: "transfer" },

      { name: "Invalid color", type: "expense", color: "green" },

      { name: "Invalid icon", type: "expense", icon: "../icon" },

      { name: "   ", type: "expense" },

      { name: "Invalid archived", type: "expense", isArchived: "true" },
    ]) {
      const invalid = await request("/api/categories", {
        method: "POST",

        accessToken: token,

        body: invalidBody,
      })

      assert.equal(invalid.status, 400, JSON.stringify(invalidBody))
    }

    const updated = await request(`/api/categories/${category.id}`, {
      method: "PATCH",

      accessToken: token,

      body: {
        name: "Commuting",

        type: "expense",

        color: "#abc",

        icon: "train",

        userId: otherToken,
      },
    })

    assert.equal(updated.status, 200)

    const updatedCategory = (await updated.json()).category

    assert.equal(updatedCategory.name, "Commuting")

    assert.equal(updatedCategory.userId, userId)

    assert.equal(updatedCategory.color, "#abc")

    assert.equal(updatedCategory.icon, "train")

    const removed = await request(`/api/categories/${category.id}`, {
      method: "DELETE",

      accessToken: token,
    })

    assert.equal(removed.status, 200)

    assert.equal((await removed.json()).action, "deleted")

    const missing = await request(`/api/categories/${category.id}`, {
      method: "PATCH",

      accessToken: token,

      body: { name: "Missing" },
    })

    assert.equal(missing.status, 404)
  })

  it("validates category references and preserves legacy transaction categories", async () => {
    const categoryResponse = await request("/api/categories", {
      method: "POST",

      accessToken: token,

      body: { name: "Owner commute", type: "expense" },
    })

    const category = (await categoryResponse.json()).category

    const foreignCategoryResponse = await request("/api/categories", {
      method: "POST",

      accessToken: otherToken,

      body: { name: "Foreign commute", type: "expense" },
    })

    const foreignCategory = (await foreignCategoryResponse.json()).category

    const validTransaction = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-28",

        description: "Category-linked trip",

        category: "Conflicting client name",

        categoryId: category.id,

        type: "expense",

        amount: 25,
      },
    })

    assert.equal(validTransaction.status, 201)

    const linkedTransaction = (await validTransaction.json()).transaction

    assert.equal(linkedTransaction.category, "Owner commute")

    assert.equal(linkedTransaction.categoryId, category.id)

    const legacyTransaction = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-27",

        description: "Legacy category transaction",

        category: "Legacy free-text",

        type: "expense",

        amount: 8,
      },
    })

    assert.equal(legacyTransaction.status, 201)

    const legacy = (await legacyTransaction.json()).transaction

    assert.equal(legacy.category, "Legacy free-text")

    assert.equal(Object.hasOwn(legacy, "categoryId"), false)

    const invalidCategoryReferences = [
      { categoryId: "not-an-object-id", type: "expense", status: 400 },

      { categoryId: "000000000000000000000099", type: "expense", status: 404 },

      { categoryId: foreignCategory.id, type: "expense", status: 404 },

      { categoryId: category.id, type: "income", status: 400 },
    ]

    for (const { categoryId, type, status } of invalidCategoryReferences) {
      const invalid = await request("/api/transactions", {
        method: "POST",

        accessToken: token,

        body: {
          date: "2026-10-26",

          description: "Invalid category reference",

          category: "Client supplied",

          categoryId,

          type,

          amount: 12,
        },
      })

      assert.equal(invalid.status, status)
    }

    const renameOtherTransaction = await request("/api/transactions", {
      method: "POST",

      accessToken: otherToken,

      body: {
        date: "2026-10-25",

        description: "Foreign legacy record",

        category: "Owner commute",

        type: "expense",

        amount: 11,
      },
    })

    assert.equal(renameOtherTransaction.status, 201)

    const foreignLegacy = (await renameOtherTransaction.json()).transaction

    const renamed = await request(`/api/categories/${category.id}`, {
      method: "PATCH",

      accessToken: token,

      body: { name: "Transit" },
    })

    assert.equal(renamed.status, 200)

    const ownerLinkedAfterRename = await Transaction.findOne({
      _id: linkedTransaction.id,

      userId,
    })

    assert.equal(ownerLinkedAfterRename.category, "Transit")

    const foreignAfterRename = await Transaction.findById(foreignLegacy.id)

    assert.equal(foreignAfterRename.category, "Owner commute")

    const archivedCategoryResponse = await request("/api/categories", {
      method: "POST",

      accessToken: token,

      body: { name: "Archive me", type: "expense" },
    })

    const archivedCategory = (await archivedCategoryResponse.json()).category

    const reference = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-24",

        description: "Archived category reference",

        category: "Old name",

        categoryId: archivedCategory.id,

        type: "expense",

        amount: 5,
      },
    })

    assert.equal(reference.status, 201)

    const archiveResponse = await request(
      `/api/categories/${archivedCategory.id}`,
      {
        method: "DELETE",

        accessToken: token,
      },
    )

    assert.equal(archiveResponse.status, 200)

    assert.equal((await archiveResponse.json()).action, "archived")

    const defaultList = await request("/api/categories", { accessToken: token })

    assert.ok(
      !(await defaultList.json()).categories.some(
        (item) => item.id === archivedCategory.id,
      ),
    )

    const archivedList = await request("/api/categories?includeArchived=true", {
      accessToken: token,
    })

    assert.ok(
      (await archivedList.json()).categories.some(
        (item) => item.id === archivedCategory.id && item.isArchived,
      ),
    )

    const archivedAssignment = await request("/api/transactions", {
      method: "POST",

      accessToken: token,

      body: {
        date: "2026-10-23",

        description: "Archived assignment attempt",

        category: "Archive me",

        categoryId: archivedCategory.id,

        type: "expense",

        amount: 5,
      },
    })

    assert.equal(archivedAssignment.status, 400)

    const archivedTransaction = await Transaction.findById(
      (await reference.json()).transaction.id,
    )

    assert.equal(archivedTransaction.category, "Archive me")

    assert.equal(archivedTransaction.categoryId.toString(), archivedCategory.id)

    const legacyUsedCategoryResponse = await request("/api/categories", {
      method: "POST",

      accessToken: token,

      body: { name: "Legacy food", type: "expense" },
    })

    const legacyUsedCategory = (await legacyUsedCategoryResponse.json())
      .category

    await Transaction.create({
      date: "2026-10-22",

      description: "Case-insensitive legacy category reference",

      category: "LEGACY FOOD",

      type: "expense",

      amount: 4,

      userId,
    })

    const legacyArchive = await request(
      `/api/categories/${legacyUsedCategory.id}`,
      {
        method: "DELETE",

        accessToken: token,
      },
    )

    assert.equal(legacyArchive.status, 200)

    assert.equal((await legacyArchive.json()).action, "archived")
  })

  it("preserves category type consistency and supports unlinked transactions", async () => {
    const expenseCategory = await createBudgetCategory(userId, "expense")
    const incomeCategory = await createBudgetCategory(userId, "income")
    const transactionIds = []

    try {
      for (const [category, type] of [
        [expenseCategory, "income"],
        [incomeCategory, "expense"],
      ]) {
        const mismatch = await request("/api/transactions", {
          method: "POST",
          accessToken: token,
          body: transactionInput(category, { type }),
        })
        assert.equal(mismatch.status, 400)
      }

      const expenseResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(expenseCategory),
      })
      assert.equal(expenseResponse.status, 201)
      const expenseTransaction = (await expenseResponse.json()).transaction
      transactionIds.push(new mongoose.Types.ObjectId(expenseTransaction.id))

      const mismatchedIncomeUpdate = await request(
        `/api/transactions/${expenseTransaction.id}`,
        {
          method: "PATCH",
          accessToken: token,
          body: { type: "income" },
        },
      )
      assert.equal(mismatchedIncomeUpdate.status, 400)

      const incomeUpdate = await request(
        `/api/transactions/${expenseTransaction.id}`,
        {
          method: "PATCH",
          accessToken: token,
          body: { type: "income", categoryId: incomeCategory.id },
        },
      )
      assert.equal(incomeUpdate.status, 200)
      const incomeTransaction = (await incomeUpdate.json()).transaction
      assert.equal(incomeTransaction.type, "income")
      assert.equal(incomeTransaction.categoryId, incomeCategory.id)
      assert.equal(incomeTransaction.category, incomeCategory.name)

      const mismatchedExpenseUpdate = await request(
        `/api/transactions/${expenseTransaction.id}`,
        {
          method: "PATCH",
          accessToken: token,
          body: { type: "expense" },
        },
      )
      assert.equal(mismatchedExpenseUpdate.status, 400)

      const removeCategory = await request(
        `/api/transactions/${expenseTransaction.id}`,
        {
          method: "PATCH",
          accessToken: token,
          body: { categoryId: null, type: "expense" },
        },
      )
      assert.equal(removeCategory.status, 200)
      const unlinkedTransaction = (await removeCategory.json()).transaction
      assert.equal(unlinkedTransaction.type, "expense")
      assert.equal(Object.hasOwn(unlinkedTransaction, "categoryId"), false)
      assert.equal(unlinkedTransaction.category, incomeCategory.name)

      const legacyResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: {
          date: "2026-10-28",
          description: "Unlinked category transaction",
          category: "Legacy free-text",
          type: "expense",
          amount: 8,
        },
      })
      assert.equal(legacyResponse.status, 201)
      const legacyTransaction = (await legacyResponse.json()).transaction
      transactionIds.push(new mongoose.Types.ObjectId(legacyTransaction.id))
      assert.equal(Object.hasOwn(legacyTransaction, "categoryId"), false)

      const legacyUpdate = await request(
        `/api/transactions/${legacyTransaction.id}`,
        {
          method: "PATCH",
          accessToken: token,
          body: { description: "Updated unlinked transaction" },
        },
      )
      assert.equal(legacyUpdate.status, 200)
      const updatedLegacyTransaction = (await legacyUpdate.json()).transaction
      assert.equal(
        updatedLegacyTransaction.description,
        "Updated unlinked transaction",
      )
      assert.equal(Object.hasOwn(updatedLegacyTransaction, "categoryId"), false)
    } finally {
      await cleanNotificationFixtures({
        transactionIds,
        categoryIds: [expenseCategory._id, incomeCategory._id],
      })
    }
  })

  it("authenticates sockets and emits transaction events only to the owner", async () => {
    await assert.rejects(
      connectSocket(),
      (error) => error.data?.code === "AUTH_REQUIRED",
    )

    await assert.rejects(
      connectSocket({ token: "not-a-token" }),

      (error) => error.data?.code === "AUTH_REQUIRED",
    )

    const inactiveUser = await User.create({
      firstName: "Inactive",

      lastName: "Client",

      email: `inactive-socket-${process.pid}-${Date.now()}@example.test`,

      password: "Client123!",

      status: "suspended",
    })

    const inactiveToken = jwt.sign(
      { sub: inactiveUser.id },

      process.env.JWT_SECRET,

      { algorithm: "HS256", expiresIn: "1h" },
    )

    await assert.rejects(
      connectSocket({ token: inactiveToken }),

      (error) => error.data?.code === "AUTH_REQUIRED",
    )

    const deletedUser = await User.create({
      firstName: "Deleted",

      lastName: "Client",

      email: `deleted-socket-${process.pid}-${Date.now()}@example.test`,

      password: "Client123!",
    })

    const deletedToken = jwt.sign(
      { sub: deletedUser.id },

      process.env.JWT_SECRET,

      { algorithm: "HS256", expiresIn: "1h" },
    )

    await User.findByIdAndDelete(deletedUser.id)

    await assert.rejects(
      connectSocket({ token: deletedToken }),

      (error) => error.data?.code === "AUTH_REQUIRED",
    )

    const expiredToken = jwt.sign(
      { sub: userId },

      process.env.JWT_SECRET,

      { algorithm: "HS256", expiresIn: -1 },
    )

    await assert.rejects(
      connectSocket({ token: expiredToken }),

      (error) => error.data?.code === "AUTH_REQUIRED",
    )

    const ownerSocket = await connectSocket({ token })

    const otherSocket = await connectSocket({ token: otherToken })

    try {
      const createdEvent = nextSocketEvent(ownerSocket, "transaction:created")

      const otherCreateEvent = socketEventNotReceived(
        otherSocket,
        "transaction:created",
      )

      const created = await request("/api/transactions", {
        method: "POST",

        accessToken: token,

        body: {
          date: "2026-10-28",

          description: "Socket groceries",

          category: "Food",

          type: "expense",

          amount: 25,
        },
      })

      assert.equal(created.status, 201)

      const createdTransaction = (await created.json()).transaction

      const createdId = createdTransaction.id

      assert.equal(createdTransaction.date, "2026-10-28")

      assert.equal(createdTransaction.status, "completed")

      const createdSocketTransaction = (await createdEvent).transaction

      assert.equal(createdSocketTransaction.id, createdId)

      assert.equal(createdSocketTransaction.date, "2026-10-28")

      assert.equal(createdSocketTransaction.status, "completed")

      assert.equal(await otherCreateEvent, true)

      const updatedEvent = nextSocketEvent(ownerSocket, "transaction:updated")

      const otherUpdateEvent = socketEventNotReceived(
        otherSocket,
        "transaction:updated",
      )

      const updated = await request(`/api/transactions/${createdId}`, {
        method: "PATCH",

        accessToken: token,

        body: { amount: 40, status: "pending", date: "2024-02-29" },
      })

      assert.equal(updated.status, 200)

      const updatedSocketTransaction = (await updatedEvent).transaction

      assert.equal(updatedSocketTransaction.amount, 40)

      assert.equal(updatedSocketTransaction.status, "pending")

      assert.equal(updatedSocketTransaction.date, "2024-02-29")

      assert.equal((await updated.json()).transaction.status, "pending")

      assert.equal(await otherUpdateEvent, true)

      const originalUpdate = Transaction.findOneAndUpdate

      Transaction.findOneAndUpdate = async () => {
        throw new Error("Simulated database operation failure.")
      }

      try {
        const failedEvent = socketEventNotReceived(
          ownerSocket,
          "transaction:updated",
        )

        const failedUpdate = await request(`/api/transactions/${createdId}`, {
          method: "PATCH",

          accessToken: token,

          body: { amount: 50 },
        })

        assert.equal(failedUpdate.status, 500)

        assert.equal(await failedEvent, true)
      } finally {
        Transaction.findOneAndUpdate = originalUpdate
      }

      const deletedEvent = nextSocketEvent(ownerSocket, "transaction:deleted")

      const otherDeleteEvent = socketEventNotReceived(
        otherSocket,
        "transaction:deleted",
      )

      const deleted = await request(`/api/transactions/${createdId}`, {
        method: "DELETE",

        accessToken: token,
      })

      assert.equal(deleted.status, 200)

      assert.deepEqual(await deletedEvent, { id: createdId })

      assert.equal(await otherDeleteEvent, true)
    } finally {
      ownerSocket.disconnect()

      otherSocket.disconnect()
    }
  })

  it("creates, isolates, reads, updates, and deletes monthly budgets", async () => {
    const category = await createBudgetCategory(userId)
    const otherUserId = jwt.decode(otherToken).sub
    const otherCategory = await createBudgetCategory(otherUserId)
    const otherBudget = await Budget.create({
      userId: otherUserId,
      categoryId: otherCategory.id,
      name: "Other user's budget",
      limit: 50,
      period: "monthly",
      startDate: "2024-02-01",
    })

    const create = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Monthly groceries",
        limit: 100,
        categoryId: category.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })

    assert.equal(create.status, 201)
    const created = (await create.json()).budget
    assert.equal(created.name, "Monthly groceries")
    assert.equal(created.period, "monthly")
    assert.equal(created.categoryId.id, category.id)
    assert.equal(created.startDate, "2024-02-01")

    const invalidCategoryUpdate = await request(`/api/budgets/${created.id}`, {
      method: "PATCH",
      accessToken: token,
      body: { categoryId: "not-an-id" },
    })
    assert.equal(invalidCategoryUpdate.status, 400)

    const ownerList = await request("/api/budgets", { accessToken: token })
    assert.equal(ownerList.status, 200)
    assert.deepEqual(
      (await ownerList.json()).budgets.map((budget) => budget.id),
      [created.id],
    )

    const otherList = await request("/api/budgets", {
      accessToken: otherToken,
    })
    assert.deepEqual(
      (await otherList.json()).budgets.map((budget) => budget.id),
      [otherBudget.id],
    )

    const read = await request(`/api/budgets/${created.id}`, {
      accessToken: token,
    })
    assert.equal(read.status, 200)
    assert.equal((await read.json()).budget.id, created.id)

    const foreignRead = await request(`/api/budgets/${created.id}`, {
      accessToken: otherToken,
    })
    assert.equal(foreignRead.status, 404)

    const foreignUpdate = await request(`/api/budgets/${created.id}`, {
      method: "PATCH",
      accessToken: otherToken,
      body: { name: "Changed by another user" },
    })
    assert.equal(foreignUpdate.status, 404)

    const foreignDelete = await request(`/api/budgets/${created.id}`, {
      method: "DELETE",
      accessToken: otherToken,
    })
    assert.equal(foreignDelete.status, 404)

    const duplicate = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Duplicate month",
        limit: 200,
        categoryId: category.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(duplicate.status, 409)

    const update = await request(`/api/budgets/${created.id}`, {
      method: "PATCH",
      accessToken: token,
      body: {
        name: "Updated groceries",
        limit: 125,
        startDate: "2024-03-01",
      },
    })
    assert.equal(update.status, 200)
    const updated = (await update.json()).budget
    assert.equal(updated.name, "Updated groceries")
    assert.equal(updated.limit, 125)
    assert.equal(updated.startDate, "2024-03-01")

    await Category.updateOne({ _id: category.id }, { isArchived: true })
    const archivedCategoryRead = await request(`/api/budgets/${created.id}`, {
      accessToken: token,
    })
    assert.equal(
      (await archivedCategoryRead.json()).budget.categoryId.isArchived,
      true,
    )

    const deleted = await request(`/api/budgets/${created.id}`, {
      method: "DELETE",
      accessToken: token,
    })
    assert.equal(deleted.status, 200)
    assert.equal(
      (await request(`/api/budgets/${created.id}`, { accessToken: token }))
        .status,
      404,
    )
  })

  it("rejects invalid, archived, income, and foreign budget categories", async () => {
    const activeExpense = await createBudgetCategory(userId)
    const archivedExpense = await createBudgetCategory(userId, "expense", true)
    const incomeCategory = await createBudgetCategory(userId, "income")
    const foreignCategory = await createBudgetCategory(
      jwt.decode(otherToken).sub,
    )
    const invalidCategoryIds = [
      ["not-an-id", 400],
      ["000000000000000000000099", 404],
      [foreignCategory.id, 404],
      [archivedExpense.id, 409],
      [incomeCategory.id, 400],
    ]

    for (const [categoryId, expectedStatus] of invalidCategoryIds) {
      const response = await request("/api/budgets", {
        method: "POST",
        accessToken: token,
        body: {
          name: "Invalid category budget",
          limit: 100,
          categoryId,
          period: "monthly",
          startDate: "2024-02-01",
        },
      })
      assert.equal(response.status, expectedStatus, categoryId)
    }

    const nonMonthly = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Not monthly",
        limit: 100,
        categoryId: activeExpense.id,
        period: "yearly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(nonMonthly.status, 400)
  })

  it("counts completed expenses in the exact calendar month and applies thresholds", async () => {
    const category = await createBudgetCategory(userId)
    const create = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Leap month budget",
        limit: 100,
        categoryId: category.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(create.status, 201)
    const budget = (await create.json()).budget

    await Transaction.create([
      {
        date: "2024-02-29",
        description: "Completed expense",
        category: category.name,
        categoryId: category.id,
        type: "expense",
        amount: 85,
        status: "completed",
        userId,
      },
      {
        date: "2024-02-28",
        description: "Pending expense",
        category: category.name,
        categoryId: category.id,
        type: "expense",
        amount: 30,
        status: "pending",
        userId,
      },
      {
        date: "2024-02-27",
        description: "Income",
        category: category.name,
        categoryId: category.id,
        type: "income",
        amount: 50,
        status: "completed",
        userId,
      },
    ])

    const warning = await request(`/api/budgets/${budget.id}/spent`, {
      accessToken: token,
    })
    assert.equal(warning.status, 200)
    const warningResult = await warning.json()
    assert.equal(warningResult.spent, 85)
    assert.equal(warningResult.limit, 100)
    assert.equal(warningResult.remaining, 15)
    assert.equal(warningResult.percentUsed, 85)
    assert.equal(warningResult.status, "warning")
    assert.equal(warningResult.periodStart, "2024-02-01")
    assert.equal(warningResult.periodEnd, "2024-02-29")

    await Transaction.create({
      date: "2024-02-29",
      description: "Budget boundary expense",
      category: category.name,
      categoryId: category.id,
      type: "expense",
      amount: 15,
      status: "completed",
      userId,
    })

    const exceeded = await request(`/api/budgets/${budget.id}/spent`, {
      accessToken: token,
    })
    const exceededResult = await exceeded.json()
    assert.equal(exceededResult.spent, 100)
    assert.equal(exceededResult.percentUsed, 100)
    assert.equal(exceededResult.remaining, 0)
    assert.equal(exceededResult.status, "exceeded")

    await Transaction.create({
      date: "2024-02-29",
      description: "Over-budget expense",
      category: category.name,
      categoryId: category.id,
      type: "expense",
      amount: 5,
      status: "completed",
      userId,
    })

    const overBudget = await request(`/api/budgets/${budget.id}/spent`, {
      accessToken: token,
    })
    assert.equal((await overBudget.json()).remaining, 0)
  })

  it("keeps percentage and status consistent at budget threshold boundaries", async () => {
    const cases = [
      { spent: 84.99, expectedPercent: 84.99, expectedStatus: "healthy" },
      { spent: 85, expectedPercent: 85, expectedStatus: "warning" },
      { spent: 99.99, expectedPercent: 99.99, expectedStatus: "warning" },
      { spent: 100, expectedPercent: 100, expectedStatus: "exceeded" },
      { spent: 105, expectedPercent: 105, expectedStatus: "exceeded" },
    ]

    for (const { spent, expectedPercent, expectedStatus } of cases) {
      const category = await createBudgetCategory(userId)
      const create = await request("/api/budgets", {
        method: "POST",
        accessToken: token,
        body: {
          name: "Boundary budget",
          limit: 100,
          categoryId: category.id,
          period: "monthly",
          startDate: "2024-03-01",
        },
      })
      assert.equal(create.status, 201)
      const budget = (await create.json()).budget

      await Transaction.create({
        date: "2024-03-15",
        description: `Boundary expense ${spent}`,
        category: category.name,
        categoryId: category.id,
        type: "expense",
        amount: spent,
        status: "completed",
        userId,
      })

      const response = await request(`/api/budgets/${budget.id}/spent`, {
        accessToken: token,
      })
      assert.equal(response.status, 200)
      const result = await response.json()
      assert.equal(result.spent, spent)
      assert.equal(result.percentUsed, expectedPercent)
      assert.equal(result.status, expectedStatus)
      assert.equal(result.remaining, Math.max(0, 100 - spent))
    }
  })

  it("enforces the authenticated account's currency precision for budget limits", async () => {
    const eurCategory = await createBudgetCategory(userId)
    const invalidEurLimit = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Too precise EUR",
        limit: 10.001,
        categoryId: eurCategory.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(invalidEurLimit.status, 400)

    const validEurLimit = await request("/api/budgets", {
      method: "POST",
      accessToken: token,
      body: {
        name: "Valid EUR precision",
        limit: 10.01,
        categoryId: eurCategory.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(validEurLimit.status, 201)
    const eurBudgetId = (await validEurLimit.json()).budget.id

    const invalidEurUpdate = await request(`/api/budgets/${eurBudgetId}`, {
      method: "PATCH",
      accessToken: token,
      body: { limit: 11.001 },
    })
    assert.equal(invalidEurUpdate.status, 400)

    const registration = await request("/api/auth/register", {
      method: "POST",
      body: {
        firstName: "Tunisian",
        lastName: "Budget Owner",
        email: `budget-tnd-${process.pid}-${Date.now()}@example.test`,
        password: "Client123!",
        currency: "TND",
      },
    })
    assert.equal(registration.status, 201)
    const { token: tndToken, user: tndUser } = await registration.json()
    const tndCategory = await createBudgetCategory(tndUser.id)

    const validTndLimit = await request("/api/budgets", {
      method: "POST",
      accessToken: tndToken,
      body: {
        name: "Three decimal TND",
        limit: 10.001,
        categoryId: tndCategory.id,
        period: "monthly",
        startDate: "2024-02-01",
      },
    })
    assert.equal(validTndLimit.status, 201)
    const tndBudgetId = (await validTndLimit.json()).budget.id

    const invalidTndUpdate = await request(`/api/budgets/${tndBudgetId}`, {
      method: "PATCH",
      accessToken: tndToken,
      body: { limit: 10.0001 },
    })
    assert.equal(invalidTndUpdate.status, 400)
  })

  it("emits budget events only to the authenticated owner's room", async () => {
    const category = await createBudgetCategory(userId)
    const ownerSocket = await connectSocket({ token })
    const observerSocket = await connectSocket({ token: otherToken })

    try {
      const createdEvent = nextSocketEvent(ownerSocket, "budget:created")
      const foreignCreateEvent = socketEventNotReceived(
        observerSocket,
        "budget:created",
      )
      const createdResponse = await request("/api/budgets", {
        method: "POST",
        accessToken: token,
        body: {
          name: "Socket budget",
          limit: 100,
          categoryId: category.id,
          period: "monthly",
          startDate: "2024-05-01",
        },
      })
      assert.equal(createdResponse.status, 201)
      const created = (await createdResponse.json()).budget
      assert.equal((await createdEvent).budget.id, created.id)
      assert.equal(await foreignCreateEvent, true)

      const updatedEvent = nextSocketEvent(ownerSocket, "budget:updated")
      const foreignUpdateEvent = socketEventNotReceived(
        observerSocket,
        "budget:updated",
      )
      const updatedResponse = await request(`/api/budgets/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { limit: 150 },
      })
      assert.equal(updatedResponse.status, 200)
      assert.equal((await updatedEvent).budget.limit, 150)
      assert.equal(await foreignUpdateEvent, true)

      const deletedEvent = nextSocketEvent(ownerSocket, "budget:deleted")
      const foreignDeleteEvent = socketEventNotReceived(
        observerSocket,
        "budget:deleted",
      )
      const deletedResponse = await request(`/api/budgets/${created.id}`, {
        method: "DELETE",
        accessToken: token,
      })
      assert.equal(deletedResponse.status, 200)
      assert.deepEqual(await deletedEvent, { budgetId: created.id })
      assert.equal(await foreignDeleteEvent, true)
    } finally {
      ownerSocket.disconnect()
      observerSocket.disconnect()
    }
  })

  it("keeps budget REST writes successful when Socket.IO emission fails", async () => {
    const category = await createBudgetCategory(userId)
    const originalIo = app.get("io")
    const originalConsoleError = console.error
    let budgetId

    try {
      app.set("io", {
        to() {
          return {
            emit() {
              throw new Error("Simulated Socket.IO emission failure.")
            },
          }
        },
      })
      console.error = () => {}

      const createResponse = await request("/api/budgets", {
        method: "POST",
        accessToken: token,
        body: {
          name: "Budget despite socket failure",
          limit: 100,
          categoryId: category.id,
          period: "monthly",
          startDate: "2024-06-01",
        },
      })
      assert.equal(createResponse.status, 201)
      budgetId = (await createResponse.json()).budget.id
      assert.ok(await Budget.exists({ _id: budgetId, userId }))

      const updateResponse = await request(`/api/budgets/${budgetId}`, {
        method: "PATCH",
        accessToken: token,
        body: { limit: 125 },
      })
      assert.equal(updateResponse.status, 200)
      assert.equal((await Budget.findById(budgetId)).limit, 125)

      const deleteResponse = await request(`/api/budgets/${budgetId}`, {
        method: "DELETE",
        accessToken: token,
      })
      assert.equal(deleteResponse.status, 200)
      assert.equal(await Budget.exists({ _id: budgetId }), null)
    } finally {
      console.error = originalConsoleError
      app.set("io", originalIo)
      if (budgetId) await Budget.deleteOne({ _id: budgetId })
      await Category.deleteOne({ _id: category.id })
    }
  })

  it("validates notification fields, defaults isRead, and defines owner-scoped indexes", async () => {
    const notification = new Notification({
      userId,
      type: "transaction_created",
      title: "Valid title",
      message: "Valid message",
    })

    assert.equal(notification.isRead, false)
    await notification.validate()

    const invalid = new Notification({
      userId,
      type: "unsupported_type",
      title: "Invalid type",
      message: "Invalid notification type.",
    })
    await assert.rejects(invalid.validate(), { name: "ValidationError" })

    const invalidRelatedType = new Notification({
      userId,
      type: "transaction_created",
      title: "Invalid related type",
      message: "Invalid related type.",
      relatedType: "category",
    })
    await assert.rejects(invalidRelatedType.validate(), {
      name: "ValidationError",
    })

    const indexes = Notification.schema.indexes().map(([fields]) => fields)
    assert.ok(
      indexes.some((fields) => fields.userId === 1 && fields.createdAt === -1),
    )
    assert.ok(
      indexes.some((fields) => fields.userId === 1 && fields.isRead === 1),
    )
  })

  it("lists authenticated notifications and excludes other users' records", async () => {
    const ownerNotification = await createTestNotification(userId)
    const foreignNotification = await createTestNotification(
      jwt.decode(otherToken).sub,
      { title: "Foreign notification" },
    )

    try {
      const response = await request("/api/notifications", {
        accessToken: token,
      })

      assert.equal(response.status, 200)
      const result = await response.json()
      assert.deepEqual(
        result.notifications.map(({ id }) => id),
        [ownerNotification.id],
      )
      assert.deepEqual(result.pagination, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
      assert.notEqual(result.notifications[0].id, foreignNotification.id)
    } finally {
      await cleanTestNotifications([ownerNotification, foreignNotification])
    }
  })

  it("requires authentication to list notifications and unread count", async () => {
    const listResponse = await request("/api/notifications")
    const countResponse = await request("/api/notifications/unread-count")

    assert.equal(listResponse.status, 401)
    assert.equal(countResponse.status, 401)
  })

  it("paginates notifications and caps the requested limit", async () => {
    const notifications = await Promise.all([
      createTestNotification(userId, { title: "Pagination one" }),
      createTestNotification(userId, { title: "Pagination two" }),
      createTestNotification(userId, { title: "Pagination three" }),
    ])

    try {
      const firstPageResponse = await request(
        "/api/notifications?page=1&limit=2",
        { accessToken: token },
      )
      const firstPage = await firstPageResponse.json()
      assert.equal(firstPageResponse.status, 200)
      assert.equal(firstPage.notifications.length, 2)
      assert.deepEqual(firstPage.pagination, {
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      })

      const secondPageResponse = await request(
        "/api/notifications?page=2&limit=2",
        { accessToken: token },
      )
      const secondPage = await secondPageResponse.json()
      assert.equal(secondPage.notifications.length, 1)
      assert.equal(secondPage.pagination.page, 2)

      const cappedResponse = await request("/api/notifications?limit=10000", {
        accessToken: token,
      })
      const capped = await cappedResponse.json()
      assert.equal(capped.pagination.limit, 100)
      assert.equal(capped.notifications.length, 3)
    } finally {
      await cleanTestNotifications(notifications)
    }
  })

  it("orders notifications newest first", async () => {
    const older = await createTestNotification(userId, {
      title: "Older notification",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    })
    const newer = await createTestNotification(userId, {
      title: "Newer notification",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
    })

    try {
      const response = await request("/api/notifications", {
        accessToken: token,
      })
      const result = await response.json()

      assert.equal(response.status, 200)
      assert.deepEqual(
        result.notifications.map(({ id }) => id),
        [newer.id, older.id],
      )
    } finally {
      await cleanTestNotifications([older, newer])
    }
  })

  it("returns the authenticated user's unread count only", async () => {
    const unread = await createTestNotification(userId)
    const read = await createTestNotification(userId, {
      title: "Read notification",
      isRead: true,
    })
    const foreign = await createTestNotification(jwt.decode(otherToken).sub)

    try {
      const response = await request("/api/notifications/unread-count", {
        accessToken: token,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { unreadCount: 1 })
    } finally {
      await cleanTestNotifications([unread, read, foreign])
    }
  })

  it("marks an owned notification as read and persists the change", async () => {
    const notification = await createTestNotification(userId)

    try {
      const response = await request(
        `/api/notifications/${notification.id}/read`,
        { method: "PATCH", accessToken: token },
      )
      const result = await response.json()

      assert.equal(response.status, 200)
      assert.equal(result.notification.id, notification.id)
      assert.equal(result.notification.isRead, true)
      assert.equal(
        (await Notification.findById(notification.id).lean()).isRead,
        true,
      )
    } finally {
      await cleanTestNotifications([notification])
    }
  })

  it("marks only the authenticated user's unread notifications as read", async () => {
    const unread = await createTestNotification(userId)
    const alreadyRead = await createTestNotification(userId, {
      title: "Already read",
      isRead: true,
    })
    const foreign = await createTestNotification(jwt.decode(otherToken).sub)

    try {
      const response = await request("/api/notifications/read-all", {
        method: "PATCH",
        accessToken: token,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { modifiedCount: 1 })
      assert.equal((await Notification.findById(unread.id).lean()).isRead, true)
      assert.equal(
        (await Notification.findById(alreadyRead.id).lean()).isRead,
        true,
      )
      assert.equal(
        (await Notification.findById(foreign.id).lean()).isRead,
        false,
      )
    } finally {
      await cleanTestNotifications([unread, alreadyRead, foreign])
    }
  })

  it("deletes an owned notification and confirms the database change", async () => {
    const notification = await createTestNotification(userId)

    const response = await request(`/api/notifications/${notification.id}`, {
      method: "DELETE",
      accessToken: token,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      message: "Notification deleted.",
    })
    assert.equal(await Notification.exists({ _id: notification.id }), null)
  })

  it("does not allow reading another user's notification", async () => {
    const notification = await createTestNotification(
      jwt.decode(otherToken).sub,
    )

    try {
      const response = await request(
        `/api/notifications/${notification.id}/read`,
        { method: "PATCH", accessToken: token },
      )

      assert.equal(response.status, 404)
      assert.equal(
        (await Notification.findById(notification.id).lean()).isRead,
        false,
      )
    } finally {
      await cleanTestNotifications([notification])
    }
  })

  it("does not allow deleting another user's notification", async () => {
    const notification = await createTestNotification(
      jwt.decode(otherToken).sub,
    )

    try {
      const response = await request(`/api/notifications/${notification.id}`, {
        method: "DELETE",
        accessToken: token,
      })

      assert.equal(response.status, 404)
      assert.ok(await Notification.exists({ _id: notification.id }))
    } finally {
      await cleanTestNotifications([notification])
    }
  })

  it("returns not found for invalid notification IDs", async () => {
    const readResponse = await request(
      "/api/notifications/not-an-object-id/read",
      { method: "PATCH", accessToken: token },
    )
    const deleteResponse = await request(
      "/api/notifications/not-an-object-id",
      { method: "DELETE", accessToken: token },
    )

    assert.equal(readResponse.status, 404)
    assert.equal(deleteResponse.status, 404)
  })

  it("persists transaction notifications and emits them only to the owner", async () => {
    const category = await createBudgetCategory(userId)
    const categoryIds = [category._id]
    const transactionIds = []
    const ownerSocket = await connectSocket({ token })
    const otherSocket = await connectSocket({ token: otherToken })

    try {
      const createEvent = nextSocketEvent(ownerSocket, "notification:created")
      const foreignCreateEvent = socketEventNotReceived(
        otherSocket,
        "notification:created",
      )
      const createResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: {
          ...transactionInput(category),
          userId: jwt.decode(otherToken).sub,
        },
      })

      assert.equal(createResponse.status, 201)
      const created = (await createResponse.json()).transaction
      transactionIds.push(new mongoose.Types.ObjectId(created.id))
      const createdEvent = await createEvent
      assert.equal(createdEvent.type, "transaction_created")
      assert.equal(createdEvent.relatedId, created.id)
      assert.equal(createdEvent.relatedType, "transaction")
      assert.equal(createdEvent.userId, userId)
      assert.equal(await foreignCreateEvent, true)

      const updateEvent = nextSocketEvent(ownerSocket, "notification:created")
      const foreignUpdateEvent = socketEventNotReceived(
        otherSocket,
        "notification:created",
      )
      const updateResponse = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { description: "Updated notification transaction" },
      })

      assert.equal(updateResponse.status, 200)
      assert.equal((await updateResponse.json()).transaction.id, created.id)
      const updatedEvent = await updateEvent
      assert.equal(updatedEvent.type, "transaction_updated")
      assert.equal(updatedEvent.relatedId, created.id)
      assert.equal(await foreignUpdateEvent, true)

      const deleteEvent = nextSocketEvent(ownerSocket, "notification:created")
      const foreignDeleteEvent = socketEventNotReceived(
        otherSocket,
        "notification:created",
      )
      const deleteResponse = await request(`/api/transactions/${created.id}`, {
        method: "DELETE",
        accessToken: token,
      })

      assert.equal(deleteResponse.status, 200)
      const deletedEvent = await deleteEvent
      assert.equal(deletedEvent.type, "transaction_deleted")
      assert.equal(deletedEvent.relatedId, created.id)
      assert.equal(await foreignDeleteEvent, true)

      const records = await Notification.find({
        userId,
        relatedId: created.id,
      }).sort({ type: 1 })
      assert.deepEqual(records.map(({ type }) => type).sort(), [
        "transaction_created",
        "transaction_deleted",
        "transaction_updated",
      ])
      assert.ok(
        records.every(({ relatedType }) => relatedType === "transaction"),
      )
      assert.equal(
        await Notification.countDocuments({
          userId: jwt.decode(otherToken).sub,
          relatedId: created.id,
        }),
        0,
      )
    } finally {
      ownerSocket.disconnect()
      otherSocket.disconnect()
      await cleanNotificationFixtures({ transactionIds, categoryIds })
    }
  })

  it("does not create transaction notifications for denied or failed writes", async () => {
    const category = await createBudgetCategory(userId)
    const foreignCategory = await createBudgetCategory(
      jwt.decode(otherToken).sub,
    )
    const foreignTransaction = await Transaction.create({
      ...transactionInput(foreignCategory),
      userId: jwt.decode(otherToken).sub,
    })
    const baselineCount = await Notification.countDocuments({ userId })
    const foreignRead = await request(
      `/api/transactions/${foreignTransaction.id}`,
      { accessToken: token },
    )
    const foreignDelete = await request(
      `/api/transactions/${foreignTransaction.id}`,
      { method: "DELETE", accessToken: token },
    )
    assert.equal(foreignRead.status, 404)
    assert.equal(foreignDelete.status, 404)

    const originalCreate = Transaction.create
    try {
      Transaction.create = async () => {
        throw new Error("Simulated transaction write failure.")
      }
      const failedWrite = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(category),
      })
      assert.equal(failedWrite.status, 500)
    } finally {
      Transaction.create = originalCreate
      await Transaction.deleteOne({ _id: foreignTransaction._id })
      await Category.deleteMany({
        _id: { $in: [category._id, foreignCategory._id] },
      })
    }

    assert.equal(await Notification.countDocuments({ userId }), baselineCount)
  })

  it("keeps a successful transaction when notification persistence fails", async () => {
    const category = await createBudgetCategory(userId, "income")
    const originalSave = Notification.prototype.save
    const originalConsoleError = console.error
    let transactionId

    try {
      Notification.prototype.save = async function failNotificationSave() {
        throw new Error("Simulated notification persistence failure.")
      }
      console.error = () => {}

      const response = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(category, { type: "income" }),
      })

      assert.equal(response.status, 201)
      const { transaction } = await response.json()
      transactionId = new mongoose.Types.ObjectId(transaction.id)
      assert.ok(await Transaction.exists({ _id: transactionId, userId }))
      assert.equal(
        await Notification.countDocuments({ relatedId: transactionId }),
        0,
      )
    } finally {
      Notification.prototype.save = originalSave
      console.error = originalConsoleError
      await cleanNotificationFixtures({
        transactionIds: transactionId ? [transactionId] : [],
        categoryIds: [category._id],
      })
    }
  })

  it("persists notifications when Socket.IO is unavailable or emission fails", async () => {
    const missingIoRelatedId = new mongoose.Types.ObjectId()
    const originalConsoleError = console.error
    const emissionFailureRelatedId = new mongoose.Types.ObjectId()

    try {
      const savedWithoutIo = await createNotificationBestEffort(
        {
          userId,
          type: "transaction_created",
          title: "Persisted without socket",
          message: "Socket.IO is not configured.",
          relatedId: missingIoRelatedId,
          relatedType: "transaction",
        },
        undefined,
      )
      assert.ok(savedWithoutIo)
      assert.ok(await Notification.exists({ _id: savedWithoutIo._id }))

      console.error = () => {}
      const savedDespiteEmitFailure = await createNotificationBestEffort(
        {
          userId,
          type: "transaction_created",
          title: "Persisted despite socket failure",
          message: "The socket emitter throws.",
          relatedId: emissionFailureRelatedId,
          relatedType: "transaction",
        },
        {
          to() {
            return {
              emit() {
                throw new Error("Simulated socket emission failure.")
              },
            }
          },
        },
      )
      assert.ok(savedDespiteEmitFailure)
      assert.ok(await Notification.exists({ _id: savedDespiteEmitFailure._id }))
    } finally {
      console.error = originalConsoleError
      await Notification.deleteMany({
        relatedId: {
          $in: [missingIoRelatedId, emissionFailureRelatedId],
        },
      })
    }
  })

  it("keeps transaction writes and notifications when Socket.IO emission throws", async () => {
    const category = await createBudgetCategory(userId)
    const originalIo = app.get("io")
    const originalConsoleError = console.error
    const transactionIds = []

    try {
      app.set("io", {
        to() {
          return {
            emit() {
              throw new Error("Simulated Socket.IO emission failure.")
            },
          }
        },
      })
      console.error = () => {}

      const createResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(category),
      })
      assert.equal(createResponse.status, 201)
      const { transaction: created } = await createResponse.json()
      const transactionId = new mongoose.Types.ObjectId(created.id)
      transactionIds.push(transactionId)
      assert.ok(await Transaction.exists({ _id: transactionId, userId }))
      assert.ok(
        await Notification.exists({
          userId,
          type: "transaction_created",
          relatedId: transactionId,
        }),
      )

      const updateResponse = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { description: "Updated despite socket failure" },
      })
      assert.equal(updateResponse.status, 200)
      assert.equal(
        (await Transaction.findById(transactionId)).description,
        "Updated despite socket failure",
      )
      assert.ok(
        await Notification.exists({
          userId,
          type: "transaction_updated",
          relatedId: transactionId,
        }),
      )

      const deleteResponse = await request(`/api/transactions/${created.id}`, {
        method: "DELETE",
        accessToken: token,
      })
      assert.equal(deleteResponse.status, 200)
      assert.equal(
        await Transaction.exists({ _id: transactionId, userId }),
        null,
      )
      assert.ok(
        await Notification.exists({
          userId,
          type: "transaction_deleted",
          relatedId: transactionId,
        }),
      )
    } finally {
      app.set("io", originalIo)
      console.error = originalConsoleError
      await cleanNotificationFixtures({
        transactionIds,
        categoryIds: [category._id],
      })
    }
  })

  it("creates budget alerts at the exact warning and exceeded thresholds only", async () => {
    const cases = [
      { month: "2024-01", amount: 84.99, expectedType: null },
      { month: "2024-02", amount: 85, expectedType: "budget_warning" },
      { month: "2024-03", amount: 99.99, expectedType: "budget_warning" },
      { month: "2024-04", amount: 100, expectedType: "budget_exceeded" },
      { month: "2024-05", amount: 105, expectedType: "budget_exceeded" },
    ]
    const categoryIds = []
    const budgetIds = []
    const transactionIds = []

    try {
      for (const { month, amount, expectedType } of cases) {
        const category = await createBudgetCategory(userId)
        const budget = await createTestBudget(
          userId,
          category.id,
          `${month}-01`,
        )
        categoryIds.push(category._id)
        budgetIds.push(budget._id)

        const response = await request("/api/transactions", {
          method: "POST",
          accessToken: token,
          body: transactionInput(category, {
            date: `${month}-15`,
            amount,
          }),
        })
        assert.equal(response.status, 201)
        const { transaction } = await response.json()
        transactionIds.push(new mongoose.Types.ObjectId(transaction.id))

        const spentResponse = await request(`/api/budgets/${budget.id}/spent`, {
          accessToken: token,
        })
        assert.equal(spentResponse.status, 200)
        const spent = await spentResponse.json()
        assert.equal(spent.percentUsed, amount)
        assert.equal(
          spent.status,
          amount >= 100 ? "exceeded" : amount >= 85 ? "warning" : "healthy",
        )

        const alerts = await Notification.find({
          relatedId: budget._id,
          type: { $in: ["budget_warning", "budget_exceeded"] },
        })
        assert.equal(alerts.length, expectedType ? 1 : 0)
        if (expectedType) assert.equal(alerts[0].type, expectedType)
      }
    } finally {
      await cleanNotificationFixtures({
        transactionIds,
        budgetIds,
        categoryIds,
      })
    }
  })

  it("excludes pending expenses and income from budget alerts", async () => {
    const expenseCategory = await createBudgetCategory(userId)
    const incomeCategory = await createBudgetCategory(userId, "income")
    const budget = await createTestBudget(
      userId,
      expenseCategory.id,
      "2024-06-01",
    )
    const categoryIds = [expenseCategory._id, incomeCategory._id]
    const transactionIds = []

    try {
      for (const [category, overrides] of [
        [expenseCategory, { amount: 100, status: "pending" }],
        [incomeCategory, { amount: 100, type: "income" }],
        [expenseCategory, { amount: 84.99 }],
      ]) {
        const response = await request("/api/transactions", {
          method: "POST",
          accessToken: token,
          body: transactionInput(category, {
            date: "2024-06-15",
            ...overrides,
          }),
        })
        assert.equal(response.status, 201)
        const { transaction } = await response.json()
        transactionIds.push(new mongoose.Types.ObjectId(transaction.id))
      }

      const spentResponse = await request(`/api/budgets/${budget.id}/spent`, {
        accessToken: token,
      })
      assert.equal((await spentResponse.json()).spent, 84.99)
      assert.equal(
        await Notification.countDocuments({
          relatedId: budget._id,
          type: { $in: ["budget_warning", "budget_exceeded"] },
        }),
        0,
      )
    } finally {
      await cleanNotificationFixtures({
        transactionIds,
        budgetIds: [budget._id],
        categoryIds,
      })
    }
  })

  it("recalculates the old and new monthly budgets after transaction changes", async () => {
    const oldCategory = await createBudgetCategory(userId)
    const newCategory = await createBudgetCategory(userId)
    const incomeCategory = await createBudgetCategory(userId, "income")
    const oldBudget = await createTestBudget(
      userId,
      oldCategory.id,
      "2024-01-01",
    )
    const newBudget = await createTestBudget(
      userId,
      newCategory.id,
      "2024-02-01",
    )
    const oldBase = await Transaction.create({
      ...transactionInput(oldCategory, { amount: 80 }),
      userId,
    })
    const newBase = await Transaction.create({
      ...transactionInput(newCategory, {
        date: "2024-02-10",
        amount: 80,
      }),
      userId,
    })
    const transactionIds = [oldBase._id, newBase._id]
    const budgetIds = [oldBudget._id, newBudget._id]
    const categoryIds = [oldCategory._id, newCategory._id, incomeCategory._id]
    let targetId

    try {
      const createResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(oldCategory, { amount: 5 }),
      })
      assert.equal(createResponse.status, 201)
      const { transaction: created } = await createResponse.json()
      targetId = new mongoose.Types.ObjectId(created.id)
      transactionIds.push(targetId)

      let alerts = await Notification.find({
        relatedId: oldBudget._id,
        type: "budget_warning",
      })
      assert.equal(alerts.length, 1)

      const amountUpdate = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { amount: 10 },
      })
      assert.equal(amountUpdate.status, 200)

      const moveUpdate = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: {
          categoryId: newCategory.id,
          date: "2024-02-15",
        },
      })
      assert.equal(moveUpdate.status, 200)

      alerts = await Notification.find({
        relatedId: newBudget._id,
        type: "budget_warning",
      })
      assert.equal(alerts.length, 1)
      assert.match(alerts[0].message, /2024-02/)

      const pendingUpdate = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { status: "pending" },
      })
      assert.equal(pendingUpdate.status, 200)
      const pendingSpent = await request(`/api/budgets/${newBudget.id}/spent`, {
        accessToken: token,
      })
      assert.equal((await pendingSpent.json()).spent, 80)

      await Notification.updateOne({ _id: alerts[0]._id }, {
        $set: { isRead: true },
      })
      const completedUpdate = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: { status: "completed" },
      })
      assert.equal(completedUpdate.status, 200)
      assert.equal(
        await Notification.countDocuments({
          relatedId: newBudget._id,
          type: "budget_warning",
        }),
        1,
      )
      assert.equal(
        (await Notification.findById(alerts[0]._id).lean()).isRead,
        true,
      )

      const incomeUpdate = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: {
          type: "income",
          categoryId: incomeCategory.id,
        },
      })
      assert.equal(incomeUpdate.status, 200)
      const incomeSpent = await request(`/api/budgets/${newBudget.id}/spent`, {
        accessToken: token,
      })
      assert.equal((await incomeSpent.json()).spent, 80)

      const restoreExpense = await request(`/api/transactions/${created.id}`, {
        method: "PATCH",
        accessToken: token,
        body: {
          type: "expense",
          categoryId: newCategory.id,
        },
      })
      assert.equal(restoreExpense.status, 200)
      assert.equal(
        await Notification.countDocuments({
          relatedId: newBudget._id,
          type: "budget_warning",
        }),
        1,
      )

      const deleteResponse = await request(`/api/transactions/${created.id}`, {
        method: "DELETE",
        accessToken: token,
      })
      assert.equal(deleteResponse.status, 200)
      const deletedSpent = await request(`/api/budgets/${newBudget.id}/spent`, {
        accessToken: token,
      })
      assert.equal((await deletedSpent.json()).spent, 80)
      assert.equal(
        await Notification.countDocuments({
          relatedId: newBudget._id,
          type: "budget_warning",
        }),
        1,
      )
    } finally {
      await cleanNotificationFixtures({
        transactionIds,
        budgetIds,
        categoryIds,
      })
    }
  })

  it("deduplicates read warning alerts and records a separate exceeded transition", async () => {
    const category = await createBudgetCategory(userId)
    const budget = await createTestBudget(userId, category.id, "2024-07-01")
    const baseline = await Transaction.create({
      ...transactionInput(category, {
        date: "2024-07-10",
        amount: 84,
      }),
      userId,
    })
    const transactionIds = [baseline._id]
    const categoryIds = [category._id]
    let budgetIds = [budget._id]

    try {
      const concurrentCreates = await Promise.all([
        request("/api/transactions", {
          method: "POST",
          accessToken: token,
          body: transactionInput(category, {
            date: "2024-07-11",
            amount: 1,
            description: "Concurrent threshold expense A",
          }),
        }),
        request("/api/transactions", {
          method: "POST",
          accessToken: token,
          body: transactionInput(category, {
            date: "2024-07-12",
            amount: 1,
            description: "Concurrent threshold expense B",
          }),
        }),
      ])
      for (const response of concurrentCreates) {
        assert.equal(response.status, 201)
        const { transaction } = await response.json()
        transactionIds.push(new mongoose.Types.ObjectId(transaction.id))
      }

      let alerts = await Notification.find({
        relatedId: budget._id,
        type: "budget_warning",
      })
      assert.equal(alerts.length, 1)
      await Notification.updateOne({ _id: alerts[0]._id }, {
        $set: { isRead: true },
      })

      const exceededResponse = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(category, {
          date: "2024-07-13",
          amount: 14,
        }),
      })
      assert.equal(exceededResponse.status, 201)
      const { transaction: exceededTransaction } = await exceededResponse.json()
      transactionIds.push(new mongoose.Types.ObjectId(exceededTransaction.id))

      const repeatedExceeded = await request("/api/transactions", {
        method: "POST",
        accessToken: token,
        body: transactionInput(category, {
          date: "2024-07-14",
          amount: 1,
        }),
      })
      assert.equal(repeatedExceeded.status, 201)
      const { transaction: repeatedTransaction } = await repeatedExceeded.json()
      transactionIds.push(new mongoose.Types.ObjectId(repeatedTransaction.id))

      alerts = await Notification.find({
        relatedId: budget._id,
        type: { $in: ["budget_warning", "budget_exceeded"] },
      })
      assert.equal(
        alerts.filter(({ type }) => type === "budget_warning").length,
        1,
      )
      assert.equal(
        alerts.filter(({ type }) => type === "budget_exceeded").length,
        1,
      )
      assert.equal(
        alerts.find(({ type }) => type === "budget_warning").isRead,
        true,
      )
      assert.ok(alerts.every(({ relatedType }) => relatedType === "budget"))
    } finally {
      await cleanNotificationFixtures({
        transactionIds,
        budgetIds,
        categoryIds,
      })
    }
  })
})
