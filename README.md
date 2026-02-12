# Manufacturing ERP System

Hệ thống quản lý sản xuất ngành may dệt với tính năng quét QR, quản lý công đoạn, và theo dõi deadline.

## 🎯 Tính Năng Chính

### 1. **Quản Lý Sản Phẩm**
- Tạo mã sản phẩm duy nhất cho mỗi đơn hàng
- Theo dõi trạng thái sản phẩm qua các công đoạn
- Hiển thị tiến độ sản xuất theo real-time

### 2. **Hệ Thống QR Scan**
- Công nhân quét QR để bắt đầu/kết thúc công đoạn
- Ghi nhận tự động thời gian start/end
- Chuyển giao tự động sang công đoạn kế tiếp

### 3. **5 Công Đoạn Sản Xuất**
1. **Rập** (4 giờ) - Chuẩn bị vải
2. **Cắt** (4 giờ) - Cắt vải theo mẫu
3. **May** (6 giờ) - May chính và may phụ
4. **Thiết Kế Đắp** (6 giờ) - Thiết kế chi tiết
5. **Đính Kết** (12 giờ) - Hoàn thiện sản phẩm

### 4. **Quản Lý Deadline**
- ✅ **Xanh**: Đang trong định mức giờ
- 🔴 **Đỏ**: Trễ hạn, vượt quá định mức

### 5. **Hệ Thống Phân Quyền**
- **ADMIN**: Quản lý toàn bộ hệ thống, tạo người dùng
- **Manager**: Quản lý công đoạn của phòng ban
- **Worker**: Thực hiện công đoạn, quét QR

### 6. **Dashboard Quản Lý**
- Thống kê sản phẩm (tổng, đang làm, hoàn thành, trễ hạn)
- Bảng điều khiển theo dõi công đoạn
- Nhật ký hoạt động chi tiết

## 🛠️ Công Nghệ Sử Dụng

| Thành Phần | Công Nghệ |
| --- | --- |
| **Backend** | Node.js + Express.js |
| **Database** | SQLite3 (lightweight, không cần server DB riêng) |
| **Frontend** | EJS Templates + Tailwind CSS |
| **Authentication** | JWT + Sessions |
| **Containerization** | Docker + Docker Compose |
| **Reverse Proxy** | Nginx |

## 📋 Yêu Cầu Hệ Thống

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Hoặc Node.js**: 18.0+ (chạy local)

## 🚀 Cài Đặt & Chạy

### Option 1: Sử Dụng Docker Compose (Khuyến Nghị)

```bash
# 1. Clone repo
git clone <repo-url>
cd manufacturing-erp

# 2. Tạo file .env
cp .env.example .env
# Chỉnh sửa .env nếu cần

# 3. Build & chạy containers
docker-compose up --build

# 4. Truy cập ứng dụng
# Web: http://localhost:3000
# Nginx: http://localhost
```

### Option 2: Chạy Local (Phát Triển)

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi tạo database
npm run build:db

# 3. Chạy dev server
npm run dev

