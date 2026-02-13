# ⚡ Quick Reference - Multi-Stage & Multi-Worker

## 🎯 Tính năng mới
✅ Nhiều bộ phận làm song song (RẬP + CẮT + MAY cùng lúc)  
✅ Nhiều người cùng làm 1 bộ phận  
✅ Tracking giờ công từng người  
✅ Dashboard real-time  

## 🚀 Khởi động nhanh

```bash
cd "d:\APP 2026\ERP"
npm start
```

## 🔗 URLs

| Dashboard | URL |
|-----------|-----|
| Admin | http://localhost:3000/workflow/multi-stage-dashboard |
| Worker | http://localhost:3000/workflow/worker-dashboard |

## 📡 APIs chính

### Admin
```javascript
// Gán stages cho product
POST /workflow/assign-stages
{ productId: 1, stageIds: [1,2,3], userIds: [5,6,7] }

// Gán workers vào stage
POST /workflow/assign-workers
{ productId: 1, stageId: 2, userIds: [8,9,10] }

// Xem tổng quan
GET /workflow/overview
```

### Worker
```javascript
// Xem tasks của mình
GET /workflow/my-tasks

// Bắt đầu làm
POST /workflow/start-work
{ productId: 1, stageId: 2 }

// Hoàn thành
POST /workflow/complete-work
{ productId: 1, stageId: 2, notes: "Done!" }
```

## 🗄️ Database

```sql
-- Bảng mới
product_active_stages     -- Stages đang active
product_stage_workers     -- Workers được gán

-- Bảng cũ vẫn giữ nguyên
products, product_stage_tasks, users, stages
```

## 📊 Workflow ví dụ

```
1. Tạo product (SP001)
2. Admin gán 3 stages: RẬP, CẮT, MAY
3. Admin gán 6 workers (2 workers/stage)
4. Workers tự chọn và bắt đầu làm
5. Khi xong → complete → tự động tính giờ
6. Khi tất cả workers xong → stage complete
```

## 🎨 UI

### Multi-Stage Dashboard (Admin)
- Xem products với nhiều stages active
- Số workers per product
- Số người đang working
- Manage stages & workers

### Worker Dashboard
- My assigned tasks
- My working tasks  
- Start/Pause/Complete buttons
- Hours tracking

## 📖 Docs

| File | Nội dung |
|------|----------|
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Tổng quan triển khai |
| [MULTI_STAGE_GUIDE.md](MULTI_STAGE_GUIDE.md) | Hướng dẫn đầy đủ |
| [SOLUTION_PARALLEL_WORK.md](SOLUTION_PARALLEL_WORK.md) | Thiết kế kỹ thuật |

## ✅ Checklist đầu tiên

- [ ] Start server: `npm start`
- [ ] Check tables created: `product_active_stages`, `product_stage_workers`
- [ ] Login admin: http://localhost:3000/login
- [ ] Open multi-stage dashboard
- [ ] Test assign stages
- [ ] Test worker dashboard
- [ ] Test start/complete work

## 🆚 So với workflow cũ

| | Old | New |
|-|-----|-----|
| Stages/product | 1 | 2-3 parallel |
| Workers/stage | 1 | Multiple |
| Tracking | Stage | Per worker |
| Flexibility | Sequential | Flexible |

## 💡 Tips

1. **Migration tự động** - Không cần setup gì thêm
2. **Backward compatible** - APIs cũ vẫn hoạt động
3. **Authentication required** - Tất cả APIs cần token
4. **Auto-refresh** - Dashboard refresh 30s
5. **Worker permissions** - Chỉ sửa được task của mình

## 🐛 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Tables không tạo | Check server logs |
| API 401 | Check token authentication |
| Dashboard trống | Check network tab (F12) |
| Can't start work | Check if assigned to that task |

## 📞 Quick Help

```bash
# Check database tables
sqlite3 database/manufacturing.db ".tables"

# Check server logs
tail -f logs/app.log

# Test API
curl http://localhost:3000/workflow/overview \
  -H "Authorization: Bearer TOKEN"
```

---

**Status:** ✅ READY  
**Version:** 1.0.0  
**Date:** Feb 13, 2026
