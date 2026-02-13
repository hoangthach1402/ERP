import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as workflowController from '../controllers/workflowController.js';

const router = express.Router();

// Tất cả routes đều yêu cầu authentication
router.use(authenticateToken);

// ============ QUERY ROUTES (Place before POST/DELETE) ============

// Lấy danh sách workers có sẵn (admin hoặc leader)
router.get('/available-workers/:productId/:stageId', workflowController.getAvailableWorkers);

// Lấy workers đã được assign vào stage
router.get('/assigned-workers/:productId/:stageId', workflowController.getAssignedWorkers);

// ============ VIEW ROUTES ============

// Multi-Stage Dashboard (Admin)
router.get('/multi-stage-dashboard', workflowController.renderMultiStageDashboard);

// Worker Dashboard
router.get('/worker-dashboard', workflowController.renderWorkerDashboard);

// Product Stage Details
router.get('/product/:productId/detail', workflowController.renderProductStageDetails);

// ============ ADMIN/MANAGER ROUTES ============

// Gán stage cho product (có thể gán nhiều stage cùng lúc)
router.post('/assign-stages', workflowController.assignStageToProduct);

// Gán workers vào stage
router.post('/assign-workers', workflowController.assignWorkersToStage);

// Xóa worker khỏi stage
router.delete('/remove-worker', workflowController.removeWorker);

// Đánh dấu stage hoàn thành (admin)
router.post('/complete-stage', workflowController.completeStage);

// Tạm dừng stage (admin)
router.post('/pause-stage', workflowController.pauseStage);

// ============ WORKER ROUTES ============

// Bắt đầu làm việc
router.post('/start-work', workflowController.startWork);

// Hoàn thành công việc
router.post('/complete-work', workflowController.completeWork);

// Tạm dừng công việc
router.post('/pause-work', workflowController.pauseWork);

// Lấy công việc của user hiện tại
router.get('/my-tasks', workflowController.getMyTasks);

// Lấy tất cả users (for admin to assign workers)
router.get('/users', workflowController.getAllUsers);

// ============ DETAILED QUERY ROUTES ============

// Lấy tổng quan multi-stage (dashboard admin)
router.get('/overview', workflowController.getMultiStageOverview);

// Lấy active stages của một product
router.get('/product/:productId/active-stages', workflowController.getProductActiveStages);

// Lấy tất cả workers của một product
router.get('/product/:productId/workers', workflowController.getProductWorkers);

// Lấy workers của một product-stage cụ thể
router.get('/product/:productId/stage/:stageId/workers', workflowController.getStageWorkers);

// Lấy thống kê workers theo stage
router.get('/stage/:stageId/workers/stats', workflowController.getStageWorkersStats);

// Lấy chi tiết tất cả stages của một product
router.get('/product/:productId/stages/detail', workflowController.getProductStagesDetail);

// Lấy tổng hợp tiến độ từng bộ phận (department) của một product
router.get('/product/:productId/department-stats', workflowController.getProductDepartmentStats);

// Cập nhật định mức giờ (norm_hours) cho stage
router.post('/product/:productId/stage/:stageId/update-norm-hours', workflowController.updateStageNormHours);

export default router;
