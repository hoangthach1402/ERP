# 📊 Mock Demo & Các Tình Huống Sử Dụng

## Tình Huống 1: Sản Phẩm Hoàn Toàn Bình Thường

### Ngày: 12/02/2026, Sáng 8:00

| Thời Gian | Công Đoạn | Công Nhân | Hành Động | Ghi Chú |
| --- | --- | --- | --- | --- |
| 08:00 | Rập | Nguyễn Văn A | BẮTĐẦU | Mã: SP001 "Áo phông nam" |
| 09:30 | Rập | Nguyễn Văn A | HOÀN THÀNH | ✅ Đúng giờ (1.5h < 4h) |
| 09:30 | Cắt | Trần Thị B | BẮTĐẦU | Tự động chuyển khâu |
| 10:45 | Cắt | Trần Thị B | HOÀN THÀNH | ✅ Đúng giờ (1.25h < 4h) |
| 10:45 | May | Lê Văn C + D | BẮTĐẦU | Cả 2 nhân viên cùng |
| 12:15 | May | Lê Văn C + D | HOÀN THÀNH | ✅ Đúng giờ (1.5h < 6h) |
| 13:00 (Sau ăn) | Thiết Kế | Phạm Văn E | BẮTĐẦU | |
| 14:00 | Thiết Kế | Phạm Văn E | HOÀN THÀNH | ✅ Đúng giờ (1h < 6h) |
| 14:00 | Đính Kết | Hoàng Văn F | BẮTĐẦU | |
| 17:30 | Đính Kết | Hoàng Văn F | HOÀN THÀNH | ✅ Đúng giờ (3.5h < 12h) |

**Dashboard Lúc 17:35**: SP001 ✅ HOÀN THÀNH (Màu xanh)

---

## Tình Huống 2: Sản Phẩm Bị Trễ Hạn

### Ngày: 12/02/2026, Buổi Chiều

| Thời Gian | Công Đoạn | Công Nhân | Hành Động | Ghi Chú |
| --- | --- | --- | --- | --- |
| 10:00 | May | Lê Văn C | BẮTĐẦU | Mã: SP002 "Quần jean" |
| 11:00 | May | Lê Văn C | May bị lỗi, phải làm lại | May chưa xong |
| 14:00 | - | - | **CẢNH BÁO ĐỎ** | 🔴 Quá 6h định mức! |
| 15:00 | May | Lê Văn C | HOÀN THÀNH | ⚠️ Trễ 3 giờ (9h > 6h) |

**Dashboard Lúc 14:05**: 
```
SP002 | Quần Jean | May | 🔴 TRỄ HẠN
      | Thời gian: 4h / 6h | Người: Lê Văn C
```

**Hành động Admin**:
1. Vào **Quản Lý** → Xem cảnh báo **"1 khâu trễ hạn"**
2. Liên hệ Lê Văn C hỏi nguyên nhân
3. Cập nhật ghi chú vào system (hoặc email)

---

## Tình Huống 3: Tắc Nghẽn Bàn Giao

### Ngày: 12/02/2026, Chiều

**Vấn đề**: Khâu Thiết Kế Đắp quá tải, không kịp nhận sản phẩm từ May

| Thời Gian | SP | Khâu | Trạng Thái | Ghi Chú |
| --- | --- | --- | --- | --- |
| 12:00 | SP001 | May | HOÀN THÀNH | ✅ Chuyển sang Thiết Kế |
| 12:15 | SP002 | May | HOÀN THÀNH | ✅ Chuyển sang Thiết Kế |
| 12:30 | SP003 | May | HOÀN THÀNH | ✅ Chuyển sang Thiết Kế |
| 12:45 | SP001 | Thiết Kế | **BẮT ĐẦU** | Phạm Văn E bắt đầu |
| 13:00 | SP002 | Thiết Kế | ⏸️ CHỜ ĐỢI | Đang chờ Phạm làm xong |
| 13:15 | SP003 | Thiết Kế | ⏸️ CHỜ ĐỢI | Cũng đang chờ |

**Dashboard Alert**:
```
🚨 CẢNH BÁO TẮC NGHẼN BÀN GIAO
Khâu Thiết Kế có 2 sản phẩm chờ đợi
Hành động: Gọi thêm nhân viên hoặc di chuyển từ khâu khác
```

