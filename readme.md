# HỆ THỐNG QUẢN LÝ SÁCH CLOUD (CLOUD BOOK MANAGEMENT)

> **Báo cáo bài kiểm tra giữa kì:** Môn Điện toán đám mây
>
> **Sinh viên thực hiện:** Lê Cảm
>
> **Mã số sinh viên (MSSV):** 23IT022
>
> **Nền tảng Cloud PaaS:** Render
>
> **Cơ sở dữ liệu:** MongoDB Atlas (Cloud Database Cluster)
>
> **Ứng dụng trực tuyến (Live Demo):** <https://kiemtragk-cloud-23it022.onrender.com>

## 1. Tổng quan dự án

Dự án triển khai ứng dụng Web Quản lý Sách đáp ứng 3 tiêu chí trọng tâm của kiến trúc điện toán đám mây:

1. **Kiến trúc bảo mật đặc quyền tối thiểu (Least Privilege):** Tách bạch luồng truy vấn Đọc và Ghi thành hai tài khoản người dùng độc lập trên MongoDB Atlas.

2. **Khả năng co giãn chịu tải (Stateless Session):** Không lưu trạng thái phiên làm việc trong RAM máy chủ (in-memory) mà tập trung lưu trữ xuống collection `cloudSessions` trên MongoDB Atlas, cho phép mở rộng đa node mà không mất phiên làm việc.

3. **Quy trình DevOps chuẩn:** Bóc tách tính năng thành các nhánh Git riêng biệt, bảo vệ thông tin mật nhạy cảm qua `.gitignore` và biến môi trường, gộp nhánh bằng cờ `--no-ff` để lưu lại đầy đủ các nút gộp (Merge Node).

## 2. Thông số kỹ thuật cá nhân hóa (23IT022)

Dựa trên mã sinh viên **23IT022**, các quy tắc logic nghiệp vụ được cấu hình cụ thể:

* **Tên Database trên Cloud:** `DB_23IT022`

* **Tài khoản Đọc (Read):** `read_23IT022` (Chỉ cấp quyền `read` trên database `DB_23IT022`)

* **Tài khoản Ghi (Write):** `write_23IT022` (Chỉ cấp quyền `readWrite` trên database `DB_23IT022`)

* **Bộ lọc tiền tố sản phẩm:** Mã sản phẩm bắt buộc phải bắt đầu bằng **3 số cuối MSSV** $\rightarrow$ `022` (Ví dụ hợp lệ: `022A`, `022_IT`). Mọi mã không bắt đầu bằng `022` sẽ bị hệ thống từ chối xử lý và hiển thị thông báo lỗi.

* **Thuế suất VAT tính động:**
  

  $$
  \text{VAT} = (\text{Chữ số cuối MSSV} + 4)\% = (2 + 4)\% = 6\%
  $$

  
  Giá sau thuế được tự động tính trước khi lưu trữ xuống MongoDB Atlas:
  

  $$
  \text{priceWithVAT} = \text{originalPrice} \times 1.06
  $$

* **Giao diện Footer Handlebars:** Hiển thị tự động thông tin cá nhân:

  * Họ và tên: Lê Cảm

  * MSSV: 23IT022

  * Mức VAT áp dụng: 6%

## 3. Kiến trúc luồng dữ liệu & Stateless

```
[ Client / Web Browser ]
         │
         ▼ (HTTPS Request)
┌──────────────────────────────────────────────────────────────┐
│  Render Cloud PaaS (Node.js / Express Server)                │
│                                                              │
│  ├── Views Engine: Express-Handlebars (Footer cá nhân hóa)   │
│  ├── Middleware: Session Validator (connect-mongodb-session) │
│  └── Multi-connection Routing:                               │
│        ├── GET / (Luồng Read)   ──► mongoose.createConnection│
│        │                            (Dùng read_23IT022)      │
│        └── POST /add (Luồng Ghi) ──► mongoose.createConnection│
│                                     (Dùng write_23IT022)     │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
        (Read Only Query)              (Write & Session State)
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│  MongoDB Atlas Cloud (Cluster0 - DB_23IT022)                │
│                                                              │
│  ├── Collection `books`: Lưu trữ danh sách sách & giá VAT    │
│  └── Collection `cloudSessions`: Quản lý Stateless Sessions  │
└──────────────────────────────────────────────────────────────┘

```

## 4. Cấu trúc thư mục mã nguồn

