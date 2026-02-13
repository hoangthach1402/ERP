import express from 'express';
import { isAuthenticated, hasRole, authenticateToken } from '../middleware/auth.js';
import {
  getPurchasingDashboard,
  confirmPurchase,
  markAsDelivered,
  getRequestDetail,
  sendMessage,
  createRequest
} from '../controllers/purchasingController.js';

const router = express.Router();

// Dashboard thu mua - yêu cầu role THU_MUA hoặc ADMIN
router.get('/dashboard', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), getPurchasingDashboard);

// Xác nhận đã mua - yêu cầu role THU_MUA hoặc ADMIN
router.post('/confirm', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), confirmPurchase);

// Đánh dấu đã giao hàng - yêu cầu role THU_MUA hoặc ADMIN
router.post('/delivered', isAuthenticated, hasRole('THU_MUA', 'ADMIN'), markAsDelivered);

// Tạo yêu cầu vật liệu từ worker dashboard
router.post('/request/create', authenticateToken, createRequest);

// Xem chi tiết yêu cầu
router.get('/request/:requestId', isAuthenticated, getRequestDetail);

// Gửi bình luận
router.post('/request/:requestId/message', isAuthenticated, sendMessage);

export default router;
