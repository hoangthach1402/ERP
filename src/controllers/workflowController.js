import { ProductActiveStage } from '../models/ProductActiveStage.js';
import { ProductStageWorker } from '../models/ProductStageWorker.js';
import { Product } from '../models/Product.js';
import { Stage } from '../models/Stage.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { MaterialRequest } from '../models/MaterialRequest.js';
import { ExportRecord } from '../models/ExportRecord.js';
import { InboundRecord } from '../models/InboundRecord.js';
import { Warehouse } from '../models/Warehouse.js';
import User from '../models/User.js';
import { dbGet, dbAll, dbRun } from '../models/database.js';

/**
 * Controller quản lý công việc Multi-Stage và Multi-Worker
 */

// ============ VIEW RENDERING ROUTES ============

/**
 * Render Multi-Stage Dashboard (Admin)
 */
export const renderMultiStageDashboard = async (req, res) => {
  try {
    res.render('workflow/multi-stage-dashboard', {
      title: 'Multi-Stage Workflow Dashboard',
      user: req.user,
      token: req.token
    });
  } catch (error) {
    console.error('Error rendering multi-stage dashboard:', error);
    res.status(500).render('error', { error: error.message });
  }
};

/**
 * Render Worker Dashboard
 */
export const renderWorkerDashboard = async (req, res) => {
  try {
    res.render('workflow/worker-dashboard', {
      title: 'My Tasks Dashboard',
      user: req.user,
      token: req.token
    });
  } catch (error) {
    console.error('Error rendering worker dashboard:', error);
    res.status(500).render('error', { error: error.message });
  }
};

/**
 * Render Product Stage Details (Admin)
 */
export const renderProductStageDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).render('error', { error: 'Product not found' });
    }

    res.render('workflow/product-stage-details', {
      title: `${product.product_code} - Stage Details`,
      user: req.user,
      token: req.token,
      productId: productId
    });
  } catch (error) {
    console.error('Error rendering product stage details:', error);
    res.status(500).render('error', { error: error.message });
  }
};

// ============ API ROUTES ============

/**
 * Gán stage cho product (có thể gán nhiều stage cùng lúc)
 */
