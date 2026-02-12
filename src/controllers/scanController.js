import Product from '../models/Product.js';
import { ProductStageTask, Stage } from '../models/Stage.js';
import ActivityLog from '../models/ActivityLog.js';
import { notifyCompletedProductCat } from '../services/telegramCatNotification.js';

export const getScanPage = async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // Map role to stage ID
    const roleToStage = {
      'RAP': 1,
      'CAT': 2,
      'MAY': 3,
      'THIET_KE': 4,
      'DINH_KET': 5
    };

    const userStageId = roleToStage[userRole] || 0;
    let availableProducts = [];

    // Get products in current stage (except ADMIN)
    if (userRole !== 'ADMIN' && userStageId) {
      try {
        availableProducts = await Product.getProductsByStage(userStageId) || [];
      } catch (error) {
        console.error('Error fetching products by stage:', error);
        availableProducts = [];
      }
    } else if (userRole === 'ADMIN') {
      // Admin can see all products
      try {
        availableProducts = await Product.getAll() || [];
      } catch (error) {
        console.error('Error fetching all products:', error);
        availableProducts = [];
      }
    }

    res.render('scan', {
      user: req.session.user,
      role: req.user.role,
      availableProducts: availableProducts,
      userStageId: userStageId
    });
  } catch (error) {
    console.error('Scan page error:', error);
    res.status(500).render('error', { error: 'Error loading scan page' });
  }
};

export const scanProduct = async (req, res) => {
  try {
    const { productCode } = req.body;
    const userRole = req.user.role;

    if (!productCode) {
      return res.status(400).json({ error: 'Product code required' });
    }

    const product = await Product.findByCode(productCode);
    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm với mã này' });
    }

    // Map role to stage ID (except ADMIN can see all)
    const roleToStage = {
      'RAP': 1,
      'CAT': 2,
      'MAY': 3,
      'THIET_KE': 4,
      'DINH_KET': 5
    };

    const userStageId = roleToStage[userRole];

    // Check if user's role matches current product stage (except ADMIN)
    if (userRole !== 'ADMIN' && product.current_stage_id !== userStageId) {
      return res.status(403).json({ 
        error: `Sản phẩm này hiện đang ở khâu "${product.stage_name}", không phải khâu của bạn` 
      });
    }

    const currentTask = await ProductStageTask.findByProductAndStage(product.id, product.current_stage_id);
    
    res.json({
      success: true,
      product: {
        id: product.id,
        code: product.product_code,
        name: product.product_name,
        currentStage: product.stage_name,
        currentStageId: product.current_stage_id,
        status: currentTask?.status || 'pending'
      },
      task: currentTask
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Lỗi khi quét sản phẩm' });
  }
};

export const startTask = async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentTask = await ProductStageTask.findByProductAndStage(product.id, product.current_stage_id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (currentTask.status === 'processing' || currentTask.status === 'completed') {
      return res.status(400).json({ error: 'Task already started or completed' });
    }

    await ProductStageTask.startTask(currentTask.id, req.user.id);
    await Product.updateStatus(productId, 'processing');

    await ActivityLog.log(
      req.user.id,
      'START_TASK',
      { stage: product.stage_name },
      productId,
      product.current_stage_id
    );

    const updatedProduct = await Product.findById(productId);

    res.json({ 
      success: true, 
      message: 'Task started',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const completeTask = async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentTask = await ProductStageTask.findByProductAndStage(product.id, product.current_stage_id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (currentTask.status !== 'processing') {
      return res.status(400).json({ error: 'Task is not currently being processed' });
    }

    await ProductStageTask.completeTask(currentTask.id);

    // Store current stage before moving
    const completedStageId = product.current_stage_id;

    // Move to next stage
    const nextProduct = await Product.moveToNextStage(productId);

    await ActivityLog.log(
      req.user.id,
      'COMPLETE_TASK',
      { stage: product.stage_name },
      productId,
      product.current_stage_id
    );

    // Send notification to BP CẮT when RẬP (stage 1) is completed
    if (completedStageId === 1 && nextProduct.current_stage_id === 2) {
      notifyCompletedProductCat({
        product_code: nextProduct.product_code,
        product_name: nextProduct.product_name
      }).catch(err => console.error('Telegram CAT notification error:', err));
    }

    res.json({
      success: true,
      message: nextProduct.status === 'completed' ? 'Product completed!' : 'Moved to next stage',
      product: nextProduct
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const setPendingTask = async (req, res) => {
  try {
    const { productId, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do thiếu nguyên liệu' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentTask = await ProductStageTask.findByProductAndStage(product.id, product.current_stage_id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (currentTask.status === 'completed') {
      return res.status(400).json({ error: 'Task already completed' });
    }

    const updatedTask = await ProductStageTask.setPending(currentTask.id, req.user.id, reason.trim());
    await Product.updateStatus(productId, 'pending');

    await ActivityLog.log(
      req.user.id,
      'PENDING_MATERIAL',
      { stage: product.stage_name, reason: reason.trim() },
      productId,
      product.current_stage_id
    );

    const updatedProduct = await Product.findById(productId);

    res.json({
      success: true,
      message: 'Đã cập nhật trạng thái chờ nguyên liệu',
      product: updatedProduct,
      task: updatedTask
    });
  } catch (error) {
    console.error('Set pending task error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getScanPage,
  scanProduct,
  startTask,
  completeTask,
  setPendingTask
};
