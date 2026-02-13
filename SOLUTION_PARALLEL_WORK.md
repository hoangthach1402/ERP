# Giải pháp hỗ trợ làm việc song song

## Yêu cầu:
1. ✅ Một sản phẩm có thể được 2-3 bộ phận làm cùng lúc
2. ✅ Trong cùng 1 bộ phận, nhiều người có thể cùng tham gia

## Thay đổi Database Schema

### Phương án 1: Giữ cấu trúc hiện tại + Thêm bảng phụ (Khuyến nghị)

```sql
-- Bỏ UNIQUE constraint trên product_stage_tasks
-- Cho phép nhiều task record cho cùng 1 product + stage
-- Mỗi record đại diện cho 1 worker

-- Thêm bảng theo dõi stage nào đang active
CREATE TABLE product_active_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  stage_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- active, paused, completed
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  UNIQUE(product_id, stage_id)
);

-- Bảng theo dõi worker assignments - nhiều worker cho 1 stage
CREATE TABLE product_stage_workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  stage_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'assigned', -- assigned, working, completed
  start_time DATETIME,
  end_time DATETIME,
  hours_worked REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(product_id, stage_id, user_id)
);
```

### Phương án 2: Đơn giản hơn - Chỉ sửa bảng hiện tại

```sql
-- Bỏ UNIQUE constraint
ALTER TABLE product_stage_tasks DROP CONSTRAINT unique_product_stage;

-- Thêm field để nhóm workers
ALTER TABLE product_stage_tasks ADD COLUMN worker_group_id INTEGER;
ALTER TABLE product_stage_tasks ADD COLUMN hours_worked REAL DEFAULT 0;

-- Thay đổi logic: products.current_stage_id → products.status = 'processing'
-- Sử dụng product_stage_tasks để tracking stage nào đang active
```

## Logic nghiệp vụ mới

### 1. Khởi tạo sản phẩm mới:
```javascript
async function createProduct(productData) {
  // Tạo product (không cần current_stage_id cố định)
  const product = await Product.create({
    product_code: productData.code,
    product_name: productData.name,
    status: 'ready' // ready to assign stages
  });

  // Admin chọn stage nào sẽ làm đầu tiên
  // Có thể chọn nhiều stage cùng lúc
  return product;
}
```

### 2. Gán bộ phận làm việc:
```javascript
async function assignStageToProduct(productId, stageId, userIds = []) {
  // Đánh dấu stage này đang active
  await dbRun(
    'INSERT INTO product_active_stages (product_id, stage_id, status) VALUES (?, ?, ?)',
    [productId, stageId, 'active']
  );

  // Gán nhiều workers cho stage này
  for (const userId of userIds) {
    await dbRun(
      'INSERT INTO product_stage_workers (product_id, stage_id, user_id, status) VALUES (?, ?, ?, ?)',
      [productId, stageId, userId, 'assigned']
    );
  }
}
```