export const assignStageToProduct = async (req, res) => {
  try {
    const { productId, stageIds, userIds, stageNorms, allowRework } = req.body;

    if (!productId || !stageIds || !Array.isArray(stageIds)) {
      return res.status(400).json({ error: 'Product ID and stage IDs array required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const results = [];

    for (const stageId of stageIds) {
      const normHours = stageNorms && stageNorms[stageId] ? Number(stageNorms[stageId]) : null;
      // Kích hoạt stage
      const activeStage = await ProductActiveStage.activateStage(productId, stageId, {
        norm_hours: normHours,
        allowRework: Boolean(allowRework)
      });
      
      // Nếu có userIds, gán workers
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        await ProductStageWorker.assignMultipleWorkers(productId, stageId, userIds);
      }

      results.push(activeStage);

      // Log activity
      await ActivityLog.log(
        req.user.id,
        'ASSIGN_STAGE',
        { stage_id: stageId, worker_count: userIds?.length || 0 },
        productId,
        stageId
      );
    }

    res.json({
      success: true,
      message: `Assigned ${stageIds.length} stage(s) to product`,
      data: results
    });

  } catch (error) {
    console.error('Error assigning stages:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gán workers vào stage đang active
 * - Admin: có thể gán bất cứ ai
 * - Leader của stage: có thể gán những người cùng bộ phận
 */
export const assignWorkersToStage = async (req, res) => {
  try {
    const { productId, stageId, userIds } = req.body;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (!productId || !stageId || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'Product ID, stage ID, and user IDs array required' });
    }

    // Authorization: only ADMIN or leader of this stage can assign workers
    if (requesterRole !== 'ADMIN') {
      // Check if requester is a leader/worker of this stage
      const requesterWorkers = await ProductStageWorker.getWorkerByProductAndStage(productId, stageId, requesterId);
      if (!requesterWorkers || requesterWorkers.length === 0) {
        return res.status(403).json({ error: 'Bạn không có quyền gán workers cho stage này' });
      }
    }

    const workers = await ProductStageWorker.assignMultipleWorkers(productId, stageId, userIds);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'ASSIGN_WORKERS',
      { user_ids: userIds, count: workers.length },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: `Assigned ${workers.length} worker(s) to stage`,
      data: workers
    });

  } catch (error) {
    console.error('Error assigning workers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách workers có sẵn để assign vào stage
 * - Admin: tất cả users
 * - Leader/Worker của stage: chỉ users cùng bộ phận
 */
export const getAvailableWorkers = async (req, res) => {
  try {
    const { productId, stageId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Map role to stage
    const roleToStage = {
      'RAP': 1,
      'CAT': 2,
      'MAY': 3,
      'THIET_KE': 4,
      'DINH_KET': 5
    };

    // Admin: return all users
    if (requesterRole === 'ADMIN') {
      const allUsers = await User.getAll();
      const users = allUsers
        .filter(u => u.role !== 'ADMIN') // Exclude other admins
        .map(u => ({
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          role: u.role,
          status: u.status
        }));
      
      return res.json({
        success: true,
        data: users,
        isAdmin: true
      });
    }

    // Non-admin: can only assign users from their own stage
    const stageIdNum = parseInt(stageId);
    
    // Check if requester is leader/worker of this stage
    const requesterWorkers = await ProductStageWorker.getWorkerByProductAndStage(productId, stageIdNum, requesterId);
    if (!requesterWorkers || requesterWorkers.length === 0) {
      return res.status(403).json({ error: 'Bạn không có quyền xem danh sách workers của stage này' });
    }

    // Get users with same role as the stage
    let usersFromStage = [];
    for (const [role, stageNum] of Object.entries(roleToStage)) {
      if (stageNum === stageIdNum) {
        usersFromStage = await User.getByRole(role);
        break;
      }
    }

    const users = usersFromStage.map(u => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      status: u.status
    }));

    res.json({
      success: true,
      data: users,
      isAdmin: false
    });

  } catch (error) {
    console.error('Error getting available workers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách workers đã được assign vào stage
 */
export const getAssignedWorkers = async (req, res) => {
  try {
    const { productId, stageId } = req.params;

    const workers = await ProductStageWorker.getWorkersByProductStage(productId, stageId);

    const workerList = workers.map(w => ({
      id: w.id,
      user_id: w.user_id,
      username: w.username,
      full_name: w.full_name,
      role: w.role,
      status: w.status,
      start_time: w.start_time,
      end_time: w.end_time,
      hours_worked: w.hours_worked,
      hours_elapsed: w.hours_elapsed
    }));

    res.json({
      success: true,
      data: workerList
    });

  } catch (error) {
    console.error('Error getting assigned workers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bắt đầu làm việc (worker tự start)
 */
export const startWork = async (req, res) => {
  try {
    const { productId, stageId } = req.body;
    const userId = req.user.id;

    if (!productId || !stageId) {
      return res.status(400).json({ error: 'Product ID and stage ID required' });
    }

    const worker = await ProductStageWorker.startWork(productId, stageId, userId);

    // Log activity
    await ActivityLog.log(
      userId,
      'START_WORK',
      { stage_name: worker.stage_name },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: 'Work started successfully',
      data: worker
    });

  } catch (error) {
    console.error('Error starting work:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Hoàn thành công việc
 */
export const completeWork = async (req, res) => {
  try {
    const { productId, stageId, notes } = req.body;
    const userId = req.user.id;

    if (!productId || !stageId) {
      return res.status(400).json({ error: 'Product ID and stage ID required' });
    }

    const worker = await ProductStageWorker.completeWork(productId, stageId, userId, notes);

    // Log activity
    await ActivityLog.log(
      userId,
      'COMPLETE_WORK',
      { 
        stage_name: worker.stage_name,
        hours_worked: worker.hours_worked
      },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: 'Work completed successfully',
      data: worker
    });

  } catch (error) {
    console.error('Error completing work:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tạm dừng công việc
 */
export const pauseWork = async (req, res) => {
  try {
    const { productId, stageId, reason } = req.body;
    const userId = req.user.id;

    if (!productId || !stageId) {
      return res.status(400).json({ error: 'Product ID and stage ID required' });
    }

    const worker = await ProductStageWorker.pauseWork(productId, stageId, userId, reason);

    // Log activity
    await ActivityLog.log(
      userId,
      'PAUSE_WORK',
      { stage_name: worker.stage_name, reason },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: 'Work paused successfully',
      data: worker
    });

  } catch (error) {
    console.error('Error pausing work:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Xóa worker khỏi stage
 */
export const removeWorker = async (req, res) => {
  try {
    const { productId, stageId, userId } = req.body;

    if (!productId || !stageId || !userId) {
      return res.status(400).json({ error: 'Product ID, stage ID, and user ID required' });
    }

    const result = await ProductStageWorker.removeWorker(productId, stageId, userId);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'REMOVE_WORKER',
      { removed_user_id: userId },
      productId,
      stageId
    );

    res.json(result);

  } catch (error) {
    console.error('Error removing worker:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách workers của một product-stage
 */
export const getStageWorkers = async (req, res) => {
  try {
    const { productId, stageId } = req.params;

    const workers = await ProductStageWorker.getWorkersByProductStage(productId, stageId);

    res.json({
      success: true,
      data: workers
    });

  } catch (error) {
    console.error('Error getting stage workers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy công việc của user hiện tại
 */
export const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const tasks = await ProductStageWorker.getWorkerTasks(userId, status);

    res.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error('Error getting user tasks:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách tất cả users (for admin to assign workers)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    
    // Return only necessary fields
    const userList = users.map(u => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role
    }));

    res.json({
      success: true,
      data: userList
    });

  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy tổng quan active stages của một product
 */
export const getProductActiveStages = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get all available stages
    const allStages = await Stage.getAll();
    
    // Get active stages for this product
    const activeStages = await ProductActiveStage.getActiveStagesByProduct(productId);
    const activeStageIds = activeStages.map(s => s.stage_id);

    // Combine: all stages + mark which ones are active
    const stagesWithStatus = allStages.map(stage => ({
      ...stage,
      stage_id: stage.id,
      status: activeStageIds.includes(stage.id) ? 'active' : 'inactive'
    }));

    res.json({
      success: true,
      data: stagesWithStatus
    });

  } catch (error) {
    console.error('Error getting product active stages:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy tổng quan tất cả products với multi-stage
 */
export const getMultiStageOverview = async (req, res) => {
  try {
    const overview = await ProductActiveStage.getOverview();

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ error: error.message });
  }
};


/**
 * Lấy danh sách tất cả stages
 */
export const getStagesList = async (req, res) => {
  try {
    const stages = await Stage.getAll();
    res.json({ success: true, data: stages });
  } catch (error) {
    console.error('Error getting stages list:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách sản phẩm (phục vụ nhập hàng)
 */
export const getProductsList = async (req, res) => {
  try {
    const products = await Product.getAll();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error getting products list:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tạo biên bản xuất xưởng
 */
export const createExportRecord = async (req, res) => {
  try {
    const { title, description, shipping_address, approved_by, warehouseItemIds, customItems } = req.body;

    if (!title || !shipping_address) {
      return res.status(400).json({ error: 'Thiếu thông tin biên bản xuất' });
    }

    if ((!warehouseItemIds || warehouseItemIds.length === 0) && (!customItems || customItems.length === 0)) {
      return res.status(400).json({ error: 'Cần chọn ít nhất một sản phẩm hoặc thêm mục tự do' });
    }

    // Tạo biên bản xuất
    const record = await ExportRecord.create({
      title,
      description,
      shipping_address,
      approved_by,
      created_by: req.user.id,
      warehouseItemIds: warehouseItemIds || [],
      customItems: customItems || []
    });

    // Đánh dấu warehouse items đã xuất
    if (warehouseItemIds && warehouseItemIds.length > 0) {
      await Warehouse.markAsExported(warehouseItemIds, record.id);
    }

    await ActivityLog.log(req.user.id, 'CREATE_EXPORT_RECORD', {
      title,
      item_count: (warehouseItemIds?.length || 0) + (customItems?.length || 0)
    });

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Error creating export record:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách biên bản xuất
 */
export const getExportRecords = async (req, res) => {
  try {
    const records = await ExportRecord.getAll();
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error getting export records:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy chi tiết biên bản xuất
 */
export const getExportRecordDetail = async (req, res) => {
  try {
    const record = await ExportRecord.getById(req.params.recordId);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Error getting export record detail:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Render bản in biên bản xuất (A5)
 */
export const renderExportRecordPrint = async (req, res) => {
  try {
    const record = await ExportRecord.getById(req.params.recordId);
    if (!record) return res.status(404).render('error', { error: 'Record not found' });

    res.render('workflow/export-record-print', {
      title: 'Biên bản xuất xưởng',
      record
    });
  } catch (error) {
    console.error('Error rendering export record print:', error);
    res.status(500).render('error', { error: error.message });
  }
};

/**
 * Tạo nhập hàng (sửa chữa) và kích hoạt staging
 */
export const createInboundRecord = async (req, res) => {
  try {
    const { productId, description, stages } = req.body;

    if (!productId || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Thiếu thông tin nhập hàng' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const inboundRecord = await InboundRecord.create({
      product_id: productId,
      description,
      created_by: req.user.id,
      stages: stages.map(stage => ({
        stage_id: stage.stage_id,
        norm_hours: Number(stage.norm_hours)
      }))
    });

    for (const stage of stages) {
      await ProductActiveStage.activateStage(productId, stage.stage_id, {
        norm_hours: Number(stage.norm_hours),
        allowRework: true
      });
    }

    await ActivityLog.log(req.user.id, 'CREATE_INBOUND_RECORD', {
      product_id: productId,
      stage_count: stages.length
    });

    res.json({ success: true, data: inboundRecord });
  } catch (error) {
    console.error('Error creating inbound record:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách nhập hàng
 */
export const getInboundRecords = async (req, res) => {
  try {
    const records = await InboundRecord.getAll();
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error getting inbound records:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy danh sách sản phẩm đã hoàn thành stage (TỪ KHO HÀNG)
 */
export const getCompletedProductsSummary = async (req, res) => {
  try {
    // Lấy toàn bộ inventory từ kho (cả products và custom items)
    const data = await Warehouse.getAvailableInventory();

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error getting warehouse inventory:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy chi tiết các stage đã hoàn thành của một sản phẩm
 */
export const getCompletedProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stages = await ProductActiveStage.getCompletedStagesByProduct(productId);
    const workers = await ProductActiveStage.getCompletedStageWorkersByProduct(productId);

    const workersByStage = workers.reduce((acc, worker) => {
      if (!acc[worker.stage_id]) acc[worker.stage_id] = [];
      acc[worker.stage_id].push(worker);
      return acc;
    }, {});

    const stagesWithWorkers = stages.map(stage => ({
      ...stage,
      workers: workersByStage[stage.stage_id] || []
    }));

    const totalNormHours = stages.reduce((sum, stage) => sum + (stage.norm_hours || 0), 0);

    res.json({
      success: true,
      data: {
        product,
        total_norm_hours: totalNormHours,
        stages: stagesWithWorkers
      }
    });
  } catch (error) {
    console.error('Error getting completed product details:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy thống kê workers theo stage
 */
export const getStageWorkersStats = async (req, res) => {
  try {
    const { stageId } = req.params;

    const stats = await ProductStageWorker.getStageWorkersStats(stageId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting stage workers stats:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy tất cả workers của một product (cross-stage)
 */
export const getProductWorkers = async (req, res) => {
  try {
    const { productId } = req.params;

    const workers = await ProductStageWorker.getAllWorkersByProduct(productId);

    res.json({
      success: true,
      data: workers
    });

  } catch (error) {
    console.error('Error getting product workers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Đánh dấu stage hoàn thành (admin)
 */
export const completeStage = async (req, res) => {
  try {
    const { productId, stageId } = req.body;

    if (!productId || !stageId) {
      return res.status(400).json({ error: 'Product ID and stage ID required' });
    }

    const stage = await ProductActiveStage.completeStage(productId, stageId);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'COMPLETE_STAGE',
      { stage_name: stage.stage_name },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: 'Stage completed successfully',
      data: stage
    });

  } catch (error) {
    console.error('Error completing stage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tạm dừng stage (admin)
 */
export const pauseStage = async (req, res) => {
  try {
    const { productId, stageId } = req.body;

    if (!productId || !stageId) {
      return res.status(400).json({ error: 'Product ID and stage ID required' });
    }

    const stage = await ProductActiveStage.pauseStage(productId, stageId);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'PAUSE_STAGE',
      { stage_name: stage.stage_name },
      productId,
      stageId
    );

    res.json({
      success: true,
      message: 'Stage paused successfully',
      data: stage
    });

  } catch (error) {
    console.error('Error pausing stage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy chi tiết tất cả stages của một product với stats
 */
export const getProductStagesDetail = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product info
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get all active stages with worker counts
    const stages = await ProductActiveStage.getActiveStagesByProduct(productId);

    // Get detailed stats for each stage
    const stagesWithStats = await Promise.all(stages.map(async (stage) => {
      const workers = await ProductStageWorker.getWorkersByProductStage(productId, stage.stage_id);
      
      // Calculate totalHours from hours_elapsed (real-time calculation like worker dashboard)
      const totalHours = workers.reduce((sum, w) => sum + (w.hours_elapsed || 0), 0);
      const completed = workers.filter(w => w.status === 'completed').length;
      const working = workers.filter(w => w.status === 'working').length;
      const assigned = workers.filter(w => w.status === 'assigned').length;
      
      return {
        ...stage,
        workers: workers,
        stats: {
          totalHours: Math.round(totalHours * 10) / 10,
          completedWorkers: completed,
          workingWorkers: working,
          assignedWorkers: assigned,
          totalWorkers: workers.length,
          progress: stage.norm_hours ? Math.min(100, Math.round((totalHours / stage.norm_hours) * 100)) : 0
        }
      };
    }));

    res.json({
      success: true,
      product: product,
      stages: stagesWithStats
    });

  } catch (error) {
    console.error('Error getting product stages detail:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cập nhật định mức giờ (norm_hours) cho stage
 */
export const updateStageNormHours = async (req, res) => {
  try {
    const { productId, stageId } = req.params;
    const { norm_hours } = req.body;

    // Only admin can update norm hours (case-insensitive)
    if (!req.user || req.user.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin can update norm hours' });
    }

    if (!norm_hours || norm_hours <= 0) {
      return res.status(400).json({ error: 'Invalid norm hours value' });
    }

    // Verify product and stage exist
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stage = await Stage.findById(stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const activeStage = await dbGet(
      'SELECT id FROM product_active_stages WHERE product_id = ? AND stage_id = ?',
      [productId, stageId]
    );

    if (activeStage) {
      await dbRun(
        'UPDATE product_active_stages SET norm_hours = ? WHERE id = ?',
        [norm_hours, activeStage.id]
      );
    } else {
      // Fallback to update default in stages table
      await dbRun(
        'UPDATE stages SET norm_hours = ? WHERE id = ?',
        [norm_hours, stageId]
      );
    }

    // Log activity
    await ActivityLog.log(req.user.id, 'update_norm_hours', 
      `Updated norm hours for ${product.product_code} - ${stage.stage_name} to ${norm_hours}h`);

    res.json({
      success: true,
      message: 'Norm hours updated successfully',
      norm_hours: norm_hours
    });

  } catch (error) {
    console.error('Error updating stage norm hours:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy tổng hợp tiến độ từng bộ phận (department) của một product
 */
export const getProductDepartmentStats = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get all workers by role/department for this product
    const stats = await dbAll(`
      SELECT 
        u.role as department,
        COUNT(DISTINCT psw.user_id) as dept_workers,
        COUNT(CASE WHEN psw.status = 'completed' THEN 1 END) as completed_count,
        SUM(psw.hours_worked) as total_hours,
        GROUP_CONCAT(DISTINCT s.stage_name) as stages
      FROM product_stage_workers psw
      LEFT JOIN users u ON psw.user_id = u.id
      LEFT JOIN stages s ON psw.stage_id = s.id
      WHERE psw.product_id = ?
      GROUP BY u.role
      ORDER BY u.role ASC
    `, [productId]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting department stats:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lấy tất cả material requests cho một product-stage
 */
export const getMaterialRequestsForStage = async (req, res) => {
  try {
    const { productId, stageId } = req.params;

    const requests = await dbAll(`
      SELECT mr.*, 
             p.product_code, p.product_name,
             s.stage_name,
             u1.full_name as requested_by_name,
             u1.role as requested_by_role,
             u2.full_name as purchased_by_name,
             u2.role as purchased_by_role
      FROM material_requests mr
      LEFT JOIN products p ON mr.product_id = p.id
      LEFT JOIN stages s ON mr.stage_id = s.id
      LEFT JOIN users u1 ON mr.requested_by_user_id = u1.id
      LEFT JOIN users u2 ON mr.purchased_by_user_id = u2.id
      WHERE mr.product_id = ? AND mr.stage_id = ?
      ORDER BY mr.created_at DESC
    `, [productId, stageId]);

    res.json({
      success: true,
      data: requests || []
    });

  } catch (error) {
    console.error('Error getting material requests:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Thêm comment hoặc update status cho material request
 */
export const updateMaterialRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comment, status } = req.body;

    // Get current request
    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Material request not found' });
    }

    // Update status (only for purchasing department)
    if (status && req.user.role.toUpperCase() === 'THU_MUA') {
      await dbRun(
        'UPDATE material_requests SET status = ?, purchased_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.user.id, requestId]
      );
    }

    // Add comment
    if (comment) {
      await dbRun(
        'INSERT INTO material_request_messages (request_id, user_id, message, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [requestId, req.user.id, comment]
      );
    }

    // Get updated request with comments
    const comments = await dbAll(
      'SELECT mrm.*, u.full_name, u.role FROM material_request_messages mrm LEFT JOIN users u ON mrm.user_id = u.id WHERE mrm.request_id = ? ORDER BY mrm.created_at DESC',
      [requestId]
    );

    const updated = await MaterialRequest.findById(requestId);

    res.json({
      success: true,
      message: 'Material request updated successfully',
      data: {
        ...updated,
        comments: comments
      }
    });

  } catch (error) {
    console.error('Error updating material request:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Thêm custom item vào kho (không phải product)
 */
export const addCustomItemToWarehouse = async (req, res) => {
  try {
    const { item_type, item_name, item_description, quantity } = req.body;

    if (!item_type || !item_name) {
      return res.status(400).json({ error: 'Item type and name required' });
    }

    const result = await Warehouse.addCustomItem(item_type, item_name, item_description, quantity || 1);

    await ActivityLog.log(req.user.id, 'ADD_CUSTOM_ITEM_TO_WAREHOUSE', {
      item_type,
      item_name
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding custom item to warehouse:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tạo inbound record cho custom item (không có product)
 */
export const createCustomInboundRecord = async (req, res) => {
  try {
    const { item_type, item_name, item_description, quantity, stages } = req.body;

    if (!item_type || !item_name || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Item type, name and stages required' });
    }

    // Tạo product mới tự động với tên là item_name
    const productCode = `CUSTOM-${Date.now()}`;
    const productResult = await dbRun(
      `INSERT INTO products (product_code, product_name, current_stage_id, status)
       VALUES (?, ?, 1, 'processing')`,
      [productCode, item_name]
    );

    const productId = productResult.lastID;

    // Tạo inbound record
    const inboundRecord = await InboundRecord.create({
      product_id: productId,
      description: item_description || `Custom inbound: ${item_name} (${item_type})`,
      created_by: req.user.id,
      stages: stages.map(stage => ({
        stage_id: stage.stage_id,
        norm_hours: Number(stage.norm_hours)
      }))
    });

    // Kích hoạt các stages
    for (const stage of stages) {
      await ProductActiveStage.activateStage(productId, stage.stage_id, {
        norm_hours: Number(stage.norm_hours),
        allowRework: true
      });
    }

    await ActivityLog.log(req.user.id, 'CREATE_CUSTOM_INBOUND_RECORD', {
      item_type,
      item_name,
      product_id: productId,
      stage_count: stages.length
    });

    res.json({ success: true, data: { ...inboundRecord, product_id: productId } });
  } catch (error) {
    console.error('Error creating custom inbound record:', error);
    res.status(500).json({ error: error.message });
  }
};
