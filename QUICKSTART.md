# 🚀 Hướng Dẫn Bắt Đầu Nhanh (Quick Start)

## 📋 Yêu Cầu
- Docker & Docker Compose cài đặt sẵn
- Hoặc Node.js 18+ (cho chạy local)

## ⚡ Quick Start - Docker (Khuyến Nghị)

### Bước 1: Clone hoặc download project
```bash
cd d:\APP\ 2026\ERP
```

### Bước 2: Build và chạy
```bash
# Windows
docker-compose up --build

# Linux/Mac
docker-compose up --build
```

### Bước 3: Truy cập
- **Ứng dụng**: http://localhost:3000
- **Nginx**: http://localhost

### Bước 4: Đăng nhập
```
Username: admin
Password: admin123
```

---

## 💻 Quick Start - Local Node.js

### Bước 1: Cài dependencies
```bash
npm install
```

### Bước 2: Khởi tạo database
```bash
npm run build:db
```

### Bước 3: Chạy dev server
```bash
npm run dev
```

### Bước 4: Truy cập
- http://localhost:3000

---

## 🎯 Hành Động Đầu Tiên

### 1️⃣ Tạo Công Nhân
1. Đăng nhập Admin (admin/admin123)
2. Click **Quản Lý** → Tạo người dùng mới
3. Điền thông tin:
   - Tên đăng nhập: `worker1`
   - Mật khẩu: `pass123`
   - Họ tên: `Nguyễn Văn A`
   - Vai trò: `RAP` (Rập)

### 2️⃣ Tạo Sản Phẩm
1. Gở Dashboard
2. Điền **Mã SP**: `SP001`
3. Điền **Tên SP**: `Áo phông nam`
4. Click **Tạo Mới**

### 3️⃣ Quét QR Bắt Đầu
1. Đăng xuất (logout) Admin
2. Đăng nhập với tài khoản `worker1`
3. Click **Quét QR**
4. Nhập: `SP001`
5. Click **BẮT ĐẦU KHÂU**

### 4️⃣ Hoàn Thành Công Đoạn
1. Nhập lại: `SP001`
2. Click **HOÀN THÀNH**
3. Sản phẩm tự động chuyển sang khâu tiếp theo (CẮT)

---

## 🔧 Troubleshooting Nhanh

| Lỗi | Giải pháp |
| --- | --- |
| Port 3000 bị chiếm dụng | Thay port: `PORT=3001` trong .env |
| Database không khởi tạo | Delete `database/manufacturing.db` và restart |
| Connection refused | Check docker: `docker ps` |
| Permission denied (Linux) | Chạy: `sudo usermod -aG docker $USER` |

---

## 📚 Tài Liệu Chi Tiết

Xem chi tiết tại [README.md](./README.md)

---

## 🎓 Video Demo

[Sẽ được thêm]

---

## ✅ Setup Hoàn Tất!

Bạn đã sẵn sàng sử dụng Manufacturing ERP. Hãy tạo sản phẩm đầu tiên và yêu cầu công nhân bắt đầu quét QR!
