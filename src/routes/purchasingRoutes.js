import express from 'express';
import { isAuthenticated, hasRole } from '../middleware/auth.js';
import {
  getPurchasingDashboard,
  confirmPurchase,
  markAsDelivered,
  getRequestDetail,
  sendMessage
} from '../controllers/purchasingController.js';

const router = express.Router();

// Dashboard thu mua - yêu cầu role THU_MUA hoặc ADMIN
router.get('/dashboard', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), getPurchasingDashboard);

// Xác nhận đã mua - yêu cầu role THU_MUA hoặc ADMIN
router.post('/confirm', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), confirmPurchase);

// Đánh dấu đã giao hàng - yêu cầu role THU_MUA hoặc ADMIN
router.post('/delivered', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), markAsDelivered);

// Xem chi tiết yêu cầu
router.get('/request/:requestId', isAuthenticated, getRequestDetail);

// Gửi bình luận
router.post('/request/:requestId/message', isAuthenticated, sendMessage);

export default router;
