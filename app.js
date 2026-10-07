require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const { engine } = require('express-handlebars');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. Cấu hình Handlebars
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');

// 2. Đa luồng kết nối CSDL (Read & Write)
const readConnection = mongoose.createConnection(process.env.READ_DB_URI);
const writeConnection = mongoose.createConnection(process.env.WRITE_DB_URI);

const bookSchema = new mongoose.Schema({
    productId: String,
    name: String,
    originalPrice: Number,
    priceWithVAT: Number
});

const ReadBook = readConnection.model('Book', bookSchema);
const WriteBook = writeConnection.model('Book', bookSchema);

// 3. Stateless Session lưu trực tiếp xuống Cloud Atlas
const store = new MongoDBStore({
    uri: process.env.WRITE_DB_URI,
    collection: 'cloudSessions'
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store
}));

// 4. Thông tin sinh viên Lê Cảm
const mssv = "23IT022";
const prefixMSSV = "022";
const vatRate = 6; // (2 + 4)%

// Middleware render Footer động cho mọi trang
app.use((req, res, next) => {
    res.locals.footerInfo = { fullName: "Lê Cảm", mssv, vatRate };
    next();
});

// 5. Luồng Read: Lấy danh sách sách và hiển thị
app.get('/', async (req, res) => {
    try {
        const books = await ReadBook.find().lean();
        res.render('home', { books, error: req.session.error });
        req.session.error = null; // Xóa thông báo lỗi sau khi hiển thị
    } catch (err) {
        res.status(500).send("Lỗi kết nối cơ sở dữ liệu");
    }
});

// 6. Luồng Write: Thuật toán cá nhân hóa và Thêm sách
app.post('/add', async (req, res) => {
    const { productId, name, price } = req.body;
    
    // Thuật toán: Cài đặt bộ lọc dữ liệu theo tiền tố MSSV
    if (!productId.startsWith(prefixMSSV)) {
        req.session.error = `Từ chối xử lý: Mã sản phẩm bắt buộc phải bắt đầu bằng ${prefixMSSV}`;
        return res.redirect('/');
    }

    // Thuật toán: Tính thuế động trước khi lưu xuống đám mây
    const originalPrice = parseFloat(price);
    const priceWithVAT = originalPrice + (originalPrice * vatRate / 100);

    try {
        await WriteBook.create({ productId, name, originalPrice, priceWithVAT });
        res.redirect('/');
    } catch (err) {
        req.session.error = "Lỗi ghi dữ liệu xuống đám mây";
        res.redirect('/');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy tại http://localhost:${PORT}`));