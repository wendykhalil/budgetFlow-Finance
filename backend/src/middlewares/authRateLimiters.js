const { rateLimit } = require("express-rate-limit")

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: { message: "Too many login attempts. Please try again later." },
})

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
})

module.exports = { loginRateLimiter, registerRateLimiter }