---

## Tình Huống 4: Xem Chi Tiết Sản Phẩm

### Dashboard → Click Xem (SP001)

```
SP001 - Áo Phông Nam
═══════════════════════════════════════

Khâu Hiện Tại: Đã Hoàn Thành
Trạng Thái: ✅ HOÀN THÀNH
Ngày Tạo: 12/02/2026

TIMELINE SẢN PHẨM:
═══════════════════════════════════════
① RẬP [✅ HOÀN THÀNH]
   Bắt đầu: 08:00 | Kết thúc: 09:30 (1.5h)
   Người: Nguyễn Văn A

② CẮT [✅ HOÀN THÀNH]
   Bắt đầu: 09:30 | Kết thúc: 10:45 (1.25h)
   Người: Trần Thị B

③ MAY [✅ HOÀN THÀNH]
   Bắt đầu: 10:45 | Kết thúc: 12:15 (1.5h)
   Người: Lê Văn C, Lê Văn D

④ THIẾT KẾ ĐẮP [✅ HOÀN THÀNH]
   Bắt đầu: 13:00 | Kết thúc: 14:00 (1h)
   Người: Phạm Văn E

⑤ ĐÍNH KẾT [✅ HOÀN THÀNH]
   Bắt đầu: 14:00 | Kết thúc: 17:30 (3.5h)
   Người: Hoàng Văn F

TỔNG THỂ:
───────────
Khâu hoàn thành: 5/5
Tổng thời gian: 8.75 giờ
Định mức: 32 giờ
Trạng thái: ✅ ĐÚNG HẠN (Còn 23.25 giờ)
```

---

## Tình Huống 5: Admin Quản Lý Người Dùng

### Admin Dashboard

**Thao tác**:
1. Click **Quản Lý** → **Người Dùng**
2. Tạo người dùng mới:
   ```
   Tên: worker_new
   Mật khẩu: secure123
   Họ tên: Dương Văn G
   Email: duong@manufacturing.local
   Vai trò: [CẮT ▼]
   ```
3. Nếu worker không hiệu suất, click **"⛔ Vô Hiệu Hóa"**

**Bảng Người Dùng**:
```
Tên ĐN | Họ Tên | Email | Vai Trò | Trạng Thái | Hành Động
──────────────────────────────────────────────────────────
admin | Admin | admin@ | ADMIN | Hoạt Động | -
worker1 | Nguyễn A | - | RẬP | Hoạt Động | [Vô Hiệu]
worker2 | Trần B | - | CẮT | Hoạt Động | [Vô Hiệu]
worker3 | Lê C | - | MAY | Hoạt Động | [Vô Hiệu]
```

---

## 📱 Giao Diện Quét QR - Screenshot Text

### Trang Quét QR
```
╔═══════════════════════════════════════╗
║      🔍 QUÉT MÃ QR                    ║
├═══════════════════════════════════════┤
║ Mã Sản Phẩm:                          ║
║ ┌─────────────────────────────────┐   ║
║ │ SP001                    [🔄]   │   ║
║ └─────────────────────────────────┘   ║
├─────────────────────────────────────┤
║ 📦 THÔNG TIN SẢN PHẨM                ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║ Mã SP:        SP001                   ║
║ Tên SP:       Áo Phông Nam            ║
║ Khâu Hiện Tại: RẬP                    ║
║ Trạng Thái:   ⏸️ CHỜ ĐỢI             ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║ ┌─────────────────────────────────┐   ║
║ │   ▶️ BẮT ĐẦU KHÂU RẬP           │   ║
║ └─────────────────────────────────┘   ║
╚═══════════════════════════════════════╝

Thông Tin Công Nhân:
  Tên: Nguyễn Văn A
  Vai Trò: 🏭 RẬP
```

