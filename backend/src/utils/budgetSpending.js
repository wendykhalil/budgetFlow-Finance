const Transaction = require("../models/Transaction")

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

function getMonthStartEnd(dateString) {
  if (!isValidDate(dateString)) return null

  const [year, month] = dateString.split("-").map(Number)

  const monthString = month.toString().padStart(2, "0")

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

  return {
    start: `${year}-${monthString}-01`,

    end: `${year}-${monthString}-${daysInMonth[month - 1]}`,
  }
}

async function getBudgetSpending(budget) {
  const period = getMonthStartEnd(budget.startDate)

  if (!period) {
    const error = new Error("Invalid budget start date.")

    error.statusCode = 400

    throw error
  }

  const spentResult = await Transaction.aggregate([
    {
      $match: {
        userId: budget.userId,

        categoryId: budget.categoryId,

        type: "expense",

        status: "completed",

        date: { $gte: period.start, $lte: period.end },
      },
    },

    {
      $group: {
        _id: null,

        total: { $sum: "$amount" },
      },
    },
  ])

  const spent = spentResult.length > 0 ? spentResult[0].total : 0

  const limit = budget.limit

  const remaining = Math.max(0, limit - spent)

  const percentUsed = limit > 0 ? (spent / limit) * 100 : 0

  let status

  if (percentUsed >= 100) {
    status = "exceeded"
  } else if (percentUsed >= 85) {
    status = "warning"
  } else {
    status = "healthy"
  }

  return {
    spent,

    limit,

    remaining,

    percentUsed,

    status,

    periodStart: period.start,

    periodEnd: period.end,
  }
}

module.exports = { getMonthStartEnd, getBudgetSpending }
