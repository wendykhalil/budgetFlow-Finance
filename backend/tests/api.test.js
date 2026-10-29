const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const mongoose = require('mongoose');

process.env.FRONTEND_ORIGINS = 'http://localhost:8443';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

const app = require('../src/app');
const User = require('../src/models/User');

const databaseName = `budgetflow_backend_test_${process.pid}_${Date.now()}`;
const databaseUri = `mongodb://127.0.0.1:27017/${databaseName}`;
const email = `client-${process.pid}-${Date.now()}@example.test`;
let server;
let baseUrl;
let token;
let userId;
let transactionId;
let otherToken;

async function request(path, { method = 'GET', accessToken, body, rawBody, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (accessToken) {
    requestHeaders.authorization = `Bearer ${accessToken}`;
  }
  if (body !== undefined) {
    requestHeaders['content-type'] = 'application/json';
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('BudgetFlow API integration', () => {
  before(async () => {
    await mongoose.connect(databaseUri);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('returns health and connected readiness', async () => {
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const ready = await request('/api/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ready', database: 'connected' });
  });

  it('registers a client, hashes the password, and rejects invalid registration', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: {
        firstName: 'Alex',
        lastName: 'Martin',
        email,
        phone: '+33 6 12 34 56 78',
        password: 'Client123!',
        currency: 'EUR',
        country: 'France',
        role: 'admin',
      },
    });

    assert.equal(response.status, 201);
    const result = await response.json();
    token = result.token;
    userId = result.user.id;
    assert.equal(result.user.role, 'client');
    assert.equal(result.user.email, email);
    assert.equal(Object.hasOwn(result.user, 'password'), false);

    const storedUser = await User.findById(userId).select('+password');
    assert.notEqual(storedUser.password, 'Client123!');
    assert.equal(await require('bcryptjs').compare('Client123!', storedUser.password), true);

    const invalid = await request('/api/auth/register', {
      method: 'POST',
      body: { firstName: '', lastName: 'Martin', email: 'not-an-email', password: 'short' },
    });
    assert.equal(invalid.status, 400);

    const duplicate = await request('/api/auth/register', {
      method: 'POST',
      body: { firstName: 'Alex', lastName: 'Martin', email, password: 'Client123!' },
    });
    assert.equal(duplicate.status, 409);
  });

  it('logs in and rejects invalid credentials', async () => {
    const success = await request('/api/auth/login', {
      method: 'POST',
      body: { email: email.toUpperCase(), password: 'Client123!' },
    });
    assert.equal(success.status, 200);
    const result = await success.json();
    token = result.token;
    assert.equal(result.user.id, userId);
    assert.equal(Object.hasOwn(result.user, 'password'), false);

    const failure = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password' },
    });
    assert.equal(failure.status, 401);
    assert.equal((await failure.json()).message, 'Invalid email or password.');
  });

  it('rejects login for pending accounts', async () => {
    const pendingEmail = `pending-${process.pid}-${Date.now()}@example.test`;
    await User.create({
      firstName: 'Pat',
      lastName: 'Pending',
      email: pendingEmail,
      password: 'Client123!',
      status: 'pending',
    });

    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: pendingEmail, password: 'Client123!' },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Invalid email or password.');
  });

  it('rejects login for suspended accounts', async () => {
    const suspendedEmail = `suspended-${process.pid}-${Date.now()}@example.test`;
    await User.create({
      firstName: 'Sam',
      lastName: 'Suspended',
      email: suspendedEmail,
      password: 'Client123!',
      status: 'suspended',
    });

    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: suspendedEmail, password: 'Client123!' },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Invalid email or password.');
  });

  it('rejects a previously issued token after the account is suspended', async () => {
    const activeEmail = `active-token-${process.pid}-${Date.now()}@example.test`;
    const activeUser = await User.create({
      firstName: 'Avery',
      lastName: 'Active',
      email: activeEmail,
      password: 'Client123!',
    });

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: activeEmail, password: 'Client123!' },
    });
    assert.equal(login.status, 200);
    const activeToken = (await login.json()).token;

    await User.findByIdAndUpdate(activeUser.id, { status: 'suspended' });

    const currentUser = await request('/api/auth/me', { accessToken: activeToken });
    assert.equal(currentUser.status, 401);
    assert.equal((await currentUser.json()).message, 'Invalid or expired token.');

    const transactions = await request('/api/transactions', { accessToken: activeToken });
    assert.equal(transactions.status, 401);
    assert.equal((await transactions.json()).message, 'Invalid or expired token.');
  });

  it('protects the current-user and transaction routes', async () => {
    const currentUser = await request('/api/auth/me', { accessToken: token });
    assert.equal(currentUser.status, 200);
    assert.equal((await currentUser.json()).user.id, userId);

    const noToken = await request('/api/transactions');
    assert.equal(noToken.status, 401);

    const badToken = await request('/api/transactions', { accessToken: 'not-a-token' });
    assert.equal(badToken.status, 401);
  });

  it('creates, lists, reads, updates, and deletes the signed-in user transaction', async () => {
    const created = await request('/api/transactions', {
      method: 'POST',
      accessToken: token,
      body: {
        date: '2026-10-24',
        description: 'Grocery Store',
        category: 'Food',
        type: 'expense',
        amount: 86.4,
        paymentMethod: 'Debit card',
        status: 'completed',
        note: 'Weekly groceries',
        userId: '000000000000000000000001',
      },
    });
    assert.equal(created.status, 201);
    const createdResult = await created.json();
    transactionId = createdResult.transaction.id;
    assert.equal(createdResult.transaction.userId, userId);
    assert.equal(createdResult.transaction.amount, 86.4);
    assert.equal(createdResult.transaction.date, '2026-10-24');

    const list = await request('/api/transactions', { accessToken: token });
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).transactions.map((item) => item.id), [transactionId]);

    const read = await request(`/api/transactions/${transactionId}`, { accessToken: token });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).transaction.category, 'Food');

    const update = await request(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      accessToken: token,
      body: { amount: 90, note: 'Updated note' },
    });
    assert.equal(update.status, 200);
    const updatedTransaction = (await update.json()).transaction;
    assert.equal(updatedTransaction.amount, 90);
    assert.equal(updatedTransaction.note, 'Updated note');

    const deleted = await request(`/api/transactions/${transactionId}`, {
      method: 'DELETE',
      accessToken: token,
    });
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).message, 'Transaction deleted.');

    const missing = await request(`/api/transactions/${transactionId}`, { accessToken: token });
    assert.equal(missing.status, 404);
  });

  it('rejects invalid transaction input and unknown routes', async () => {
    const invalidAmount = await request('/api/transactions', {
      method: 'POST',
      accessToken: token,
      body: {
        date: '2026-10-24',
        description: 'Bad amount',
        category: 'Food',
        type: 'expense',
        amount: 0,
      },
    });
    assert.equal(invalidAmount.status, 400);

    const missingDescription = await request('/api/transactions', {
      method: 'POST',
      accessToken: token,
      body: {
        date: '2026-10-24',
        category: 'Food',
        type: 'expense',
        amount: 1,
      },
    });
    assert.equal(missingDescription.status, 400);

    const invalidDate = await request('/api/transactions', {
      method: 'POST',
      accessToken: token,
      body: {
        date: '2026-02-30',
        description: 'Bad date',
        category: 'Food',
        type: 'expense',
        amount: 1,
      },
    });
    assert.equal(invalidDate.status, 400);

    const invalidUpdate = await request('/api/transactions/000000000000000000000001', {
      method: 'PATCH',
      accessToken: token,
      body: { amount: '10' },
    });
    assert.equal(invalidUpdate.status, 400);

    const unknown = await request('/api/not-a-route');
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).message, 'Route not found.');

    const invalidJson = await request('/api/health', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      rawBody: '{',
    });
    assert.equal(invalidJson.status, 400);
    assert.equal((await invalidJson.json()).message, 'Invalid request JSON.');
  });

  it('prevents a different user from reading, changing, or deleting a transaction', async () => {
    const ownerTransaction = await request('/api/transactions', {
      method: 'POST',
      accessToken: token,
      body: {
        date: '2026-10-25',
        description: 'Owner transaction',
        category: 'Food',
        type: 'expense',
        amount: 20,
      },
    });
    const ownerTransactionId = (await ownerTransaction.json()).transaction.id;

    const secondUser = await request('/api/auth/register', {
      method: 'POST',
      body: {
        firstName: 'Taylor',
        lastName: 'Other',
        email: `other-${process.pid}-${Date.now()}@example.test`,
        password: 'Client123!',
      },
    });
    assert.equal(secondUser.status, 201);
    otherToken = (await secondUser.json()).token;

    const otherList = await request('/api/transactions', { accessToken: otherToken });
    assert.equal((await otherList.json()).transactions.length, 0);

    const otherRead = await request(`/api/transactions/${ownerTransactionId}`, {
      accessToken: otherToken,
    });
    assert.equal(otherRead.status, 404);

    const otherUpdate = await request(`/api/transactions/${ownerTransactionId}`, {
      method: 'PATCH',
      accessToken: otherToken,
      body: { amount: 999 },
    });
    assert.equal(otherUpdate.status, 404);

    const otherDelete = await request(`/api/transactions/${ownerTransactionId}`, {
      method: 'DELETE',
      accessToken: otherToken,
    });
    assert.equal(otherDelete.status, 404);

    const ownerRead = await request(`/api/transactions/${ownerTransactionId}`, {
      accessToken: token,
    });
    assert.equal(ownerRead.status, 200);
  });
});
