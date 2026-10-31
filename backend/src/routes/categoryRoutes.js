const express = require('express');
const categoryController = require('../controllers/categoryController');
const requireAuth = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', categoryController.listCategories);
router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
