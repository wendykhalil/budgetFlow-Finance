const Budget = require("../models/Budget")

const Notification = require("../models/Notification")

const { getBudgetSpending } = require("../utils/budgetSpending")

const TRANSACTION_NOTIFICATION_DETAILS = {
  transaction_created: {
    title: "Nouvelle transaction",

    action: "created",
  },

  transaction_updated: {
    title: "Transaction modifiée",

    action: "updated",
  },

  transaction_deleted: {
    title: "Transaction supprimée",

    action: "deleted",
  },
}

function serializeNotification(notification) {
  return JSON.parse(JSON.stringify(notification))
}

async function createAndEmitNotification(data, io) {
  const notification = new Notification(data)

  await notification.validate()

  await notification.save()

  if (io) {
    try {
      io.to(`user:${notification.userId.toString()}`).emit(
        "notification:created",

        serializeNotification(notification),
      )
    } catch (error) {
      console.error("[notifications] Socket.IO emission failed.", error)
    }
  }

  return notification
}

async function createNotificationBestEffort(data, io) {
  try {
    return await createAndEmitNotification(data, io)
  } catch (error) {
    console.error("[notifications] Notification persistence failed.", error)

    return null
  }
}

function createTransactionNotificationData(transaction, type, currency) {
  const details = TRANSACTION_NOTIFICATION_DETAILS[type]

  if (!details) {
    throw new Error(`Unsupported transaction notification type: ${type}`)
  }

  const description = transaction.description || "Transaction"

  const amount = new Intl.NumberFormat("en", {
    style: "currency",

    currency,
  }).format(transaction.amount)

  return {
    userId: transaction.userId,

    type,

    title: details.title,

    message: `Your ${transaction.type} transaction "${description}" for ${amount} was ${details.action}.`,

    relatedId: transaction._id,

    relatedType: "transaction",
  }
}

function getAffectedBudgetPeriods(transactions) {
  const periods = new Map()

  for (const transaction of transactions) {
    if (
      !transaction ||
      transaction.type !== "expense" ||
      transaction.status !== "completed" ||
      !transaction.categoryId ||
      typeof transaction.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
    ) {
      continue
    }

    const userId = transaction.userId.toString()

    const categoryId = transaction.categoryId.toString()

    const month = transaction.date.slice(0, 7)

    const key = `${userId}:${categoryId}:${month}`

    periods.set(key, {
      userId,

      categoryId,

      month,
    })
  }

  return periods.values()
}

async function createBudgetAlertIfAbsent(budget, month, spending, type, io) {
  const dedupeKey = [
    budget.userId.toString(),

    budget._id.toString(),

    month,

    type,
  ].join(":")

  await Notification.init()

  const existing = await Notification.exists({ dedupeKey })

  if (existing) return null

  const title =
    type === "budget_warning" ? "Budget bientôt atteint" : "Budget dépassé"

  const notification = {
    userId: budget.userId,

    type,

    title,

    message: `${budget.name}: ${spending.percentUsed.toFixed(2)}% of the budget was used during ${month}.`,

    relatedId: budget._id,

    relatedType: "budget",

    dedupeKey,
  }

  try {
    return await createAndEmitNotification(notification, io)
  } catch (error) {
    if (error.code === 11000) return null

    throw error
  }
}

async function processBudgetAlertsForTransactions(transactions, io) {
  for (const { userId, categoryId, month } of getAffectedBudgetPeriods(
    transactions,
  )) {
    try {
      const budget = await Budget.findOne({
        userId,

        categoryId,

        period: "monthly",

        startDate: `${month}-01`,
      })

      if (!budget) continue

      const spending = await getBudgetSpending(budget)

      if (spending.status === "warning") {
        await createBudgetAlertIfAbsent(
          budget,

          month,

          spending,

          "budget_warning",

          io,
        )
      } else if (spending.status === "exceeded") {
        await createBudgetAlertIfAbsent(
          budget,

          month,

          spending,

          "budget_exceeded",

          io,
        )
      }
    } catch (error) {
      console.error(
        `[notifications] Budget alert evaluation failed for ${categoryId} in ${month}.`,

        error,
      )
    }
  }
}

module.exports = {
  createNotificationBestEffort,

  createTransactionNotificationData,

  processBudgetAlertsForTransactions,
}
