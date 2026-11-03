const mongoose = require("mongoose")

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      required: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "Category",

      required: true,
    },

    name: {
      type: String,

      required: true,

      trim: true,

      maxlength: 80,
    },

    limit: {
      type: Number,

      required: true,

      min: 0.01,
    },

    period: {
      type: String,

      enum: ["monthly"],

      default: "monthly",
    },

    startDate: {
      type: String,

      required: true,

      validate: {
        validator: function (value) {
          return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        },

        message: "Start date must be a valid YYYY-MM-DD date.",
      },
    },

    color: {
      type: String,

      trim: true,

      validate: {
        validator: function (value) {
          return (
            value === undefined ||
            /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
          )
        },

        message: "Color must be a valid hexadecimal color.",
      },
    },

    icon: {
      type: String,

      trim: true,

      maxlength: 64,

      validate: {
        validator: function (value) {
          return value === undefined || /^[a-zA-Z0-9_-]+$/.test(value)
        },

        message:
          "Icon must contain only letters, numbers, underscores, or hyphens.",
      },
    },
  },

  { timestamps: true },
)

budgetSchema.index(
  { userId: 1, categoryId: 1, period: 1, startDate: 1 },

  { unique: true, name: "unique_owner_category_period_month" },
)

budgetSchema.pre("validate", async function (next) {
  if (!this.isNew && this.isModified("categoryId")) {
    return next()
  }

  if (this.categoryId) {
    const Category = require("./Category")

    const category = await Category.findById(this.categoryId)
      .select("type isArchived userId")
      .lean()

    if (!category) {
      const error = new Error("Category not found.")

      error.statusCode = 404

      return next(error)
    }

    if (category.userId.toString() !== this.userId.toString()) {
      const error = new Error(
        "Category does not belong to the authenticated user.",
      )

      error.statusCode = 403

      return next(error)
    }

    if (category.type !== "expense") {
      const error = new Error(
        "Budget can only be created for expense categories.",
      )

      error.statusCode = 400

      return next(error)
    }

    if (category.isArchived) {
      const error = new Error(
        "Archived categories cannot be used for new budgets.",
      )

      error.statusCode = 409

      return next(error)
    }

    this.category = category.name
  }
})

budgetSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Category = require("./Category")

    const category = await Category.findById(this.categoryId)
      .select("type isArchived userId")
      .lean()

    if (!category) {
      const error = new Error("Category not found.")

      error.statusCode = 404

      return next(error)
    }

    if (category.userId.toString() !== this.userId.toString()) {
      const error = new Error(
        "Category does not belong to the authenticated user.",
      )

      error.statusCode = 403

      return next(error)
    }

    if (category.type !== "expense") {
      const error = new Error(
        "Budget can only be created for expense categories.",
      )

      error.statusCode = 400

      return next(error)
    }

    if (category.isArchived) {
      const error = new Error(
        "Archived categories cannot be used for new budgets.",
      )

      error.statusCode = 409

      return next(error)
    }

    this.category = category.name
  }
})

budgetSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("startDate") || this.isModified("period")) {
    const startDate = new Date(`${this.startDate}T00:00:00.000Z`)

    if (isNaN(startDate.getTime())) {
      const error = new Error("Start date must be a valid calendar date.")

      error.statusCode = 400

      return next(error)
    }

    const day = startDate.getUTCDate()

    if (day !== 1) {
      const error = new Error(
        "For monthly budgets, start date must be the first day of the month (YYYY-MM-01).",
      )

      error.statusCode = 400

      return next(error)
    }

    const month = startDate.getUTCMonth() + 1

    if (month < 1 || month > 12) {
      const error = new Error("Invalid month in start date.")

      error.statusCode = 400

      return next(error)
    }

    const year = startDate.getUTCFullYear()

    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

    const daysInMonth = [
      31,
      isLeapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ]

    if (day < 1 || day > daysInMonth[month - 1]) {
      const error = new Error(
        "Invalid day for the specified month in start date.",
      )

      error.statusCode = 400

      return next(error)
    }
  }

  next()
})

budgetSchema.set("toJSON", {
  transform(document, result) {
    result.id = result._id.toString()

    delete result._id

    delete result.__v

    return result
  },
})

module.exports = mongoose.model("Budget", budgetSchema)