### Sau khi BẮT ĐẦU
```
╔═══════════════════════════════════════╗
║      🔍 QUÉT MÃ QR                    ║
├═══════════════════════════════════════┤
║ Mã Sản Phẩm:                          ║
║ ┌─────────────────────────────────┐   ║
║ │ SP001                    [🔄]   │   ║
║ └─────────────────────────────────┘   ║
├─────────────────────────────────────┤
║ 📦 THÔNG TIN SẢN PHẨM                ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║ Mã SP:        SP001                   ║
║ Tên SP:       Áo Phông Nam            ║
║ Khâu Hiện Tại: RẬP                    ║
║ Trạng Thái:   ⏱️ ĐANG LÀM             ║
║ Bắt đầu lúc: 08:00 (30 phút trước)    ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║ ┌─────────────────────────────────┐   ║
║ │   ✅ HOÀN THÀNH KHÂU           │   ║
║ └─────────────────────────────────┘   ║
╚═══════════════════════════════════════╝
```

---

## Tình Huống 6: May Song Song (May Chính + Phụ May)

### Workflow:
```
May Chính (Lê Văn C):    10:45 ────[6h]──── 16:45 ✅
May Phụ (Lê Văn D):      10:45 ────[6h]──── 16:45 ✅
                              (cùng thời gian)
                         ↓
Chuyển sang: Thiết Kế Đắp (Phạm Văn E)
```

System: Khi **CẢ HAI** May chính + Phụ cùng bấm HOÀN THÀNH, 
thì sản phẩm mới chuyển sang khâu kế tiếp.

**Current Implementation**: 
- Đơn giản: May chính + Phụ may là 1 khâu duy nhất (6h)
- Có thể mở rộng: Tách thành 2 sub-task nếu cần tracking chi tiết

---

## 📈 Dashboard Statistics

```
╔══════════════════════════════════════════════════════╗
║           DASHBOARD - NGÀY 12/02/2026              ║
├──────────────────────────────────────────────────────┤
║  📊 TỔNG SẢN PHẨM: 5     🔄 ĐANG XỬ LÝ: 2          ║
║  ✅ HOÀN THÀNH: 2         🔴 TRỄ HẠN: 1            ║
├──────────────────────────────────────────────────────┤
║  MÃ SP  │ KHÂU  │ TIẾN ĐỘ │ TRẠNG THÁI │ THỜI GIAN ║
╠════════════════════════════════════════════════════════
║ SP001  │ Done  │ ███████ │ ✅ Xanh   │ 8.75h / 32h ║
║ SP002  │ May   │ ██████░ │ 🔴 Đỏ    │ 9h / 6h ⚠️ ║
║ SP003  │ Thiết │ ░░░░░░░ │ ⏸️ Chờ   │ 0h / 6h    ║
║ SP004  │ Cắt   │ ███░░░░ │ 🔵 Xanh   │ 1.5h / 4h  ║
║ SP005  │ Rập   │ ████░░░ │ 🔵 Xanh   │ 2h / 4h    ║
╚═════════════════════════════════════════════════════════

🚨 CẢNH BÁO:
  • SP002 (May) đã quá 3 giờ so với định mức
  • 2 sản phẩm chờ đợi khâu Thiết Kế Đắp (tắc nghĩn?)
  
✅ NHẬT KÝ GẦN ĐÂY:
  14:05 | Nguyễn Văn A | Completed task: RẬP - SP001
  13:45 | Trần Thị B | Completed task: CẮT - SP001
  ...
```

---

## 🎯 KPI Tracking (Future Enhancement)

```
WEEKLY REPORT - TUẦN 1 (12-16/02/2026)
════════════════════════════════════════

Công Nhân: Nguyễn Văn A (RẬP)
├─ Tổng SP hoàn thành: 15
├─ Trung bình thời gian: 3.2h / 4h (đúng hạn 100%)
├─ Hiệu suất: 5/5 ⭐
└─ Ghi chú: Xuất sắc

Công Nhân: Lê Văn C (MAY)
├─ Tổng SP hoàn thành: 10
├─ SP trễ hạn: 2
├─ Trung bình thời gian: 6.8h / 6h
├─ Hiệu suất: 3/5 ⭐
└─ Ghi chú: Cần cải thiện

Tổng Sản Xuất Tuần: 52 sản phẩm
├─ Đúng hạn: 48 (92%)
└─ Trễ hạn: 4 (8%) ⚠️
```

---

## ✨ Đây là một system quản lý sản xuất thực tiễn, hiệu quả và dễ sử dụng!
