const { isDatabaseConnected } = require('../config/database');

function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'BudgetFlow API is running.',
  });
}

function getReadiness(req, res) {
  if (isDatabaseConnected()) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
    });
  }
}

module.exports = { getHealth, getReadiness };
