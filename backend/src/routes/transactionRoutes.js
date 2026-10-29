const express = require('express');
const transactionController = require('../controllers/transactionController');
const requireAuth = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', transactionController.createTransaction);
router.get('/', transactionController.listTransactions);
router.get('/:id', transactionController.getTransaction);
router.patch('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
