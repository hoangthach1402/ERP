# 🐳 Docker Quick Start - Multi-Stage Feature

## ✅ Tin tốt: Không cần thay đổi Docker config!

Tính năng mới **tự động hoạt động** với Docker hiện tại vì:
- Auto-migration được tích hợp trong `database.js`
- Volumes đã map đúng folders
- Database tự tạo bảng khi khởi động

## 🚀 Cách chạy

### Option 1: Rebuild & Start (Khuyến nghị)
```bash
# Stop containers hiện tại
docker-compose down

# Build lại image (đảm bảo có code mới)
docker-compose build --no-cache

# Start containers
docker-compose up -d

# Xem logs
docker-compose logs -f manufacturing-app
```

### Option 2: Restart nhanh (nếu đã build)
```bash
# Restart container
docker-compose restart manufacturing-app

# Hoặc recreate
docker-compose up -d --force-recreate manufacturing-app
```

### Option 3: Development mode với hot-reload
```bash
# Start với nodemon (code changes auto-reload)
docker-compose up

# Trong terminal khác, xem logs
docker-compose logs -f
```

## 📊 Verify migration thành công

```bash
# 1. Exec vào container
docker exec -it manufacturing-erp sh

# 2. Kiểm tra tables
sqlite3 /app/database/manufacturing.db ".tables"

# Phải thấy:
# - product_active_stages
# - product_stage_workers

# 3. Exit
exit
```

## 🔍 Check logs

```bash
# Xem logs startup
docker-compose logs manufacturing-app | grep -i "multi-stage"

# Phải thấy:
# "✓ Multi-stage and multi-worker tables created"
```

## 🌐 Access dashboards

Sau khi container chạy:

| Dashboard | URL |
|-----------|-----|
| Admin Multi-Stage | http://localhost:3000/workflow/multi-stage-dashboard |
| Worker Tasks | http://localhost:3000/workflow/worker-dashboard |
| Login | http://localhost:3000/login |

## 🔧 Troubleshooting

### Database không tạo tables mới?
```bash
# Reset database và restart
docker-compose down
rm -f database/manufacturing.db*
docker-compose up -d

# Database sẽ được tạo lại với tất cả tables
```

### Code changes không reflect?
```bash
# Volumes đã được map, chỉ cần:
docker-compose restart manufacturing-app

# Hoặc nếu dùng dev mode, nodemon tự reload
```

### Port 3000 đã dùng?
```bash
# Check container nào đang dùng port
docker ps | grep 3000

# Stop container cũ
docker stop manufacturing-erp

# Hoặc đổi port trong docker-compose.yml
ports:
  - "3001:3000"  # Đổi thành 3001
```

## 📦 Production deployment

### Build production image
```bash
# Build với production config
docker-compose -f docker-compose.yml build

# Push to registry (optional)
docker tag manufacturing-erp:latest your-registry/manufacturing-erp:v2.0
docker push your-registry/manufacturing-erp:v2.0
```

### Environment variables
Đảm bảo set đúng trong `.env`:
```env
NODE_ENV=production
DB_PATH=/app/database/manufacturing.db
JWT_SECRET=your_secure_secret_here
SESSION_SECRET=your_session_secret_here
```

## 🎯 Quick Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Exec into container
docker exec -it manufacturing-erp sh

# Check database
docker exec manufacturing-erp sqlite3 /app/database/manufacturing.db ".tables"

# Restart app only
docker-compose restart manufacturing-app

# Scale (không áp dụng vì dùng SQLite)
# docker-compose up -d --scale manufacturing-app=3
```

## 📊 Health check

```bash
# Check container health
docker ps --filter name=manufacturing-erp

# Phải thấy STATUS: "healthy"

# Manual health check
curl http://localhost:3000/product/dashboard
```

## 🔄 Update workflow

Khi có code mới:

1. **Pull code mới**
   ```bash
   git pull
   ```

2. **Rebuild** (chỉ khi có dependencies mới)
   ```bash
   docker-compose build --no-cache
   ```

3. **Restart**
   ```bash
   docker-compose up -d --force-recreate
   ```

4. **Verify**
   ```bash
   docker-compose logs -f manufacturing-app
   ```

## 🎛️ Docker Compose Services

### manufacturing-app
- Main application container
- Port: 3000
- Volumes: src, views, public, database, logs
- Auto-restart: unless-stopped
- Health check: ✅

### nginx (Optional)
- Reverse proxy
- Ports: 80 (HTTP), 443 (HTTPS)
- SSL support
- Depends on: manufacturing-app

## 💾 Volume Management

### Persistent data
```bash
# List volumes
docker volume ls

# Backup database
docker cp manufacturing-erp:/app/database/manufacturing.db ./backup/

# Restore database
docker cp ./backup/manufacturing.db manufacturing-erp:/app/database/
docker-compose restart manufacturing-app
```

### Clean up
```bash
# Remove containers
docker-compose down

# Remove containers + volumes (⚠️ mất data!)
docker-compose down -v

# Remove images
docker rmi manufacturing-erp

# Clean all
docker system prune -a
```

## 🌟 Features working in Docker

✅ Multi-stage workflow  
✅ Multi-worker per stage  
✅ Auto-migration on startup  
✅ Database persistence  
✅ Hot-reload (dev mode)  
✅ Health checks  
✅ Nginx proxy (optional)  
✅ SSL support (optional)  

## 🎯 Next Steps

1. ✅ `docker-compose up -d`
2. ✅ Check logs: `docker-compose logs -f`
3. ✅ Access: http://localhost:3000/workflow/multi-stage-dashboard
4. ✅ Login với admin/admin123
5. ✅ Test tính năng mới!

---

**Status:** ✅ Docker-ready  
**Migration:** ✅ Auto-run on startup  
**Persistence:** ✅ Database volume mounted  
**Hot-reload:** ✅ Dev mode enabled
