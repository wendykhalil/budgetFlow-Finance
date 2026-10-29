const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

const transactionFields = [
  'date',
  'description',
  'category',
  'type',
  'amount',
  'paymentMethod',
  'status',
  'note',
];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readTransactionInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Transaction details must be an object.' };
  }

  const updates = {};
  const providedFields = transactionFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
  if (partial && providedFields.length === 0) {
    return { error: 'Provide at least one transaction field to update.' };
  }

  for (const field of providedFields) {
    const value = body[field];
    if (field === 'amount') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return { error: 'Amount must be a positive number.' };
      }
    } else if (field === 'type') {
      if (!['income', 'expense'].includes(value)) {
        return { error: 'Type must be income or expense.' };
      }
    } else if (field === 'status') {
      if (!['completed', 'pending'].includes(value)) {
        return { error: 'Status must be completed or pending.' };
      }
    } else if (field === 'date') {
      if (!isValidDate(value)) {
        return { error: 'Date must be a valid YYYY-MM-DD date.' };
      }
    } else if (field === 'description' || field === 'category') {
      if (!isNonEmptyString(value)) {
        return { error: `${field} is required.` };
      }
      updates[field] = value.trim();
      continue;
    } else if (field === 'paymentMethod' || field === 'note') {
      if (typeof value !== 'string') {
        return { error: `${field} must be a string.` };
      }
    }

    updates[field] = value;
  }

  if (!partial) {
    for (const field of ['date', 'description', 'category', 'type', 'amount']) {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        return { error: `${field} is required.` };
      }
    }
  }

  return { updates };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

async function createTransaction(req, res, next) {
  try {
    const { updates, error } = readTransactionInput(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const transaction = await Transaction.create({
      ...updates,
      userId: req.user.id,
    });
    return res.status(201).json({ transaction });
  } catch (error) {
    return next(error);
  }
}

async function listTransactions(req, res, next) {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({
      date: -1,
      createdAt: -1,
    });
    return res.status(200).json({ transactions });
  } catch (error) {
    return next(error);
  }
}

async function getTransaction(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.status(200).json({ transaction });
  } catch (error) {
    return next(error);
  }
}

async function updateTransaction(req, res, next) {
  try {
    const { updates, error } = readTransactionInput(req.body, true);
    if (error) {
      return res.status(400).json({ message: error });
    }
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true, runValidators: true },
    );
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.status(200).json({ transaction });
  } catch (error) {
    return next(error);
  }
}

async function deleteTransaction(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.status(200).json({ message: 'Transaction deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
};
