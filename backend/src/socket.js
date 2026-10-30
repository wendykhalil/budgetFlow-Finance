const { Server } = require('socket.io');
const { findActiveUserFromToken } = require('./middlewares/authMiddleware');

function getAllowedOrigins() {
  return (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function attachSocketServer(httpServer, app) {
  const allowedOrigins = getAllowedOrigins();
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin is not allowed by CORS.'));
        }
      },
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    try {
      const user = await findActiveUserFromToken(token);
      if (!user) {
        const error = new Error('Authentication required.');
        error.data = { code: 'AUTH_REQUIRED' };
        return next(error);
      }
      socket.data.userId = user.id;
      return next();
    } catch {
      const error = new Error('Authentication service unavailable.');
      error.data = { code: 'AUTH_UNAVAILABLE' };
      return next(error);
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  app.set('io', io);
  return io;
}

module.exports = { attachSocketServer };
