const mongoose = require("mongoose")

const Budget = require("../models/Budget")

const Category = require("../models/Category")

const { normalizeCurrency } = require("../utils/currencies")
const { getBudgetSpending } = require("../utils/budgetSpending")

function isValidAmountForCurrency(amount, currency) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return false
  }

  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",

    currency,
  }).resolvedOptions().maximumFractionDigits

  const scaledAmount = amount * 10 ** fractionDigits

  return Math.abs(scaledAmount - Math.round(scaledAmount)) <= 1e-8
}

function getLimitPrecisionMessage(currency) {
  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",

    currency,
  }).resolvedOptions().maximumFractionDigits

  return `Limit supports up to ${fractionDigits} decimal places in ${currency}.`
}

function emitBudgetEvent(req, event, payload) {
  try {
    const io = req.app.get("io")
    if (io) io.to(`user:${req.user.id}`).emit(event, payload)
  } catch (error) {
    console.error(`[budgets] Socket.IO emission failed for ${event}.`, error)
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false

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

async function listBudgets(req, res, next) {
  try {
    const budgets = await Budget.find({ userId: req.user.id })

      .populate("categoryId", "name type color icon isArchived")

      .sort({ startDate: -1 })

    return res.status(200).json({ budgets })
  } catch (error) {
    return next(error)
  }
}

async function createBudget(req, res, next) {
  try {
    const { name, limit, categoryId, period, startDate } = req.body

    // Validate name

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required." })
    }

    // Validate limit

    const currency = normalizeCurrency(req.user.currency)

    if (!isValidAmountForCurrency(limit, currency)) {
      if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
        return res
          .status(400)
          .json({ message: getLimitPrecisionMessage(currency) })
      }

      return res
        .status(400)
        .json({ message: "Limit must be greater than zero." })
    }

    // Validate category exists and belongs to user

    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID." })
    }

    const category = await Category.findOne({
      _id: categoryId,
      userId: req.user.id,
    })

    if (!category) {
      return res.status(404).json({ message: "Category not found." })
    }

    // Category must be expense type

    if (category.type !== "expense") {
      return res
        .status(400)
        .json({ message: "Budget can only be created for expense categories." })
    }

    // Category must not be archived

    if (category.isArchived) {
      return res.status(409).json({
        message: "Archived categories cannot be used for new budgets.",
      })
    }

    // Period must be monthly

    if (period && period !== "monthly") {
      return res.status(400).json({ message: "Period must be monthly." })
    }

    // Validate startDate

    if (!startDate || !isValidDate(startDate)) {
      return res.status(400).json({
        message:
          "Start date must be a valid date and the first day of its month (YYYY-MM-01).",
      })
    }

    // Check that startDate is the first day of the month

    const [y, m, d] = startDate.split("-").map(Number)

    if (d !== 1) {
      return res
        .status(400)
        .json({ message: "Start date must be the first day of the month." })
    }

    // Check for existing budget for same category and month

    const monthStart = `${y}-${m.toString().padStart(2, "0")}-01`

    const existingBudget = await Budget.findOne({
      userId: req.user.id,

      categoryId: categoryId,

      period: "monthly",

      startDate: monthStart,
    })

    if (existingBudget) {
      return res.status(409).json({
        message: "A budget already exists for this category and month.",
      })
    }

    // Create budget

    const budget = new Budget({
      userId: req.user.id,

      categoryId,

      name: name.trim(),

      limit,

      period: "monthly",

      startDate: monthStart,
    })

    const createdBudget = await budget.save()

    // Populate category info for response

    await createdBudget.populate(
      "categoryId",
      "name type color icon isArchived",
    )

    const eventBudget = createdBudget.toJSON()
    delete eventBudget.userId
    emitBudgetEvent(req, "budget:created", { budget: eventBudget })

    return res.status(201).json({ budget: createdBudget })
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error

      return res.status(409).json({
        message: "A budget already exists for this category and month.",
      })
    }

    return next(error)
  }
}

async function getBudget(req, res, next) {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Budget not found." })
    }

    const budget = await Budget.findOne({ _id: id, userId: req.user.id })

      .populate("categoryId", "name type color icon isArchived")

    if (!budget) {
      return res.status(404).json({ message: "Budget not found." })
    }

    return res.status(200).json({ budget })
  } catch (error) {
    return next(error)
  }
}

