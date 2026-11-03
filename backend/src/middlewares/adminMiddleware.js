const requireAuth = require("./authMiddleware")

/**
 * Middleware to require admin role.
 * Must be used after requireAuth middleware.
 * Validates that authenticated user has admin role.
 * Never trusts client-supplied role data.
 */
async function requireAdmin(req, res, next) {
  // First ensure user is authenticated (requireAuth should have been called first)
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." })
  }

  // Validate user has admin role
  // Role is sourced from database (req.user), never from client input
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." })
  }

  return next()
}

module.exports = requireAdmin