### 3. Bắt đầu làm việc:
```javascript
async function startWork(productId, stageId, userId) {
  await dbRun(
    `UPDATE product_stage_workers 
     SET status = 'working', start_time = CURRENT_TIMESTAMP 
     WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
    [productId, stageId, userId]
  );
  
  // Log activity
  await ActivityLog.log(userId, 'START_WORK', {
    stage_id: stageId,
    product_id: productId
  });
}
```

### 4. Kết thúc công việc:
```javascript
async function completeWork(productId, stageId, userId, hoursWorked) {
  await dbRun(
    `UPDATE product_stage_workers 
     SET status = 'completed', 
         end_time = CURRENT_TIMESTAMP,
         hours_worked = ?
     WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
    [hoursWorked, productId, stageId, userId]
  );

  // Kiểm tra xem tất cả workers của stage này đã xong chưa
  const pendingWorkers = await dbGet(
    `SELECT COUNT(*) as count FROM product_stage_workers 
     WHERE product_id = ? AND stage_id = ? AND status != 'completed'`,
    [productId, stageId]
  );

  // Nếu tất cả workers đã xong → đánh dấu stage completed
  if (pendingWorkers.count === 0) {
    await dbRun(
      `UPDATE product_active_stages 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
       WHERE product_id = ? AND stage_id = ?`,
      [productId, stageId]
    );
  }
}
```

### 5. Thêm/bớt workers vào stage đang làm:
```javascript
async function addWorkerToStage(productId, stageId, userId) {
  // Kiểm tra stage còn đang active không
  const activeStage = await dbGet(
    'SELECT * FROM product_active_stages WHERE product_id = ? AND stage_id = ? AND status = "active"',
    [productId, stageId]
  );

  if (!activeStage) {
    throw new Error('Stage is not active for this product');
  }

  // Thêm worker mới
  await dbRun(
    'INSERT INTO product_stage_workers (product_id, stage_id, user_id, status) VALUES (?, ?, ?, ?)',
    [productId, stageId, userId, 'assigned']
  );
}
```

## Dashboard hiển thị

### Dashboard cho Admin:
```sql
-- Xem tổng quan sản phẩm đang làm
SELECT 
  p.product_code,
  p.product_name,
  GROUP_CONCAT(DISTINCT s.stage_name) as active_stages,
  COUNT(DISTINCT psw.user_id) as total_workers,
  COUNT(DISTINCT CASE WHEN psw.status = 'working' THEN psw.user_id END) as working_now
FROM products p
JOIN product_active_stages pas ON p.id = pas.product_id
JOIN stages s ON pas.stage_id = s.id
LEFT JOIN product_stage_workers psw ON p.id = psw.product_id AND pas.stage_id = psw.stage_id
WHERE pas.status = 'active'
GROUP BY p.id;
```

### Dashboard cho từng bộ phận:
```sql
-- Xem sản phẩm đang làm ở stage của mình
SELECT 
  p.product_code,
  p.product_name,
  psw.user_id,
  u.full_name,
  psw.status,
  psw.start_time,
  CAST((julianday('now') - julianday(psw.start_time)) * 24 AS REAL) as hours_elapsed
FROM products p
JOIN product_stage_workers psw ON p.id = psw.product_id
JOIN users u ON psw.user_id = u.id
WHERE psw.stage_id = ? -- stage ID của bộ phận
  AND psw.status IN ('assigned', 'working')
ORDER BY psw.start_time ASC;
```

## Ưu điểm của giải pháp:

1. ✅ **Linh hoạt**: Có thể gán nhiều stage cùng lúc cho 1 sản phẩm
2. ✅ **Mở rộng**: Dễ dàng thêm/bớt workers trong quá trình làm việc
3. ✅ **Theo dõi**: Biết chính xác ai đang làm gì, làm được bao lâu
4. ✅ **Báo cáo**: Tính được tổng giờ công, hiệu suất từng người
5. ✅ **Tương thích ngược**: Có thể giữ bảng cũ, chỉ thêm bảng mới

## Nhược điểm cần lưu ý:

1. ⚠️ **Phức tạp hơn**: Logic nghiệp vụ phức tạp hơn workflow tuần tự
2. ⚠️ **Cần rules**: Phải định nghĩa rõ stage nào có thể làm song song, stage nào phải chờ
3. ⚠️ **Conflict**: Cần xử lý trường hợp nhiều người sửa cùng 1 phần (nếu có)
4. ⚠️ **UI phức tạp**: Dashboard cần thiết kế lại để hiển thị đa chiều

## Các bước triển khai:

### Bước 1: Migration Database
- Chạy script tạo bảng mới
- Migrate dữ liệu cũ (nếu cần)

### Bước 2: Cập nhật Models
- Tạo `ProductActiveStage` model
- Tạo `ProductStageWorker` model
- Sửa `Product` model

### Bước 3: Cập nhật Controllers
- Admin controller: gán stage, gán workers
- Stage controller: start/complete work
- Scan controller: scan để start/complete

### Bước 4: Cập nhật Views
- Dashboard admin: hiển thị multi-stage progress
- Dashboard bộ phận: hiển thị team members
- Product detail: timeline theo dõi đa chiều

### Bước 5: Testing
- Test concurrent work
- Test add/remove workers
- Test completion logic
