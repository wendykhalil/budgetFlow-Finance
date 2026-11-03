const express = require("express")
const authController = require("../controllers/authController")
const requireAuth = require("../middlewares/authMiddleware")
const {
  loginRateLimiter,
  registerRateLimiter,
} = require("../middlewares/authRateLimiters")

const router = express.Router()

router.post("/register", registerRateLimiter, authController.register)
router.post("/login", loginRateLimiter, authController.login)
router.get("/me", requireAuth, authController.getCurrentUser)
router.patch("/currency", requireAuth, authController.updateCurrency)
router.patch("/profile", requireAuth, authController.updateProfile)

module.exports = router
