const mongoose = require("mongoose")

const auditLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE", "READ_EXPORT"],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["User", "Transaction", "Category", "Budget", "Settings"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
)

// Indexes for efficient querying
auditLogSchema.index({ adminUserId: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ targetType: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })

auditLogSchema.set("toJSON", {
  transform(document, result) {
    result.id = result._id.toString()
    delete result._id
    delete result.__v
    return result
  },
})

module.exports = mongoose.model("AdminAuditLog", auditLogSchema)
