# Multi-Stage & Multi-Worker Feature - User Guide

## 🎯 Tổng quan

Tính năng mới cho phép:
1. ✅ **Nhiều bộ phận làm song song** - Một sản phẩm có thể được 2-3 bộ phận cùng làm đồng thời
2. ✅ **Nhiều người cùng làm** - Trong cùng 1 bộ phận, nhiều workers có thể cùng tham gia

## 📊 Database Schema Mới

### Bảng `product_active_stages`
Quản lý các stage đang được làm cho mỗi sản phẩm

```sql
- id: Primary key
- product_id: ID sản phẩm
- stage_id: ID bộ phận (RẬP, CẮT, MAY, etc.)
- status: 'active', 'paused', 'completed'
- started_at: Thời gian bắt đầu
- completed_at: Thời gian hoàn thành
```

### Bảng `product_stage_workers`
Quản lý workers được gán cho mỗi stage

```sql
- id: Primary key
- product_id: ID sản phẩm
- stage_id: ID bộ phận
- user_id: ID người làm
- status: 'assigned', 'working', 'completed'
- start_time: Thời gian bắt đầu làm
- end_time: Thời gian hoàn thành
- hours_worked: Số giờ đã làm
- notes: Ghi chú
```

## 🚀 API Endpoints

### Admin/Manager APIs

#### 1. Gán stages cho sản phẩm
```http
POST /workflow/assign-stages
Content-Type: application/json

{
  "productId": 1,
  "stageIds": [1, 2, 3],  // Có thể gán nhiều stage cùng lúc
  "userIds": [5, 6, 7]     // Optional: gán workers luôn
}
```

#### 2. Gán workers vào stage
```http
POST /workflow/assign-workers
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2,
  "userIds": [5, 6, 7, 8]  // Gán nhiều workers
}
```

#### 3. Xóa worker khỏi stage
```http
DELETE /workflow/remove-worker
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2,
  "userId": 5
}
```

#### 4. Đánh dấu stage hoàn thành
```http
POST /workflow/complete-stage
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2
}
```

#### 5. Tạm dừng stage
```http
POST /workflow/pause-stage
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2
}
```

### Worker APIs

#### 1. Bắt đầu làm việc
```http
POST /workflow/start-work
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2
}
```

#### 2. Hoàn thành công việc
```http
POST /workflow/complete-work
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2,
  "notes": "Đã hoàn thành tốt"
}
```

#### 3. Tạm dừng công việc
```http
POST /workflow/pause-work
Content-Type: application/json

{
  "productId": 1,
  "stageId": 2,
  "reason": "Chờ nguyên liệu"
}
```

#### 4. Xem công việc của mình
```http
GET /workflow/my-tasks
GET /workflow/my-tasks?status=working
GET /workflow/my-tasks?status=assigned
```

### Query APIs

#### 1. Tổng quan multi-stage
```http
GET /workflow/overview
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "product_id": 1,
      "product_code": "SP001",
      "product_name": "Áo sơ mi",
      "active_stages": "RẬP,CẮT,MAY",
      "stage_count": 3,
      "total_workers": 8,
      "working_now": 5
    }
  ]
}
```

#### 2. Active stages của sản phẩm
```http
GET /workflow/product/:productId/active-stages
```

#### 3. Workers của sản phẩm
```http
GET /workflow/product/:productId/workers
```

#### 4. Workers của product-stage cụ thể
```http
GET /workflow/product/:productId/stage/:stageId/workers
```

#### 5. Thống kê workers theo stage
```http
GET /workflow/stage/:stageId/workers/stats
```

## 🖥️ UI Pages

### 1. Multi-Stage Dashboard (Admin)
```
URL: /workflow/multi-stage-dashboard
```

Hiển thị:
- Tổng số products đang làm
- Tổng số stages active
- Tổng số workers
- Số người đang làm việc
- Danh sách products với các stages đang làm

### 2. Worker Dashboard
```
URL: /workflow/worker-dashboard
```

Hiển thị:
- Tasks được gán cho user
- Tasks đang làm
- Tasks đã hoàn thành
- Thời gian làm việc
- Nút Start/Complete/Pause

## 📝 Workflow mẫu

### Scenario 1: Tạo sản phẩm mới và gán stages

