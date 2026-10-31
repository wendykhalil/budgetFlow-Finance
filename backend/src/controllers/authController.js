const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { isSupportedCurrency } = require('../utils/currencies');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('Authentication is not configured.');
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1d',
  });
}

async function register(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Authentication is not configured.' });
    }

    const { firstName, lastName, email, password } = req.body || {};
    const currency = req.body?.currency === undefined ? 'EUR' : req.body.currency;
    if (
      !isNonEmptyString(firstName) ||
      !isNonEmptyString(lastName) ||
      !isNonEmptyString(email) ||
      !emailPattern.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length < 6 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        message: 'Enter first name, last name, a valid email, and a password of 6 to 72 bytes.',
      });
    }
    if (!isSupportedCurrency(currency)) {
      return res.status(400).json({
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Choose a supported account currency.',
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : '',
      password,
      role: 'client',
      status: 'active',
      currency,
      country: isNonEmptyString(req.body.country) ? req.body.country.trim() : 'France',
    });

    const token = createToken(user);
    return res.status(201).json({ token, user });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email) || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Enter an email and password.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (
      !user ||
      !(await bcrypt.compare(password, user.password)) ||
      user.status !== 'active'
    ) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({ token: createToken(user), user });
  } catch (error) {
    return next(error);
  }
}

function getCurrentUser(req, res) {
  return res.status(200).json({ user: req.user });
}

async function updateCurrency(req, res, next) {
  try {
    const { currency } = req.body || {};
    if (!isSupportedCurrency(currency)) {
      return res.status(400).json({
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Choose a supported account currency.',
      });
    }

    const currentCurrency = req.user.currency || 'EUR';
    if (currency === currentCurrency) {
      return res.status(200).json({ user: req.user });
    }

    const hasTransactions = await Transaction.exists({ userId: req.user.id });
    if (hasTransactions) {
      return res.status(409).json({
        code: 'CURRENCY_CHANGE_REQUIRES_CONVERSION',
        message:
          'Currency cannot be changed after transactions exist. Changing currency requires a future explicit conversion feature.',
      });
    }

    req.user.currency = currency;
    await req.user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('account:currency-updated', {
        currency: req.user.currency,
      });
    }

    return res.status(200).json({ user: req.user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, getCurrentUser, updateCurrency };
