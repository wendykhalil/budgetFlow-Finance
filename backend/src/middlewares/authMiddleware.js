const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function findActiveUserFromToken(token) {
  if (!process.env.JWT_SECRET || typeof token !== 'string' || !token) {
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }

  if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
    return null;
  }

  const user = await User.findById(payload.sub);
  return user?.status === 'active' ? user : null;
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Authentication is not configured.' });
  }

  try {
    const user = await findActiveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAuth;
module.exports.findActiveUserFromToken = findActiveUserFromToken;
