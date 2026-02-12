import axios from 'axios';

const TELEGRAM_CAT_BOT_TOKEN = process.env.TELEGRAM_CAT_BOT_TOKEN;
const TELEGRAM_CAT_GROUP_ID = process.env.TELEGRAM_CAT_GROUP_ID;
const TELEGRAM_CAT_ENABLED = process.env.TELEGRAM_CAT_ENABLED === 'true';

/**
 * Gửi thông báo sản phẩm mới tới nhóm Telegram BP CẮT (sau khi RẬP hoàn thành)
 * @param {Object} productData - Dữ liệu sản phẩm
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyCompletedProductCat = async (productData) => {
  if (!TELEGRAM_CAT_ENABLED) {
    console.log('Telegram CAT notifications are disabled');
    return false;
  }

  if (!TELEGRAM_CAT_BOT_TOKEN || !TELEGRAM_CAT_GROUP_ID) {
    console.error('Telegram CAT configuration is missing');
    return false;
  }

  try {
    const message = formatProductCompletionNotification(productData);
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_CAT_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CAT_GROUP_ID,
        text: message,
        parse_mode: 'HTML'
      },
      {
        timeout: 10000
      }
    );

    if (response.data.ok) {
      console.log('✓ Telegram CAT notification sent successfully');
      return true;
    } else {
      console.error('Telegram API error:', response.data.description);
      return false;
    }
  } catch (error) {
    console.error('Error sending Telegram CAT notification:', error.message);
    return false;
  }
};

/**
 * Format thông báo sản phẩm hoàn thành cắt
 * @param {Object} productData - Dữ liệu sản phẩm
 * @returns {string} Thông báo HTML formatted
 */
const formatProductCompletionNotification = (productData) => {
  const { product_code, product_name } = productData;

  return `<b>🆕 Sản phẩm mới được giao - BP CẮT</b>

<b>Mã sản phẩm:</b> <code>${product_code}</code>
<b>Tên sản phẩm:</b> ${product_name}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}

<i>Sản phẩm đã hoàn thành khâu RẬP</i>`;
};

/**
 * Gửi thông báo khi BP CẮT bắt đầu nhận việc
 * @param {Object} taskData - Dữ liệu task
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyStartTaskCat = async (taskData) => {
  if (!TELEGRAM_CAT_ENABLED) return false;
  if (!TELEGRAM_CAT_BOT_TOKEN || !TELEGRAM_CAT_GROUP_ID) return false;

  try {
    const message = `<b>🔧 BP CẮT - Bắt đầu làm việc</b>

<b>Mã sản phẩm:</b> <code>${taskData.product_code}</code>
<b>Tên sản phẩm:</b> ${taskData.product_name}
<b>Người thực hiện:</b> ${taskData.user_name}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_CAT_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_CAT_GROUP_ID, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );

    if (response.data.ok) {
      console.log('✓ Telegram CAT start notification sent');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending Telegram CAT start notification:', error.message);
    return false;
  }
};

/**
 * Gửi thông báo khi BP CẮT chờ nguyên liệu
 * @param {Object} taskData - Dữ liệu task
 * @returns {Promise<boolean>} True nếu thành công
 */
export const notifyPendingTaskCat = async (taskData) => {
  if (!TELEGRAM_CAT_ENABLED) return false;
  if (!TELEGRAM_CAT_BOT_TOKEN || !TELEGRAM_CAT_GROUP_ID) return false;

  try {
    const message = `<b>⏸️ BP CẮT - Chờ nguyên liệu</b>

<b>Mã sản phẩm:</b> <code>${taskData.product_code}</code>
<b>Tên sản phẩm:</b> ${taskData.product_name}
<b>Người báo:</b> ${taskData.user_name}
<b>Lý do:</b> ${taskData.reason}
<b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_CAT_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_CAT_GROUP_ID, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );

    if (response.data.ok) {
      console.log('✓ Telegram CAT pending notification sent');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending Telegram CAT pending notification:', error.message);
    return false;
  }
};

export default {
  notifyCompletedProductCat,
  notifyStartTaskCat,
  notifyPendingTaskCat
};