async function updateBudget(req, res, next) {
  try {
    const { id } = req.params

    const { name, limit, color, icon, startDate } = req.body

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Budget not found." })
    }

    const budget = await Budget.findOne({ _id: id, userId: req.user.id })

    if (!budget) {
      return res.status(404).json({ message: "Budget not found." })
    }

    // If categoryId is being changed, validate

    if (
      req.body.categoryId !== undefined &&
      req.body.categoryId !== budget.categoryId.toString()
    ) {
      if (!mongoose.isValidObjectId(req.body.categoryId)) {
        return res.status(400).json({ message: "Invalid category ID." })
      }

      const categoryId = new mongoose.Types.ObjectId(req.body.categoryId)

      const category = await Category.findOne({
        _id: categoryId,
        userId: req.user.id,
      })

      if (!category) {
        return res.status(404).json({ message: "Category not found." })
      }

      if (category.type !== "expense") {
        return res.status(400).json({
          message: "Budget can only be created for expense categories.",
        })
      }

      if (category.isArchived) {
        return res.status(409).json({
          message: "Archived categories cannot be used for new budgets.",
        })
      }

      // Check for existing budget with new category and same month

      const [y, m] = budget.startDate.split("-").map(Number)

      const newMonthStart = `${y}-${m.toString().padStart(2, "0")}-01`

      const existingBudget = await Budget.findOne({
        userId: req.user.id,

        categoryId: categoryId,

        period: "monthly",

        startDate: newMonthStart,

        _id: { $ne: budget.id },
      })

      if (existingBudget) {
        return res.status(409).json({
          message: "A budget already exists for this category and month.",
        })
      }

      budget.categoryId = categoryId
    }

    // Validate name

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length === 0)
    ) {
      return res
        .status(400)
        .json({ message: "Name must be a non-empty string." })
    }

    // Validate limit

    if (limit !== undefined) {
      const currency = normalizeCurrency(req.user.currency)

      if (!isValidAmountForCurrency(limit, currency)) {
        if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
          return res
            .status(400)
            .json({ message: getLimitPrecisionMessage(currency) })
        }

        return res
          .status(400)
          .json({ message: "Limit must be greater than zero." })
      }
    }

    // Validate startDate if provided

    if (startDate !== undefined) {
      if (!isValidDate(startDate)) {
        return res.status(400).json({
          message:
            "Start date must be a valid date and the first day of its month (YYYY-MM-01).",
        })
      }

      const [y, m, dd] = startDate.split("-").map(Number)

      if (dd !== 1) {
        return res
          .status(400)
          .json({ message: "Start date must be the first day of the month." })
      }
    }

    // Apply updates

    if (name !== undefined) budget.name = name.trim()

    if (limit !== undefined) budget.limit = limit

    if (color !== undefined) budget.color = color

    if (icon !== undefined) budget.icon = icon

    if (startDate !== undefined) budget.startDate = startDate

    await budget.save()

    // Populate category info

    await budget.populate("categoryId", "name type color icon isArchived")

    const eventBudget = budget.toJSON()
    delete eventBudget.userId
    emitBudgetEvent(req, "budget:updated", { budget: eventBudget })

    return res.status(200).json({ budget })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A budget already exists for this category and month.",
      })
    }

    return next(error)
  }
}

async function deleteBudget(req, res, next) {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Budget not found." })
    }

    const budget = await Budget.findOneAndDelete({
      _id: id,

      userId: req.user.id,
    })

    if (!budget) {
      return res.status(404).json({ message: "Budget not found." })
    }

    emitBudgetEvent(req, "budget:deleted", { budgetId: id })

    return res.status(200).json({ message: "Budget deleted." })
  } catch (error) {
    return next(error)
  }
}

async function getBudgetSpent(req, res, next) {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Budget not found." })
    }

    const budget = await Budget.findOne({ _id: id, userId: req.user.id })

    if (!budget) {
      return res.status(404).json({ message: "Budget not found." })
    }

    const spending = await getBudgetSpending(budget)
    return res.status(200).json(spending)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listBudgets,

  createBudget,

  getBudget,

  updateBudget,

  deleteBudget,

  getBudgetSpent,
}
