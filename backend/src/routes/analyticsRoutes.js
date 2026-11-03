const express = require("express")
const analyticsController = require("../controllers/analyticsController")
const requireAuth = require("../middlewares/authMiddleware")

const router = express.Router()

// Tous les endpoints Analytics requièrent l'authentification
router.use(requireAuth)

// GET /api/analytics - Récupère toutes les données Analytics
router.get("/", analyticsController.getAnalytics)

module.exports = router
