import Product from '../models/Product.js';
import { ProductStageTask } from '../models/Stage.js';
import ActivityLog from '../models/ActivityLog.js';

export const getDashboard = async (req, res) => {
  try {
    const products = await Product.getProductsWithDetails();
    
    // Calculate summary stats
    const stats = {
      total: products.length,
      completed: products.filter(p => p.status === 'completed').length,
      processing: products.filter(p => p.status === 'processing').length,
      delayed: products.filter(p => p.is_delayed === 1).length
    };

    const recentLogs = await ActivityLog.getRecent(10);

    res.render('dashboard', {
      products,
      stats,
      user: req.session.user,
      recentLogs,
      role: req.user.role
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'Error loading dashboard' });
  }
};

export const getProductDetail = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).render('error', { error: 'Product not found' });
    }

    console.log('Product detail data:', product);

    const tasks = await ProductStageTask.getTasksByProduct(productId);
    const logs = await ActivityLog.getByProduct(productId);
    const parsedLogs = logs.map(log => {
      let details = null;
      try {
        details = log.details ? JSON.parse(log.details) : null;
      } catch (parseError) {
        details = null;
      }
      return { ...log, details }; 
    });

    res.render('product-detail', {
      product,
      tasks,
      logs: parsedLogs,
      user: req.session.user,
      role: req.user.role
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).render('error', { error: 'Error loading product details' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { product_code, product_name, stage_1_hours, stage_2_hours, stage_3_hours, stage_4_hours, stage_5_hours } = req.body;

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

    // Collect stage hours
    const stageHours = {
      1: stage_1_hours || 0,
      2: stage_2_hours || 0,
      3: stage_3_hours || 0,
      4: stage_4_hours || 0,
      5: stage_5_hours || 0
    };

    const product = await Product.create({
      product_code: code,
      product_name: name,
      stageHours
    });

    await ActivityLog.log(req.user.id, 'CREATE_PRODUCT', {
      product_code: code,
      product_name: name,
      stageHours
    }, product.id);

    res.json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error.message);
    res.status(500).json({ error: 'Lỗi tạo sản phẩm. Vui lòng thử lại' });
  }
};

export default {
  getDashboard,
  getProductDetail,
  createProduct
};
