import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { validateUserCreation, validateRoleUpdate, validateUserDeactivation } from '../middleware/validation.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, authorizeRole('ADMIN'), adminController.getAdminDashboard);
router.post('/user/create', authenticateToken, authorizeRole('ADMIN'), validateUserCreation, adminController.createUser);
router.post('/user/update-role', authenticateToken, authorizeRole('ADMIN'), validateRoleUpdate, adminController.updateUserRole);
router.post('/user/deactivate', authenticateToken, authorizeRole('ADMIN'), validateUserDeactivation, adminController.deactivateUser);

export default router;
