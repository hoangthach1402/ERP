import express from 'express';
import * as productController from '../controllers/productController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, productController.getDashboard);
router.get('/:productId', authenticateToken, productController.getProductDetail);
router.post('/create', authenticateToken, productController.createProduct);

export default router;