```
KiemTraGK_Cloud_23IT022/
├── node_modules/             # Thư viện phụ thuộc (được ẩn bởi .gitignore)
├── views/
│   ├── layouts/
│   │   └── main.hbs          # Layout chính chứa cấu trúc HTML và Footer
│   └── home.hbs              # Giao diện Form thêm sách và Danh sách sách
├── .env                      # File biến môi trường mật mã (không đẩy lên Git)
├── .gitignore                # Khai báo chặn node_modules/ và .env
├── app.js                    # Mã nguồn chính xử lý kết nối, logic và server
├── package.json              # Khai báo dependencies và scripts khởi chạy
└── README.md                 # Tài liệu hướng dẫn và báo cáo dự án

```

## 5. Cấu hình biến môi trường (Environment Variables)

Hệ thống bảo mật tuyệt đối chuỗi kết nối Cloud. Trên máy tính cá nhân sử dụng file `.env`, trên nền tảng đám mây Render cấu hình qua mục **Environment Variables**:

| Tên biến | Kiểu dữ liệu | Mô tả | 
| ----- | ----- | ----- | 
| `PORT` | Number | Cổng lắng nghe HTTP (Mặc định `3000` hoặc tự động nhận từ Render) | 
| `READ_DB_URI` | String | URI kết nối MongoDB Atlas của user `read_23IT022` | 
| `WRITE_DB_URI` | String | URI kết nối MongoDB Atlas của user `write_23IT022` | 
| `SESSION_SECRET` | String | Khóa bảo mật ký số và mã hóa phiên làm việc | 

## 6. Hướng dẫn cài đặt và chạy thử nghiệm tại Local

### Bước 1: Sao chép mã nguồn (Clone Repository)

```bash
git clone https://github.com/CAMLC25/KiemTraGK_Cloud_23IT022.git
cd KiemTraGK_Cloud_23IT022
```

### Bước 2: Cài đặt các gói phụ thuộc

```bash
npm install
```

### Bước 3: Thiết lập tệp cấu hình bảo mật `.env`

Tạo file `.env` tại thư mục gốc của dự án. Thay thế các trường `<READ_DB_PASSWORD>` và `<WRITE_DB_PASSWORD>` bằng mật khẩu thực tế được cấp riêng từ quản trị viên MongoDB Atlas:

```env
PORT=3000
READ_DB_URI=mongodb+srv://read_23IT022:<READ_DB_PASSWORD>@cluster0.fizdc92.mongodb.net/DB_23IT022?retryWrites=true&w=majority
WRITE_DB_URI=mongodb+srv://write_23IT022:<WRITE_DB_PASSWORD>@cluster0.fizdc92.mongodb.net/DB_23IT022?retryWrites=true&w=majority
SESSION_SECRET=<YOUR_CUSTOM_SESSION_SECRET>
```

> ⚠️ **Lưu ý bảo mật (Security Policy):** Tuyệt đối không commit hoặc chia sẻ tệp `.env` chứa mật khẩu thực tế lên kho chứa mã nguồn công khai (đã được cấu hình tự động bỏ qua qua `.gitignore`).

### Bước 4: Khởi động Web Server

```bash
node app.js
```

Mở trình duyệt và truy cập: `http://localhost:3000`

## 7. Quy trình Quản trị mã nguồn & Kiểm soát DevOps

Dự án áp dụng mô hình phân nhánh tính năng (Feature Branching) có bảo lưu vết gộp:

1. **Khởi tạo và bảo mật:** Thiết lập file `.gitignore` chứa `node_modules/` và `.env` trước khi commit.

2. **Nhánh CSDL (`feature-database`):** Thiết lập cấu trúc kết nối đa luồng (Read/Write).

3. **Nhánh Session (`feature-session`):** Cấu hình Stateless Session lưu trực tiếp trên Cloud MongoDB Atlas.

4. **Gộp nhánh không Fast-Forward (`--no-ff`):**

   ```bash
   git checkout main
   git merge --no-ff feature-database -m "merge: gop nhanh feature-database vao main"
   git merge --no-ff feature-session -m "merge: gop nhanh feature-session vao main"
   ```

5. **Kiểm tra đồ thị cây Git:**

   ```bash
   git log --graph --oneline --all
   ```

## 8. Triển khai Hệ thống thực tế (PaaS Render)

* **Repository GitHub:** `CAMLC25/KiemTraGK_Cloud_23IT022`

* **Runtime:** `Node.js`

* **Build Command:** `npm install`

* **Start Command:** `node app.js`

* **Trạng thái dịch vụ:** `Live` (Hoạt động 24/7)

* **URL:** <https://kiemtragk-cloud-23it022.onrender.com>