const mongoose = require("mongoose")
const User = require("../models/User")
const Transaction = require("../models/Transaction")
const AdminAuditLog = require("../models/AdminAuditLog")

/**
 * List all users with pagination, search, and filtering
 * GET /api/admin/users
 */
async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    )
    const skip = (page - 1) * limit

    const { search, role, status } = req.query

    // Build filter
    const filter = {}

    if (search) {
      const searchRegex = new RegExp(search, "i")
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ]
    }

    if (role && ["client", "admin"].includes(role)) {
      filter.role = role
    }

    if (status && ["active", "pending", "suspended"].includes(status)) {
      filter.status = status
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    // Transform _id to id for consistency
    const transformedUsers = users.map((user) => ({
      ...user,
      id: user._id.toString(),
      _id: undefined,
    }))

    return res.status(200).json({
      data: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return next(error)
  }
}

/**
 * Get a single user by ID
 * GET /api/admin/users/:id
 */
async function getUser(req, res, next) {
  try {
    const { id } = req.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "User not found." })
    }

    const user = await User.findById(id).select("-password").lean()

    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    // Transform _id to id
    const transformedUser = {
      ...user,
      id: user._id.toString(),
      _id: undefined,
    }

    return res.status(200).json({ user: transformedUser })
  } catch (error) {
    return next(error)
  }
}

/**
 * Update user status (active, pending, suspended)
 * PATCH /api/admin/users/:id/status
 */
async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params
    const { status } = req.body || {}

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "User not found." })
    }

    // Validate status enum
    if (!status || !["active", "pending", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "Provide a valid status (active, pending, or suspended).",
      })
    }

    // Prevent admin from deactivating themselves
    if (req.user.id === id && status !== "active") {
      return res.status(409).json({
        message: "You cannot deactivate your own account.",
      })
    }

    // Find and update user
    const user = await User.findById(id)

    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    // Skip if status is already set
    if (user.status === status) {
      const userJSON = user.toJSON()
      return res.status(200).json({ user: userJSON })
    }

    const oldStatus = user.status
    user.status = status
    await user.save()

    // Record audit log
    try {
      await AdminAuditLog.create({
        adminUserId: req.user._id,
        action: "UPDATE",
        targetType: "User",
        targetId: user._id,
        details: {
          statusBefore: oldStatus,
          statusAfter: status,
        },
      })
    } catch (auditError) {
      // Log error but don't fail the status update
      console.error("Audit log creation failed:", auditError)
    }

    const userJSON = user.toJSON()
    return res.status(200).json({ user: userJSON })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listUsers,
  getUser,
  updateUserStatus,
  listTransactions,
  getTransactionsByCategoryReport,
  getUserSpendingReport,
}

/**
 * List all transactions with pagination, filtering, and safe user information
 * GET /api/admin/transactions
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: results per page (default 20, max 100)
 * - userId: filter by user ID
 * - type: filter by transaction type (income|expense)
 * - status: filter by transaction status (completed|pending)
 * - category: filter by category name (case-insensitive)
 * - startDate: filter by date >= YYYY-MM-DD
 * - endDate: filter by date <= YYYY-MM-DD
 */
async function listTransactions(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    )
    const skip = (page - 1) * limit

    const { userId, type, status, category, startDate, endDate } = req.query

    // Build filter
    const filter = {}

    // Filter by userId if provided
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID." })
      }
      filter.userId = new mongoose.Types.ObjectId(userId)
    }

    // Filter by type
    if (type && ["income", "expense"].includes(type)) {
      filter.type = type
    }

    // Filter by status
    if (status && ["completed", "pending"].includes(status)) {
      filter.status = status
    }

    // Filter by category (case-insensitive)
    if (
      category &&
      typeof category === "string" &&
      category.trim().length > 0
    ) {
      filter.category = new RegExp(category, "i")
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {}
      if (
        startDate &&
        typeof startDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ) {
        filter.date.$gte = startDate
      }
      if (
        endDate &&
        typeof endDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        filter.date.$lte = endDate
      }
      if (Object.keys(filter.date).length === 0) {
        delete filter.date
      }
    }

    // Execute query with pagination and populate user for safe info
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate({
          path: "userId",
          select: "firstName lastName email",
          transform: (doc) =>
            doc
              ? {
                  id: doc._id.toString(),
                  firstName: doc.firstName,
                  lastName: doc.lastName,
                  email: doc.email,
                }
              : null,
        })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ])

    // Transform _id to id for consistency
    const transformedTransactions = transactions.map((tx) => ({
      ...tx,
      id: tx._id.toString(),
      _id: undefined,
    }))

    return res.status(200).json({
      data: transformedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return next(error)
  }
}

