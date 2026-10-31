const mongoose = require("mongoose")

const Category = require("../models/Category")

const Transaction = require("../models/Transaction")

const { normalizeCurrency } = require("../utils/currencies")

const transactionFields = [
  "date",

  "description",

  "category",

  "categoryId",

  "type",

  "amount",

  "paymentMethod",

  "status",

  "note",
]

function emitTransactionEvent(req, event, transaction) {
  const io = req.app.get("io")

  if (!io) return

  const eventTransaction = transaction.toJSON()

  delete eventTransaction.userId

  io.to(`user:${transaction.userId.toString()}`).emit(event, {
    transaction: eventTransaction,
  })
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split("-").map(Number)

  if (month < 1 || month > 12) return false

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

  const daysInMonth = [
    31,

    isLeapYear ? 29 : 28,

    31,

    30,

    31,

    30,

    31,

    31,

    30,

    31,

    30,

    31,
  ]

  return day >= 1 && day <= daysInMonth[month - 1]
}

function readTransactionInput(body, partial = false, currency = "EUR") {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Transaction details must be an object." }
  }

  const updates = {}

  const providedFields = transactionFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  )

  if (partial && providedFields.length === 0) {
    return { error: "Provide at least one transaction field to update." }
  }

  for (const field of providedFields) {
    const value = body[field]

    if (field === "amount") {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return { error: "Amount must be a positive number." }
      }

      const fractionDigits = new Intl.NumberFormat("en", {
        style: "currency",

        currency,
      }).resolvedOptions().maximumFractionDigits

      const scaledAmount = value * 10 ** fractionDigits

      if (Math.abs(scaledAmount - Math.round(scaledAmount)) > 1e-8) {
        return {
          error: `Amount supports up to ${fractionDigits} decimal places in ${currency}.`,
        }
      }
    } else if (field === "type") {
      if (!["income", "expense"].includes(value)) {
        return { error: "Type must be income or expense." }
      }
    } else if (field === "status") {
      if (!["completed", "pending"].includes(value)) {
        return { error: "Status must be completed or pending." }
      }
    } else if (field === "date") {
      if (!isValidDate(value)) {
        return { error: "Date must be a valid YYYY-MM-DD date." }
      }
    } else if (field === "categoryId") {
      if (
        value !== null &&
        (typeof value !== "string" || !mongoose.isValidObjectId(value))
      ) {
        return { error: "Category ID must be a valid identifier." }
      }
    } else if (field === "description" || field === "category") {
      if (!isNonEmptyString(value)) {
        return { error: `${field} is required.` }
      }

      updates[field] = value.trim()

      continue
    } else if (field === "paymentMethod" || field === "note") {
      if (typeof value !== "string") {
        return { error: `${field} must be a string.` }
      }
    }

    updates[field] = value
  }

  if (!partial) {
    for (const field of ["date", "description", "category", "type", "amount"]) {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        return { error: `${field} is required.` }
      }
    }
  }

  return { updates }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isValidId(id) {
  return mongoose.isValidObjectId(id)
}

async function findActiveCategory(categoryId, userId, type) {
  if (!isValidId(categoryId)) {
    return { error: "Category not found.", status: 404 }
  }

  const category = await Category.findOne({
    _id: categoryId,

    userId,
  })

  if (!category) return { error: "Category not found.", status: 404 }

  if (category.isArchived) {
    return {
      error: "Archived categories cannot be assigned to transactions.",
      status: 400,
    }
  }

  if (category.type !== type) {
    return {
      error: "Category type must match the transaction type.",
      status: 400,
    }
  }

  return { category }
}

async function createTransaction(req, res, next) {
  try {
    const { updates, error } = readTransactionInput(
      req.body,

      false,

      normalizeCurrency(req.user.currency),
    )

    if (error) {
      return res.status(400).json({ message: error })
    }

    if (updates.categoryId) {
      const {
        category,
        error: categoryError,
        status,
      } = await findActiveCategory(
        updates.categoryId,

        req.user.id,

        updates.type,
      )

      if (categoryError)
        return res.status(status).json({ message: categoryError })

      updates.category = category.name
    } else {
      delete updates.categoryId
    }

    const transaction = await Transaction.create({
      ...updates,

      userId: req.user.id,
    })

    emitTransactionEvent(req, "transaction:created", transaction)

    return res.status(201).json({ transaction })
  } catch (error) {
    return next(error)
  }
}

async function listTransactions(req, res, next) {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({
      date: -1,

      createdAt: -1,
    })

    return res.status(200).json({ transactions })
  } catch (error) {
    return next(error)
  }
}

async function getTransaction(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,

      userId: req.user.id,
    })

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    return res.status(200).json({ transaction })
  } catch (error) {
    return next(error)
  }
}

async function updateTransaction(req, res, next) {
  try {
    const { updates, error } = readTransactionInput(
      req.body,

      true,

      normalizeCurrency(req.user.currency),
    )

    if (error) {
      return res.status(400).json({ message: error })
    }

    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    const currentTransaction = await Transaction.findOne({
      _id: req.params.id,

      userId: req.user.id,
    })

    if (!currentTransaction) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    let unsetCategoryId = false

    if (Object.prototype.hasOwnProperty.call(updates, "categoryId")) {
      if (updates.categoryId === null) {
        delete updates.categoryId

        unsetCategoryId = true
      } else {
        const {
          category,
          error: categoryError,
          status,
        } = await findActiveCategory(
          updates.categoryId,

          req.user.id,

          updates.type || currentTransaction.type,
        )

        if (categoryError)
          return res.status(status).json({ message: categoryError })

        updates.category = category.name
      }
    } else if (currentTransaction.categoryId) {
      const linkedCategory = await Category.findOne({
        _id: currentTransaction.categoryId,

        userId: req.user.id,
      })

      if (linkedCategory) {
        if (updates.type && updates.type !== linkedCategory.type) {
          return res.status(400).json({
            message: "Category type must match the transaction type.",
          })
        }

        updates.category = linkedCategory.name
      }
    }

    const updateOperation = unsetCategoryId
      ? { $set: updates, $unset: { categoryId: 1 } }
      : updates

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },

      updateOperation,

      { new: true, runValidators: true },
    )

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    emitTransactionEvent(req, "transaction:updated", transaction)

    return res.status(200).json({ transaction })
  } catch (error) {
    return next(error)
  }
}

async function deleteTransaction(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,

      userId: req.user.id,
    })

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." })
    }

    const io = req.app.get("io")

    if (io) {
      io.to(`user:${transaction.userId.toString()}`).emit(
        "transaction:deleted",
        {
          id: transaction.id,
        },
      )
    }

    return res.status(200).json({ message: "Transaction deleted." })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  createTransaction,

  listTransactions,

  getTransaction,

  updateTransaction,

  deleteTransaction,
}
