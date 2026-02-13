import express from 'express';
import * as productController from '../controllers/productController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', authenticateToken, productController.createProduct);
router.delete('/:productId', authenticateToken, productController.deleteProduct);

export default router;