/**
 * Get aggregated transaction data grouped by category
 * GET /api/admin/reports/transactions-by-category
 *
 * Query params:
 * - type: filter by transaction type (income|expense) - optional
 * - startDate: filter by date >= YYYY-MM-DD - optional
 * - endDate: filter by date <= YYYY-MM-DD - optional
 *
 * Returns array of categories with income/expense totals and transaction counts
 */
async function getTransactionsByCategoryReport(req, res, next) {
  try {
    const { type, startDate, endDate } = req.query

    // Build aggregation pipeline
    const pipeline = []

    // Match stage: filter by type and date range
    const matchStage = {}

    if (type && ["income", "expense"].includes(type)) {
      matchStage.type = type
    }

    if (startDate || endDate) {
      matchStage.date = {}
      if (
        startDate &&
        typeof startDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ) {
        matchStage.date.$gte = startDate
      }
      if (
        endDate &&
        typeof endDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        matchStage.date.$lte = endDate
      }
      if (Object.keys(matchStage.date).length === 0) {
        delete matchStage.date
      }
    }

    // Only include completed transactions in aggregation
    matchStage.status = "completed"

    pipeline.push({ $match: matchStage })

    // Group by category
    pipeline.push({
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
        income: {
          $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
        },
        expense: {
          $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
        },
      },
    })

    // Sort by total amount descending
    pipeline.push({ $sort: { totalAmount: -1 } })

    const results = await Transaction.aggregate(pipeline)

    // Transform results to include category name
    const formattedResults = results.map((row) => ({
      category: row._id,
      totalAmount: row.totalAmount,
      income: row.income,
      expense: row.expense,
      transactionCount: row.transactionCount,
    }))

    return res.status(200).json({
      data: formattedResults,
      summary: {
        totalTransactions: formattedResults.reduce(
          (sum, r) => sum + r.transactionCount,
          0,
        ),
        totalAmount: formattedResults.reduce(
          (sum, r) => sum + r.totalAmount,
          0,
        ),
        totalIncome: formattedResults.reduce((sum, r) => sum + r.income, 0),
        totalExpense: formattedResults.reduce((sum, r) => sum + r.expense, 0),
      },
    })
  } catch (error) {
    return next(error)
  }
}

/**
 * Get aggregated spending information per user
 * GET /api/admin/reports/user-spending
 *
 * Query params:
 * - startDate: filter by date >= YYYY-MM-DD - optional
 * - endDate: filter by date <= YYYY-MM-DD - optional
 * - limit: max number of users to return (default 100, max 500)
 *
 * Returns array of users with income/expense totals and completed transaction counts
 * Pending transactions are excluded from spending totals
 */
async function getUserSpendingReport(req, res, next) {
  try {
    const limit = Math.min(
      500,
      Math.max(1, parseInt(req.query.limit, 10) || 100),
    )
    const { startDate, endDate } = req.query

    // Build aggregation pipeline
    const pipeline = []

    // Match stage: only completed transactions, filter by date range
    const matchStage = {
      status: "completed",
    }

    if (startDate || endDate) {
      matchStage.date = {}
      if (
        startDate &&
        typeof startDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ) {
        matchStage.date.$gte = startDate
      }
      if (
        endDate &&
        typeof endDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        matchStage.date.$lte = endDate
      }
      if (Object.keys(matchStage.date).length === 0) {
        delete matchStage.date
      }
    }

    pipeline.push({ $match: matchStage })

    // Group by user and transaction type
    pipeline.push({
      $group: {
        _id: "$userId",
        totalAmount: { $sum: "$amount" },
        income: {
          $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
        },
        expense: {
          $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
        },
        transactionCount: { $sum: 1 },
      },
    })

    // Lookup user details to get name, email, currency
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    })

    // Unwind user array
    pipeline.push({
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    })

    // Sort by total expense descending (highest spenders first)
    pipeline.push({ $sort: { expense: -1 } })

    // Limit results
    pipeline.push({ $limit: limit })

    // Project final shape
    pipeline.push({
      $project: {
        _id: 0,
        userId: "$_id",
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
        currency: "$user.currency",
        totalAmount: 1,
        income: 1,
        expense: 1,
        transactionCount: 1,
      },
    })

    const results = await Transaction.aggregate(pipeline)

    // Calculate summary
    const summary = {
      totalUsers: results.length,
      totalTransactions: results.reduce(
        (sum, r) => sum + r.transactionCount,
        0,
      ),
      totalAmount: results.reduce((sum, r) => sum + r.totalAmount, 0),
      totalIncome: results.reduce((sum, r) => sum + r.income, 0),
      totalExpense: results.reduce((sum, r) => sum + r.expense, 0),
    }

    return res.status(200).json({
      data: results,
      summary,
    })
  } catch (error) {
    return next(error)
  }
}
