const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      required: true,
    },

    type: {
      type: String,

      enum: [
        "transaction_created",

        "transaction_updated",

        "transaction_deleted",

        "budget_warning",

        "budget_exceeded",
      ],

      required: true,
    },

    title: { type: String, required: true, trim: true },

    message: { type: String, required: true, trim: true },

    isRead: { type: Boolean, default: false },

    relatedId: { type: mongoose.Schema.Types.ObjectId },

    relatedType: {
      type: String,

      enum: ["transaction", "budget"],

      trim: true,
    },

    dedupeKey: { type: String, trim: true, select: false },
  },

  { timestamps: true },
)

notificationSchema.index({ userId: 1, createdAt: -1 })

notificationSchema.index({ userId: 1, isRead: 1 })

notificationSchema.index(
  { dedupeKey: 1 },

  { unique: true, sparse: true, name: "unique_notification_dedupe_key" },
)

notificationSchema.set("toJSON", {
  transform(document, result) {
    result.id = result._id.toString()

    delete result._id

    delete result.__v

    delete result.dedupeKey

    return result
  },
})

module.exports = mongoose.model("Notification", notificationSchema)
