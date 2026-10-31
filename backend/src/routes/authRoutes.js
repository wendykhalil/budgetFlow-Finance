const express = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getCurrentUser);
router.patch('/currency', requireAuth, authController.updateCurrency);

module.exports = router;
