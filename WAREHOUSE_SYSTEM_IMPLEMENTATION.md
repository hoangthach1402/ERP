# Warehouse Inventory System - Implementation Summary

## Tổng quan
Đã tách biệt hệ thống kho hàng (warehouse inventory) khỏi completed products và hỗ trợ thêm mục tự do (non-product items) vào export/inbound records.

## Các thay đổi chính

### 1. Database Schema

#### Bảng mới: `warehouse_inventory`
```sql
CREATE TABLE warehouse_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,                        -- NULL nếu là custom item
  item_type TEXT NOT NULL DEFAULT 'product', -- 'product', 'document', 'personal', 'misc'
  item_name TEXT,
  item_description TEXT,
  quantity INTEGER DEFAULT 1,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exported_at DATETIME,                      -- NULL = còn trong kho
  export_record_id INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (export_record_id) REFERENCES export_records(id)
)
```

#### Bảng mới: `export_record_custom_items`
```sql
CREATE TABLE export_record_custom_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('document', 'personal', 'misc')),
  item_name TEXT NOT NULL,
  item_description TEXT,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (record_id) REFERENCES export_records(id) ON DELETE CASCADE
)
```

### 2. Backend Models

#### `src/models/Warehouse.js` (MỚI)
- **addProduct(productId)**: Thêm sản phẩm vào kho
- **addCustomItem(itemType, itemName, itemDescription, quantity)**: Thêm mục tự do vào kho
- **getAvailableInventory()**: Lấy danh sách hàng trong kho (chưa xuất)
- **getAvailableProducts()**: Lấy sản phẩm trong kho
- **markAsExported(warehouseItemIds, exportRecordId)**: Đánh dấu đã xuất
- **getExportHistory()**: Lịch sử xuất kho
- **checkProductCompletion(productId)**: Kiểm tra sản phẩm đã hoàn thành chưa
- **autoMoveToWarehouseIfComplete(productId)**: Tự động đưa vào kho khi hoàn thành

#### Cập nhật `src/models/ProductActiveStage.js`
```javascript
static async completeStage(productId, stageId) {
  await dbRun(...);
  
  // ✨ TỰ ĐỘNG đưa vào kho khi hoàn thành tất cả stages
  const { Warehouse } = await import('./Warehouse.js');
  await Warehouse.autoMoveToWarehouseIfComplete(productId);
  
  return this.findByProductAndStage(productId, stageId);
}
```

#### Cập nhật `src/models/ExportRecord.js`
- Hỗ trợ `warehouseItemIds` thay vì trực tiếp `items`
- Hỗ trợ `customItems` cho hồ sơ, đồ dùng cá nhân, v.v.
- `getById()` trả về cả `items` và `customItems`

### 3. Controllers

#### `src/controllers/workflowController.js`

**Cập nhật:**
```javascript
// Lấy warehouse inventory thay vì completed products
export const getCompletedProductsSummary = async (req, res) => {
  const data = await Warehouse.getAvailableInventory();
  res.json({ success: true, data });
};

// Export record với warehouse items
export const createExportRecord = async (req, res) => {
  const { warehouseItemIds, customItems } = req.body;
  // Tạo export record
  const record = await ExportRecord.create({...});
  // Đánh dấu đã xuất
  await Warehouse.markAsExported(warehouseItemIds, record.id);
};
```

**Thêm mới:**
```javascript
// Thêm custom item vào kho
export const addCustomItemToWarehouse = async (req, res) => {
  const result = await Warehouse.addCustomItem(...);
  res.json({ success: true, data: result });
};

// Nhập hàng tự do (tạo product mới tự động)
export const createCustomInboundRecord = async (req, res) => {
  const { item_type, item_name, stages } = req.body;
  
  // Tạo product mới với code CUSTOM-timestamp
  const productCode = `CUSTOM-${Date.now()}`;
  const productResult = await dbRun(...);
  
  // Tạo inbound record và kích hoạt stages
  const inboundRecord = await InboundRecord.create({...});
  for (const stage of stages) {
    await ProductActiveStage.activateStage(...);
  }
};
```

### 4. Routes

#### `src/routes/workflowRoutes.js`
```javascript
// Warehouse management
router.post('/warehouse/add-custom-item', workflowController.addCustomItemToWarehouse);

// Inbound records
router.post('/inbound/create-custom', workflowController.createCustomInboundRecord);
```

### 5. Frontend (Multi-Stage Dashboard)

#### Tab "Kho hàng" (thay vì "Sản phẩm hoàn thành")
- Hiển thị cả products và custom items từ warehouse
- Chọn mục để tạo biên bản xuất
- Nút "Thêm mục tự do" để thêm hồ sơ, đồ dùng cá nhân, v.v.

#### Modal "Thêm mục tự do vào kho"
- Loại mục: Hồ sơ/Giấy tờ, Đồ dùng cá nhân, Khác
- Tên mục, mô tả, số lượng
- POST `/workflow/warehouse/add-custom-item`

