const express = require("express")

const notificationController = require("../controllers/notificationController")

const requireAuth = require("../middlewares/authMiddleware")

const router = express.Router()

router.use(requireAuth)

router.get("/unread-count", notificationController.getUnreadCount)

router.get("/", notificationController.listNotifications)

router.patch("/read-all", notificationController.markAllAsRead)

router.patch("/:id/read", notificationController.markAsRead)

router.delete("/:id", notificationController.deleteNotification)

module.exports = router
