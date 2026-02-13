import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { validateUserCreation, validateRoleUpdate, validateUserDeactivation } from '../middleware/validation.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, authorizeRole('ADMIN'), adminController.getAdminDashboard);
router.post('/user/create', authenticateToken, authorizeRole('ADMIN'), validateUserCreation, adminController.createUser);
router.post('/user/update-role', authenticateToken, authorizeRole('ADMIN'), validateRoleUpdate, adminController.updateUserRole);
router.post('/user/deactivate', authenticateToken, authorizeRole('ADMIN'), validateUserDeactivation, adminController.deactivateUser);
router.post('/stage/create', authenticateToken, authorizeRole('ADMIN'), adminController.createStage);
router.post('/stage/update', authenticateToken, authorizeRole('ADMIN'), adminController.updateStage);
router.post('/stage/delete', authenticateToken, authorizeRole('ADMIN'), adminController.deleteStage);
router.post('/stage/reorder', authenticateToken, authorizeRole('ADMIN'), adminController.reorderStages);

export default router;