```javascript
// 1. Admin tạo sản phẩm mới (như cũ)
POST /product/create
{
  "product_code": "SP001",
  "product_name": "Áo sơ mi",
  "stageHours": { "1": 4, "2": 3, "3": 6 }
}

// 2. Gán nhiều stages để làm song song
POST /workflow/assign-stages
{
  "productId": 1,
  "stageIds": [1, 2],  // RẬP và CẮT làm song song
  "userIds": [5, 6, 7] // Gán 3 workers cho mỗi stage
}

// 3. Workers bắt đầu làm
POST /workflow/start-work
{
  "productId": 1,
  "stageId": 1  // User 5 bắt đầu làm RẬP
}

// 4. Worker hoàn thành
POST /workflow/complete-work
{
  "productId": 1,
  "stageId": 1,
  "notes": "Hoàn thành"
}
```

### Scenario 2: Thêm worker vào stage đang làm

```javascript
// 1. Kiểm tra workers hiện tại
GET /workflow/product/1/stage/2/workers

// 2. Thêm worker mới
POST /workflow/assign-workers
{
  "productId": 1,
  "stageId": 2,
  "userIds": [10, 11]  // Thêm 2 người nữa
}
```

### Scenario 3: Worker tự quản lý công việc

```javascript
// 1. Xem tasks của mình
GET /workflow/my-tasks?status=assigned

// 2. Chọn task và bắt đầu
POST /workflow/start-work
{
  "productId": 1,
  "stageId": 3
}

// 3. Nếu cần tạm dừng
POST /workflow/pause-work
{
  "productId": 1,
  "stageId": 3,
  "reason": "Nghỉ giải lao"
}

// 4. Tiếp tục làm
POST /workflow/start-work
{
  "productId": 1,
  "stageId": 3
}

// 5. Hoàn thành
POST /workflow/complete-work
{
  "productId": 1,
  "stageId": 3,
  "notes": "Done"
}
```

## 🔄 Tích hợp với hệ thống cũ

Hệ thống mới **tương thích ngược** với workflow cũ:

- Bảng `products`, `product_stage_tasks` vẫn giữ nguyên
- Khi khởi động, dữ liệu cũ sẽ được migrate tự động
- Có thể dùng cả 2 workflows:
  - Workflow cũ: `/product/*`, `/scan/*` (tuần tự)
  - Workflow mới: `/workflow/*` (song song)

## 📈 Báo cáo & Tracking

### Xem tổng giờ công theo sản phẩm
```sql
SELECT 
  p.product_code,
  s.stage_name,
  COUNT(psw.id) as total_workers,
  SUM(psw.hours_worked) as total_hours,
  AVG(psw.hours_worked) as avg_hours_per_worker
FROM products p
JOIN product_stage_workers psw ON p.id = psw.product_id
JOIN stages s ON psw.stage_id = s.id
WHERE psw.status = 'completed'
GROUP BY p.id, s.id;
```

### Xem hiệu suất workers
```sql
SELECT 
  u.full_name,
  COUNT(psw.id) as total_tasks,
  SUM(psw.hours_worked) as total_hours,
  AVG(psw.hours_worked) as avg_hours_per_task
FROM users u
JOIN product_stage_workers psw ON u.id = psw.user_id
WHERE psw.status = 'completed'
GROUP BY u.id
ORDER BY total_hours DESC;
```

## ⚙️ Setup & Installation

### 1. Database Migration
Khi chạy server, migration tự động chạy:
```bash
npm start
```

Hoặc chạy manual:
```bash
node database/run-migration.js
```

### 2. Test APIs
```bash
# Test multi-stage overview
curl http://localhost:3000/workflow/overview \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test my tasks
curl http://localhost:3000/workflow/my-tasks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎨 UI Screenshots

### Multi-Stage Dashboard
- Hiển thị products với nhiều stages đang active
- Tổng workers per product
- Số người đang working

### Worker Dashboard
- My assigned tasks
- My working tasks
- My completed tasks
- Start/Pause/Complete buttons

## 🔐 Permissions

- **Admin/Manager**: Full access to all endpoints
- **Workers**: 
  - Read: own tasks
  - Write: start/pause/complete own work
  - No access: assign/remove workers, manage stages

## 📞 Support

Nếu có vấn đề:
1. Check logs: `logs/` folder
2. Check database: `database/manufacturing.db`
3. Review activity logs: `activity_logs` table

## 🚀 Next Steps

1. Test với dữ liệu thực
2. Training users
3. Monitor performance
4. Collect feedback
5. Iterate và improve
