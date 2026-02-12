import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.get('/', authController.loginPage);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

export default router;
