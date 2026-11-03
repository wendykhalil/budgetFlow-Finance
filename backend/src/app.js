const express = require("express")

const cors = require("cors")

const helmet = require("helmet")

const healthRoutes = require("./routes/healthRoutes")

const authRoutes = require("./routes/authRoutes")

const transactionRoutes = require("./routes/transactionRoutes")

const analyticsRoutes = require("./routes/analyticsRoutes")

const budgetRoutes = require("./routes/budgetRoutes")

const categoryRoutes = require("./routes/categoryRoutes")

const notificationRoutes = require("./routes/notificationRoutes")

const adminRoutes = require("./routes/adminRoutes")

const { getAllowedOrigins } = require("./config/environment")

const notFoundMiddleware = require("./middlewares/notFoundMiddleware")

const errorMiddleware = require("./middlewares/errorMiddleware")

const app = express()

const allowedOrigins = getAllowedOrigins()

app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        const error = new Error("Origin is not allowed by CORS.")

        error.statusCode = 403

        callback(error)
      }
    },
  }),
)

app.use(express.json({ limit: "10kb" }))

app.use("/api", healthRoutes)

app.use("/api/auth", authRoutes)

app.use("/api/transactions", transactionRoutes)

app.use("/api/analytics", analyticsRoutes)

app.use("/api/budgets", budgetRoutes)

app.use("/api/categories", categoryRoutes)

app.use("/api/notifications", notificationRoutes)

app.use("/api/admin", adminRoutes)

app.use(notFoundMiddleware)

app.use(errorMiddleware)

module.exports = app