#### Form "Nhập hàng"
- Radio button: "Sản phẩm có sẵn" vs "Hàng tự do"
- Khi chọn "Hàng tự do":
  - Loại hàng (document, personal, misc)
  - Tên hàng, mô tả, số lượng
  - Chọn stages và định mức
  - POST `/workflow/inbound/create-custom`
- Tự động tạo product mới với code `CUSTOM-{timestamp}`

#### JavaScript Updates
```javascript
// Warehouse item selection (thay vì product selection)
let selectedWarehouseItems = [];
let warehouseItemsMap = {};

function toggleWarehouseItemSelection(itemId) {
  // Toggle item selection by warehouse ID
}

async function loadCompletedProducts() {
  // Fetch /workflow/completed-products
  // → Returns warehouse inventory with item_type, item_name, etc.
}

function toggleInboundType() {
  // Show/hide product fields vs custom item fields
}
```

## Luồng hoạt động

### 1. Sản phẩm hoàn thành → Kho hàng
```
Worker completes stage
  ↓
ProductActiveStage.completeStage()
  ↓
Warehouse.autoMoveToWarehouseIfComplete()
  ↓
Kiểm tra: Tất cả stages đã completed?
  ↓ YES
INSERT INTO warehouse_inventory (product_id, item_type='product', ...)
```

### 2. Thêm mục tự do vào kho
```
User clicks "Thêm mục tự do"
  ↓
Fill form: item_type, item_name, item_description, quantity
  ↓
POST /workflow/warehouse/add-custom-item
  ↓
INSERT INTO warehouse_inventory (item_type, item_name, ...)
```

### 3. Xuất hàng
```
User selects warehouse items (products + custom items)
  ↓
Click "Tạo biên bản xuất xưởng"
  ↓
POST /workflow/export-records
  body: { warehouseItemIds: [...], customItems: [...] }
  ↓
ExportRecord.create()
  + INSERT export_record_items (for products from warehouse)
  + INSERT export_record_custom_items (for inline custom items)
  ↓
Warehouse.markAsExported(warehouseItemIds, recordId)
  ↓
UPDATE warehouse_inventory SET exported_at=NOW(), export_record_id=...
```

### 4. Nhập hàng tự do
```
User selects "Hàng tự do"
  ↓
Fill: item_type, item_name, item_description, quantity, stages
  ↓
POST /workflow/inbound/create-custom
  ↓
CREATE product (code: CUSTOM-{timestamp})
  ↓
CREATE inbound_record
  ↓
ACTIVATE stages with norm_hours
  ↓
Workers can start working on stages
  ↓
When completed → Auto-move to warehouse
```

## Migration Notes

1. **Tự động khởi tạo bảng**: Khi rebuild Docker, `initDatabase.js` tạo các bảng mới
2. **Dữ liệu cũ**: Sản phẩm đã hoàn thành trước khi có warehouse sẽ KHÔNG tự động vào kho
   - Cần chạy migration script để di chuyển nếu cần (không implement trong lần này)
3. **Export records cũ**: Vẫn hoạt động bình thường, chỉ không liên kết với warehouse

## Testing Checklist

- [x] Database tables created successfully
- [ ] Sản phẩm tự động vào kho khi hoàn thành tất cả stages
- [ ] Thêm custom item vào kho từ UI
- [ ] Tạo biên bản xuất với warehouse items
- [ ] Hàng đã xuất biến mất khỏi danh sách kho
- [ ] Nhập hàng tự do tạo product mới và kích hoạt stages
- [ ] A5 print export record hiển thị cả products và custom items
- [ ] Export history hiển thị đầy đủ thông tin

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflow/completed-products` | Lấy warehouse inventory (available items) |
| POST | `/workflow/warehouse/add-custom-item` | Thêm mục tự do vào kho |
| POST | `/workflow/export-records` | Tạo biên bản xuất (với warehouseItemIds) |
| POST | `/workflow/inbound/create` | Nhập hàng sản phẩm có sẵn |
| POST | `/workflow/inbound/create-custom` | Nhập hàng tự do (tạo product mới) |

## Known Limitations

1. **Custom items trong export record**: Hiện tại custom items được lưu riêng trong `export_record_custom_items`, không thông qua warehouse (để linh hoạt hơn)
2. **Product code cho custom items**: Dùng timestamp, có thể trùng nếu tạo cùng millisecond (xác suất rất thấp)
3. **Inbound custom không cập nhật warehouse trực tiếp**: Tạo product mới, khi hoàn thành mới vào warehouse

## Future Enhancements

1. Báo cáo thống kê inventory theo item_type
2. Export/inbound bulk operations
3. Barcode scanning cho warehouse items
4. Custom item không cần qua product (direct warehouse entry)
5. Low stock alerts cho custom items
