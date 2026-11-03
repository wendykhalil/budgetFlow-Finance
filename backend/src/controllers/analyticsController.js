const Transaction = require("../models/Transaction")

/**
 * Parse et valide une période au format YYYY-MM ou YYYY-MM-DD
 * @param {string} period - Format YYYY-MM ou YYYY-MM-DD
 * @returns {object} { startDate, endDate } en format YYYY-MM-DD
 */
function parsePeriod(period) {
  if (!period || typeof period !== "string") {
    throw new Error("Period must be a string.")
  }

  const match = period.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) {
    throw new Error("Period must be in YYYY-MM or YYYY-MM-DD format.")
  }

  const [, year, month, day] = match

  if (parseInt(month, 10) < 1 || parseInt(month, 10) > 12) {
    throw new Error("Month must be between 01 and 12.")
  }

  if (day && (parseInt(day, 10) < 1 || parseInt(day, 10) > 31)) {
    throw new Error("Day must be between 01 and 31.")
  }

  const startDate = day ? `${year}-${month}-${day}` : `${year}-${month}-01`
  let endDate

  if (day) {
    // Pour un jour spécifique, fin = même jour
    endDate = `${year}-${month}-${day}`
  } else {
    // Pour un mois, fin = dernier jour du mois
    const nextMonth = new Date(parseInt(year), parseInt(month), 0)
    endDate = `${year}-${month}-${String(nextMonth.getDate()).padStart(2, "0")}`
  }

  return { startDate, endDate }
}

/**
 * Calcul des statistiques mensuelles sur 6 mois
 * @param {string} userId - ID utilisateur
 * @returns {array} Données pour BarChart [{ month, income, expense }, ...]
 */
