import MaterialRequest from '../models/MaterialRequest.js';
import ActivityLog from '../models/ActivityLog.js';
import { notifyPurchaseFeedbackRap } from '../services/telegramRapNotification.js';
import { notifyPurchaseFeedbackCat } from '../services/telegramCatNotification.js';
import { notifyPurchaseFeedbackMay } from '../services/telegramMayNotification.js';

/**
 * Dashboard thu mua - hiển thị các yêu cầu thiếu nguyên liệu
 */
export const getPurchasingDashboard = async (req, res) => {
  try {
    const pendingRequests = await MaterialRequest.getPending();
    const allRequests = await MaterialRequest.getAll();
    const stats = await MaterialRequest.getStats();

    res.render('purchasing/dashboard', {
      user: req.session.user,
      role: req.user.role,
      pendingRequests,
      allRequests,
      stats
    });
  } catch (error) {
    console.error('Purchasing dashboard error:', error);
    res.status(500).render('error', { error: 'Error loading purchasing dashboard' });
  }
};

/**
 * Xác nhận đã mua nguyên vật liệu
 */
export const confirmPurchase = async (req, res) => {
  try {
    const { requestId, expected_delivery_date, response_note } = req.body;

    if (!requestId || !expected_delivery_date) {
      return res.status(400).json({ error: 'Request ID và ngày dự kiến giao hàng là bắt buộc' });
    }

    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Yêu cầu này đã được xử lý' });
    }

    // Cập nhật status
    const updatedRequest = await MaterialRequest.markAsPurchased(requestId, {
      purchased_by_user_id: req.user.id,
      expected_delivery_date,
      response_note
    });

    // Lưu note như 1 comment từ THU_MUA
    const commentText = response_note || 
      `Đã xác nhận mua. Dự kiến giao ngày ${new Date(expected_delivery_date).toLocaleDateString('vi-VN')}`;
    await MaterialRequest.addMessage(requestId, req.user.id, commentText);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'PURCHASE_CONFIRMED',
      {
        request_id: requestId,
        expected_delivery_date,
        response_note
      },
      request.product_id,
      request.stage_id
    );

    // Gửi thông báo feedback về nhóm Telegram tương ứng
    const feedbackData = {
      product_code: request.product_code,
      product_name: request.product_name,
      expected_delivery_date,
      response_note: response_note || 'Đang tiến hành mua',
      purchaser_name: req.user.full_name || req.user.username
    };

    if (request.stage_id === 1) {
      notifyPurchaseFeedbackRap(feedbackData).catch(err => console.error('Telegram feedback error:', err));
    } else if (request.stage_id === 2) {
      notifyPurchaseFeedbackCat(feedbackData).catch(err => console.error('Telegram feedback error:', err));
    } else if (request.stage_id === 3) {
      notifyPurchaseFeedbackMay(feedbackData).catch(err => console.error('Telegram feedback error:', err));
    }

    res.json({
      success: true,
      message: 'Đã xác nhận mua nguyên vật liệu',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Confirm purchase error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Đánh dấu đã giao hàng
 */
export const markAsDelivered = async (req, res) => {
  try {
    const { requestId } = req.body;

    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    }

    if (request.status !== 'purchased') {
      return res.status(400).json({ error: 'Yêu cầu chưa được xác nhận mua' });
    }

    const updatedRequest = await MaterialRequest.markAsDelivered(requestId);

    await ActivityLog.log(
      req.user.id,
      'MATERIAL_DELIVERED',
      { request_id: requestId },
      request.product_id,
      request.stage_id
    );

    // Gửi thông báo Telegram về trạng thái đã giao
    const deliveryData = {
      product_code: request.product_code,
      product_name: request.product_name,
      purchaser_name: request.purchaser_name || 'N/A',
      expected_delivery_date: request.expected_delivery_date,
      response_note: 'Đã giao hàng',
      user_name: req.user.full_name || req.user.username,
      role: req.user.role
    };

    if (request.stage_id === 1) {
      notifyPurchaseFeedbackRap(deliveryData).catch(err => console.error('Telegram delivery error:', err));
    } else if (request.stage_id === 2) {
      notifyPurchaseFeedbackCat(deliveryData).catch(err => console.error('Telegram delivery error:', err));
    } else if (request.stage_id === 3) {
      notifyPurchaseFeedbackMay(deliveryData).catch(err => console.error('Telegram delivery error:', err));
    }

    res.json({
      success: true,
      message: 'Đã cập nhật trạng thái giao hàng',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Mark delivered error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Xem chi tiết yêu cầu
 */
export const getRequestDetail = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await MaterialRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).render('error', { error: 'Không tìm thấy yêu cầu' });
    }

    const messages = await MaterialRequest.getMessages(requestId);

    res.render('purchasing/request-detail', {
      user: req.session.user,
      role: req.session.user?.role || req.user.role,
      request,
      messages
    });
  } catch (error) {
    console.error('Get request detail error:', error);
    res.status(500).render('error', { error: 'Error loading request detail' });
  }
};

/**
 * Gửi bình luận
 */
export const sendMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Bình luận không được để trống' });
    }

    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    }

    // Lưu message
    await MaterialRequest.addMessage(requestId, req.user.id, message);

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'MESSAGE_SENT',
      { request_id: requestId, message },
      request.product_id,
      request.stage_id
    );

    // Gửi thông báo Telegram với dữ liệu đầy đủ
    const notificationData = {
      product_code: request.product_code,
      product_name: request.product_name,
      purchaser_name: request.purchaser_name || req.user.full_name || req.user.username,
      expected_delivery_date: request.expected_delivery_date,
      response_note: message,
      user_name: req.user.full_name || req.user.username,
      role: req.user.role
    };

    if (request.stage_id === 1) {
      notifyPurchaseFeedbackRap(notificationData).catch(err => console.error('Telegram error:', err));
    } else if (request.stage_id === 2) {
      notifyPurchaseFeedbackCat(notificationData).catch(err => console.error('Telegram error:', err));
    } else if (request.stage_id === 3) {
      notifyPurchaseFeedbackMay(notificationData).catch(err => console.error('Telegram error:', err));
    }

    res.json({ success: true, message: 'Bình luận đã được lưu' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tạo yêu cầu vật liệu mới từ worker dashboard
 */
export const createRequest = async (req, res) => {
  try {
    const { productId, stage, materials, quantity, urgency, notes } = req.body;

    if (!productId || !stage || !materials) {
      return res.status(400).json({ error: 'Product ID, stage, và materials là bắt buộc' });
    }

    // Resolve stage to stage_id
    let stageId = null;
    
    // If stage is a number, use it directly
    if (!isNaN(stage)) {
      stageId = parseInt(stage);
    } else {
      // Otherwise, look up by name in database
      const { Stage } = await import('../models/Stage.js');
      const stageRecord = await Stage.findByName(stage);
      if (!stageRecord) {
        return res.status(400).json({ error: `Invalid stage: ${stage}` });
      }
      stageId = stageRecord.id;
    }

    if (!stageId || stageId <= 0) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    // Build reason string
    const reason = `${materials}${quantity ? ` (Qty: ${quantity})` : ''}${urgency ? `, Urgency: ${urgency}` : ''}${notes ? `, Notes: ${notes}` : ''}`;

    // Create material request
    const request = await MaterialRequest.create({
      product_id: productId,
      stage_id: stageId,
      requested_by_user_id: req.user.id,
      reason
    });

    // Log activity
    await ActivityLog.log(
      req.user.id,
      'MATERIAL_REQUEST_CREATED',
      { product_id: productId, stage_id: stageId, materials, quantity, urgency },
      productId,
      stageId
    );

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getPurchasingDashboard,
  confirmPurchase,
  markAsDelivered,
  getRequestDetail,
  sendMessage,
  createRequest
};
