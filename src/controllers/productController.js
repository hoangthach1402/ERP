import Product from '../models/Product.js';
import { ProductStageTask } from '../models/Stage.js';
import ActivityLog from '../models/ActivityLog.js';
import { notifyNewProductRap } from '../services/telegramRapNotification.js';

export const createProduct = async (req, res) => {
  try {
    const { product_code, product_name, stageHours } = req.body;

    // Validation
    if (!product_code || !product_name) {
      return res.status(400).json({ error: 'Mã sản phẩm và tên sản phẩm không được để trống' });
    }

    // Trim whitespace
    const code = product_code.trim();
    const name = product_name.trim();

    // Validate length
    if (code.length < 2 || code.length > 50) {
      return res.status(400).json({ error: 'Mã sản phẩm phải từ 2-50 ký tự' });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Tên sản phẩm phải từ 2-100 ký tự' });
    }

    // Check if product with same code already exists
    const existing = await Product.findByCode(code);
    if (existing) {
      return res.status(400).json({ error: 'Mã sản phẩm này đã tồn tại' });
    }

    // Use provided stageHours or empty object
    const normalizedStageHours = stageHours || {};

    const product = await Product.create({
      product_code: code,
      product_name: name,
      stageHours: normalizedStageHours
    });

    await ActivityLog.log(req.user.id, 'CREATE_PRODUCT', {
      product_code: code,
      product_name: name,
      stageHours
    }, product.id);

    // Send Telegram notification asynchronously (don't wait for it)
    notifyNewProductRap({
      product_code: code,
      product_name: name,
      stageHours
    }).catch(err => console.error('Telegram notification error:', err));

    res.json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error.message);
    res.status(500).json({ error: 'Lỗi tạo sản phẩm. Vui lòng thử lại' });
  }
};

export default {
  createProduct
};