async function getMonthlyBalance(userId) {
  const today = new Date()
  // Utiliser une approche indépendante du fuseau horaire
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() // 0-indexed

  // Calculer le début des 6 derniers mois
  let startMonth = currentMonth - 5
  let startYear = currentYear
  if (startMonth < 0) {
    startYear -= 1
    startMonth += 12
  }

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, "0")}-01`

  const transactions = await Transaction.find({
    userId,
    date: { $gte: startDateStr },
    status: "completed",
  })

  // Grouper par mois YYYY-MM
  const monthlyMap = {}

  transactions.forEach((tx) => {
    const yearMonth = tx.date.substring(0, 7) // YYYY-MM
    if (!monthlyMap[yearMonth]) {
      monthlyMap[yearMonth] = { income: 0, expense: 0 }
    }

    if (tx.type === "income") {
      monthlyMap[yearMonth].income += tx.amount
    } else if (tx.type === "expense") {
      monthlyMap[yearMonth].expense += tx.amount
    }
  })

  // Générer tous les mois des 6 derniers mois, même s'il n'y a pas de données
  const result = []
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]

  for (let i = 0; i < 6; i++) {
    let monthIdx = startMonth + i
    let yearIdx = startYear
    if (monthIdx >= 12) {
      monthIdx -= 12
      yearIdx += 1
    }

    const yearMonth = `${yearIdx}-${String(monthIdx + 1).padStart(2, "0")}`
    const monthName = monthNames[monthIdx]

    result.push({
      month: monthName,
      income: Math.round((monthlyMap[yearMonth]?.income || 0) * 100) / 100,
      expense: Math.round((monthlyMap[yearMonth]?.expense || 0) * 100) / 100,
    })
  }

  return result
}

/**
 * Calcul des dépenses par catégorie pour le mois courant
 * @param {string} userId - ID utilisateur
 * @returns {array} Données pour DonutChart [{ name, value, color }, ...]
 */
async function getMonthlyExpensesByCategory(userId) {
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const startDate = currentMonthStart.toISOString().split("T")[0]
  const endDate = currentMonthEnd.toISOString().split("T")[0]

  const transactions = await Transaction.find({
    userId,
    type: "expense",
    date: { $gte: startDate, $lte: endDate },
    status: "completed",
  })

  // Grouper par catégorie
  const categoryMap = {}

  transactions.forEach((tx) => {
    const category = tx.category || "Other"
    if (!categoryMap[category]) {
      categoryMap[category] = 0
    }
    categoryMap[category] += tx.amount
  })

  // Trier par montant décroissant et prendre les 5 premiers
  const sortedEntries = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Palette de couleurs prédéfinie
  const colors = ["#155C4F", "#4E9B8D", "#F3A852", "#E87171", "#7B83C6"]

  const result = sortedEntries.map(([category, amount], index) => ({
    name: category,
    value: Math.round(amount * 100) / 100,
    color: colors[index] || "#CBD5E1",
  }))

  // Si aucune dépense, retourner vide
  if (result.length === 0) {
    return []
  }

  return result
}

/**
 * Calcul des revenus par catégorie pour le mois courant
 * @param {string} userId - ID utilisateur
 * @returns {array} Données pour DonutChart [{ name, value, color }, ...]
 */
async function getMonthlyIncomeByCategory(userId) {
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const startDate = currentMonthStart.toISOString().split("T")[0]
  const endDate = currentMonthEnd.toISOString().split("T")[0]

  const transactions = await Transaction.find({
    userId,
    type: "income",
    date: { $gte: startDate, $lte: endDate },
    status: "completed",
  })

  // Grouper par catégorie
  const categoryMap = {}

  transactions.forEach((tx) => {
    const category = tx.category || "Other"
    if (!categoryMap[category]) {
      categoryMap[category] = 0
    }
    categoryMap[category] += tx.amount
  })

  // Trier par montant décroissant
  const sortedEntries = Object.entries(categoryMap).sort(
    ([, a], [, b]) => b - a,
  )

  // Palette de couleurs pour income
  const colors = ["#277666", "#2563eb", "#7c3aed", "#ec4899", "#f59e0b"]

  const result = sortedEntries.map(([category, amount], index) => ({
    name: category,
    value: Math.round(amount * 100) / 100,
    color: colors[index] || "#CBD5E1",
  }))

  // Si aucun revenu, retourner vide
  if (result.length === 0) {
    return []
  }

  return result
}

/**
 * Calcul des insights : comparaison mois/mois, top dépense, taux d'épargne
 * @param {string} userId - ID utilisateur
 * @returns {object} { monthOverMonthChange, topSpendingCategory, savingsRate }
 */
async function getInsights(userId) {
  const today = new Date()

  // Mois courant
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const currentStartDate = currentMonthStart.toISOString().split("T")[0]
  const currentEndDate = currentMonthEnd.toISOString().split("T")[0]

  // Mois précédent
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const lastStartDate = lastMonthStart.toISOString().split("T")[0]
  const lastEndDate = lastMonthEnd.toISOString().split("T")[0]

  // Transactions mois courant
  const currentTransactions = await Transaction.find({
    userId,
    date: { $gte: currentStartDate, $lte: currentEndDate },
    status: "completed",
  })

  // Transactions mois précédent
  const lastTransactions = await Transaction.find({
    userId,
    date: { $gte: lastStartDate, $lte: lastEndDate },
    status: "completed",
  })

  // Calcul mois courant
  let currentExpense = 0
  let currentIncome = 0
  const currentCategoryExpense = {}

  currentTransactions.forEach((tx) => {
    if (tx.type === "income") {
      currentIncome += tx.amount
    } else {
      currentExpense += tx.amount
      const category = tx.category || "Other"
      currentCategoryExpense[category] =
        (currentCategoryExpense[category] || 0) + tx.amount
    }
  })

  // Calcul mois précédent
  let lastExpense = 0

  lastTransactions.forEach((tx) => {
    if (tx.type === "expense") {
      lastExpense += tx.amount
    }
  })

  // Month-over-month change en dépenses
  let monthOverMonthChange = 0
  if (lastExpense > 0) {
    monthOverMonthChange =
      Math.round(((lastExpense - currentExpense) / lastExpense) * 100 * 10) / 10
  } else if (currentExpense > 0) {
    monthOverMonthChange = -100
  }

  // Top spending category
  const topSpendingCategory =
    Object.entries(currentCategoryExpense).length > 0
      ? Object.entries(currentCategoryExpense).sort(
          ([, a], [, b]) => b - a,
        )[0][0]
      : null

  // Savings rate = (Income - Expense) / Income * 100
  let savingsRate = 0
  if (currentIncome > 0) {
    savingsRate =
      Math.round(
        ((currentIncome - currentExpense) / currentIncome) * 100 * 10,
      ) / 10
  }

  return {
    monthOverMonthChange,
    topSpendingCategory,
    topSpendingAmount: currentCategoryExpense[topSpendingCategory] || 0,
    savingsRate: Math.max(0, savingsRate), // Minimum 0%
  }
}

/**
 * Endpoint : GET /api/analytics
 * Retourne toutes les données Analytics pour l'utilisateur authentifié
 */
async function getAnalytics(req, res, next) {
  try {
    const userId = req.user.id

    const [monthlyBalance, expensesByCategory, incomeByCategory, insights] =
      await Promise.all([
        getMonthlyBalance(userId),
        getMonthlyExpensesByCategory(userId),
        getMonthlyIncomeByCategory(userId),
        getInsights(userId),
      ])

    res.status(200).json({
      monthlyBalance,
      expensesByCategory,
      incomeByCategory,
      insights,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAnalytics,
  parsePeriod,
  getMonthlyBalance,
  getMonthlyExpensesByCategory,
  getMonthlyIncomeByCategory,
  getInsights,
}
