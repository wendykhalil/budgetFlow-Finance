const express = require("express")

const budgetController = require("../controllers/budgetController")

const requireAuth = require("../middlewares/authMiddleware")

const router = express.Router()

router.use(requireAuth)

router.get("/", budgetController.listBudgets)

router.post("/", budgetController.createBudget)

router.get("/:id", budgetController.getBudget)

router.patch("/:id", budgetController.updateBudget)

router.delete("/:id", budgetController.deleteBudget)

router.get("/:id/spent", budgetController.getBudgetSpent)

module.exports = router
