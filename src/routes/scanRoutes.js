import express from 'express';
import * as scanController from '../controllers/scanController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/scan', authenticateToken, scanController.scanProduct);
router.post('/start', authenticateToken, scanController.startTask);
router.post('/complete', authenticateToken, scanController.completeTask);
router.post('/pending', authenticateToken, scanController.setPendingTask);

export default router;
