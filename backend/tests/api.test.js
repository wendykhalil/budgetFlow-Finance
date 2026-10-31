const assert = require("node:assert/strict")

const { after, before, describe, it } = require("node:test")

const mongoose = require("mongoose")

const jwt = require("jsonwebtoken")

const { createServer } = require("node:http")

const { io: createSocketClient } = require("socket.io-client")

process.env.FRONTEND_ORIGINS = "http://localhost:8443"

process.env.JWT_SECRET = "test-secret-with-at-least-32-characters"

const app = require("../src/app")

const Category = require("../src/models/Category")

const Transaction = require("../src/models/Transaction")

const User = require("../src/models/User")

const { attachSocketServer } = require("../src/socket")

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

describe("BudgetFlow API integration", () => {
  before(async () => {
    await mongoose.connect(databaseUri)

    server = createServer(app)

    socketServer = attachSocketServer(server, app)

    server.listen(0, "127.0.0.1")

    await new Promise((resolve) => server.once("listening", resolve))

    baseUrl = `http://127.0.0.1:${server.address().port}`
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
      const invalid = await request("/api/auth/register", {
        method: "POST",
        body,
      })

      assert.equal(invalid.status, 400)

      if (body.currency === "XYZ") {
        assert.equal((await invalid.json()).code, "UNSUPPORTED_CURRENCY")
      }
    }

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

    assert.equal((await failure.json()).message, "Invalid email or password.")
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
})
