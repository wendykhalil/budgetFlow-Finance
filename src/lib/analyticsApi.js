import { apiRequest } from "./api"

/**
 * Récupère toutes les données Analytics pour l'utilisateur authentifié
 * @param {AbortSignal} signal - Signal d'annulation
 * @returns {Promise} { monthlyBalance, expensesByCategory, incomeByCategory, insights }
 */
export async function getAnalytics(options = {}) {
  return apiRequest("/analytics", {
    method: "GET",
    ...options,
  })
}

/**
 * Structure attendue:
 * {
 *   monthlyBalance: [
 *     { month: "May", income: 72, expense: 105 },
 *     { month: "Jun", income: 64, expense: 115 },
 *     ...
 *   ],
 *   expensesByCategory: [
 *     { name: "Housing", value: 750, color: "#155C4F" },
 *     { name: "Food", value: 420, color: "#4E9B8D" },
 *     ...
 *   ],
 *   incomeByCategory: [
 *     { name: "Salary", value: 3850, color: "#277666" },
 *     { name: "Freelance", value: 650, color: "#2563eb" },
 *     { name: "Investments", value: 450, color: "#7c3aed" },
 *   ],
 *   insights: {
 *     monthOverMonthChange: -8.2,  // % (negative = decreased)
 *     topSpendingCategory: "Housing",
 *     topSpendingAmount: 750,
 *     savingsRate: 44,  // %
 *   }
 * }
 */
