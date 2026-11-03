const mongoose = require("mongoose")

const Notification = require("../models/Notification")

const DEFAULT_PAGE = 1

const DEFAULT_LIMIT = 20

const MAX_LIMIT = 100

function parsePositiveInteger(value, fallback) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback

  const parsed = Number(value)

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isValidId(id) {
  return mongoose.isValidObjectId(id)
}

async function listNotifications(req, res, next) {
  try {
    const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE)

    const limit = Math.min(
      parsePositiveInteger(req.query.limit, DEFAULT_LIMIT),

      MAX_LIMIT,
    )

    const skip = (page - 1) * limit

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({ message: "Invalid pagination parameters." })
    }

    const filter = { userId: req.user.id }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)

        .sort({ createdAt: -1, _id: -1 })

        .skip(skip)

        .limit(limit),

      Notification.countDocuments(filter),
    ])

    return res.status(200).json({
      notifications,

      pagination: {
        page,

        limit,

        total,

        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return next(error)
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,

      isRead: false,
    })

    return res.status(200).json({ unreadCount })
  } catch (error) {
    return next(error)
  }
}

async function markAsRead(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Notification not found." })
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },

      { $set: { isRead: true } },

      { new: true, runValidators: true },
    )

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." })
    }

    return res.status(200).json({ notification })
  } catch (error) {
    return next(error)
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },

      { $set: { isRead: true } },
    )

    return res.status(200).json({ modifiedCount: result.modifiedCount })
  } catch (error) {
    return next(error)
  }
}

async function deleteNotification(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Notification not found." })
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,

      userId: req.user.id,
    })

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." })
    }

    return res.status(200).json({ message: "Notification deleted." })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listNotifications,

  getUnreadCount,

  markAsRead,

  markAllAsRead,

  deleteNotification,
}
