const express = require("express")
const adminController = require("../controllers/adminController")
const requireAuth = require("../middlewares/authMiddleware")
const requireAdmin = require("../middlewares/adminMiddleware")

const router = express.Router()

// Apply auth and admin middlewares to all routes
router.use(requireAuth)
router.use(requireAdmin)

// User management routes
router.get("/users", adminController.listUsers)
router.get("/users/:id", adminController.getUser)
router.patch("/users/:id/status", adminController.updateUserStatus)

// Transaction monitoring routes
router.get("/transactions", adminController.listTransactions)

// Reporting routes
router.get(
  "/reports/transactions-by-category",
  adminController.getTransactionsByCategoryReport,
)
router.get("/reports/user-spending", adminController.getUserSpendingReport)

module.exports = router