# 4. Truy cập
# http://localhost:3000
```

## 📝 Thông Tin Đăng Nhập Demo

| Tài Khoản | Mật Khẩu | Vai Trò |
| --- | --- | --- |
| `admin` | `admin123` | ADMIN |

Sau khi đăng nhập, bạn có thể tạo thêm người dùng khác.

## 📊 Quy Trình Sử Dụng

### Bước 1: Admin Tạo Người Dùng
1. Đăng nhập với tài khoản admin
2. Vào menu **Quản Lý** → **Người Dùng**
3. Cấp quy cho từng công nhân theo vị trí khâu

### Bước 2: Admin Tạo Sản Phẩm
1. Vào **Dashboard**
2. Điền **Mã Sản Phẩm** (VD: SP001)
3. Điền **Tên Sản Phẩm**
4. Kích **Tạo Mới**

### Bước 3: Công Nhân Quét QR
1. Công nhân vào trang **Quét QR**
2. Quét mã sản phẩm (hoặc nhập thủ công)
3. Bấm **BẮT ĐẦU** khi làm việc
4. Bấm **HOÀN THÀNH** khi xong
5. Sản phẩm tự động chuyển sang khâu tiếp theo

### Bước 4: Theo Dõi Dashboard
1. Xem tổng quan sản phẩm on **Dashboard**
2. Xem chi tiết từng sản phẩm bằng icon "Xem"
3. Xem cảnh báo trễ hạn ở **Quản Lý** (Admin)

## 📦 Cấu Trúc Project

```
manufacturing-erp/
├── src/
│   ├── app.js                 # Main Express app
│   ├── routes/                # API routes
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── scanRoutes.js
│   │   └── adminRoutes.js
│   ├── controllers/           # Business logic
│   ├── models/                # Database models
│   │   ├── database.js
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Stage.js
│   │   └── ActivityLog.js
│   └── middleware/            # Auth middleware
├── views/                     # EJS templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── scan.ejs
│   ├── product-detail.ejs
│   └── admin/
├── public/                    # Static files
├── database/                  # SQLite database
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── package.json
└── README.md
```

## 🔐 Bảo Mật

### Đã Implement
- ✅ Hashing password với bcryptjs
- ✅ JWT token authentication
- ✅ Session management
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Rate limiting (Nginx)
- ✅ SQL injection prevention

### Production Checklist
- [ ] Thay đổi `JWT_SECRET` trong .env
- [ ] Thay đổi `SESSION_SECRET` trong .env
- [ ] Bật HTTPS với SSL certificate
- [ ] Cấu hình firewall
- [ ] Backup database định kỳ
- [ ] Monitor security logs

## 🐛 Troubleshooting

### Port 3000 đang bị chiếm dụng
```bash
# Thay đổi PORT trong .env
PORT=3001
docker-compose down && docker-compose up --build
```

### Database locked
```bash
# Xóa database và re-init
rm database/manufacturing.db*
docker-compose restart
```

### Logs
```bash
# Xem logs real-time
docker-compose logs -f manufacturing-app

# Xem logs dung lượng
docker-compose logs manufacturing-app | tail -100
```

## 📈 Performance Tips

1. **Database**: SQLite đủ cho 1000+ sản phẩm. Sau đó migrate sang PostgreSQL
2. **Caching**: Thêm Redis cho session management
3. **Load Balancing**: Dùng multiple app containers + load balancer
4. **CDN**: Serve static files từ CDN

## 🔄 API Endpoints

| Method | Endpoint | Mô Tả |
| --- | --- | --- |
| GET | `/` | Trang login |
| POST | `/login` | Đăng nhập |
| GET | `/logout` | Đăng xuất |
| GET | `/product/dashboard` | Dashboard chính |
| GET | `/product/:productId` | Chi tiết sản phẩm |
| POST | `/product/create` | Tạo sản phẩm |
| GET | `/scan/page` | Trang quét QR |
| POST | `/scan/scan` | Scan sản phẩm |
| POST | `/scan/start` | Bắt đầu công đoạn |
| POST | `/scan/complete` | Hoàn thành công đoạn |
| GET | `/admin/dashboard` | Dashboard admin |
| POST | `/admin/user/create` | Tạo người dùng |
| POST | `/admin/user/update-role` | Cập nhật vai trò |
| POST | `/admin/user/deactivate` | Vô hiệu hóa tài khoản |

## 📞 Support & Contribution

- Issues: Tạo GitHub issue
- Feature requests: Discussion tab
- Pull requests: Welcome!

## 📄 License

MIT License - Sử dụng tự do cho mục đích thương mại/cá nhân

## 👨‍💼 Author

Manufacturing ERP Team - 2026

---

**⭐ Nếu thích project này, vui lòng star repo nhé!**
# ERP
