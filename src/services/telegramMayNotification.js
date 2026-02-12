import axios from 'axios';

const TELEGRAM_MAY_BOT_TOKEN = process.env.TELEGRAM_MAY_BOT_TOKEN;
const TELEGRAM_MAY_GROUP_ID = process.env.TELEGRAM_MAY_GROUP_ID;
const TELEGRAM_MAY_ENABLED = process.env.TELEGRAM_MAY_ENABLED === 'true';

/**
 * Gửi thông báo sản phẩm mới tới nhóm Telegram BP MAY (sau khi CẮT hoàn thành)
 * @param {Object} productData - Dữ liệu sản phẩm
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyCompletedProductMay = async (productData) => {
  if (!TELEGRAM_MAY_ENABLED) {
    console.log('Telegram MAY notifications are disabled');
    return false;
  }

  if (!TELEGRAM_MAY_BOT_TOKEN || !TELEGRAM_MAY_GROUP_ID) {
    console.error('Telegram MAY configuration is missing');
    return false;
  }

  try {
    const message = formatProductCompletionNotification(productData);
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_MAY_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_MAY_GROUP_ID,
        text: message,
        parse_mode: 'HTML'
      },
      {
        timeout: 10000
      }
    );

    if (response.data.ok) {
      console.log('✓ Telegram MAY notification sent successfully');
      return true;
    } else {
      console.error('Telegram API error:', response.data.description);
      return false;
    }
  } catch (error) {
    console.error('Error sending Telegram MAY notification:', error.message);
    return false;
  }
};

/**
 * Format thông báo sản phẩm may
 * @param {Object} productData - Dữ liệu sản phẩm
 * @returns {string} Thông báo HTML formatted
 */
const formatProductCompletionNotification = (productData) => {
  const { product_code, product_name } = productData;

  return `<b>🆕 Sản phẩm mới được giao - BP MAY</b>

<b>Mã sản phẩm:</b> <code>${product_code}</code>
<b>Tên sản phẩm:</b> ${product_name}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}

<i>Sản phẩm đã hoàn thành khâu CẮT</i>`;
};

/**
 * Gửi thông báo khi BP MAY bắt đầu nhận việc
 * @param {Object} taskData - Dữ liệu task
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyStartTaskMay = async (taskData) => {
  if (!TELEGRAM_MAY_ENABLED) return false;
  if (!TELEGRAM_MAY_BOT_TOKEN || !TELEGRAM_MAY_GROUP_ID) return false;

  try {
    const message = `<b>🔧 BP MAY - Bắt đầu làm việc</b>

<b>Mã sản phẩm:</b> <code>${taskData.product_code}</code>
<b>Tên sản phẩm:</b> ${taskData.product_name}
<b>Người thực hiện:</b> ${taskData.user_name}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_MAY_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_MAY_GROUP_ID, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );

    if (response.data.ok) {
      console.log('✓ Telegram MAY start notification sent');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending Telegram MAY start notification:', error.message);
    return false;
  }
};

/**
 * Gửi thông báo khi BP MAY chờ nguyên liệu
 * @param {Object} taskData - Dữ liệu task
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyPendingTaskMay = async (taskData) => {
  if (!TELEGRAM_MAY_ENABLED) return false;
  if (!TELEGRAM_MAY_BOT_TOKEN || !TELEGRAM_MAY_GROUP_ID) return false;

  try {
    const message = `<b>⏸️ BP MAY - Chờ nguyên liệu</b>

<b>Mã sản phẩm:</b> <code>${taskData.product_code}</code>
<b>Tên sản phẩm:</b> ${taskData.product_name}
<b>Người báo:</b> ${taskData.user_name}
<b>Lý do:</b> ${taskData.reason}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_MAY_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_MAY_GROUP_ID, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );

    if (response.data.ok) {
      console.log('✓ Telegram MAY pending notification sent');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending Telegram MAY pending notification:', error.message);
    return false;
  }
};

/**
 * Gửi thông báo phản hồi từ thu mua
 * @param {Object} feedbackData - Dữ liệu phản hồi
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyPurchaseFeedbackMay = async (feedbackData) => {
  if (!TELEGRAM_MAY_ENABLED) return false;
  if (!TELEGRAM_MAY_BOT_TOKEN || !TELEGRAM_MAY_GROUP_ID) return false;

  try {
    const deliveryDate = feedbackData.expected_delivery_date 
      ? new Date(feedbackData.expected_delivery_date).toLocaleDateString('vi-VN')
      : 'Chưa xác định';

    let messageTitle = '✅ Phản hồi từ bộ phận THU MUA';
    if (feedbackData.response_note === 'Đã giao hàng') {
      messageTitle = '📦 Nguyên liệu đã giao';
    }
      
    let message = `<b>${messageTitle}</b>

<b>Mã sản phẩm:</b> <code>${feedbackData.product_code}</code>
<b>Tên sản phẩm:</b> ${feedbackData.product_name}
<b>Người mua:</b> ${feedbackData.purchaser_name || 'Chưa xác định'}
<b>Ngày dự kiến về:</b> ${deliveryDate}
<b>Ghi chú:</b> ${feedbackData.response_note || 'Không có'}`;

    if (feedbackData.user_name && feedbackData.role) {
      message += `\n<b>Người cập nhật:</b> ${feedbackData.user_name} (${feedbackData.role})`;
    }
    
    message += `\n<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_MAY_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_MAY_GROUP_ID, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );

    if (response.data.ok) {
      console.log('✓ Telegram MAY feedback sent');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending Telegram MAY feedback:', error.message);
    return false;
  }
};

export default {
  notifyCompletedProductMay,
  notifyStartTaskMay,
  notifyPendingTaskMay,
  notifyPurchaseFeedbackMay
};
