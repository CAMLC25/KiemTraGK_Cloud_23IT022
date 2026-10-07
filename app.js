require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const { engine } = require('express-handlebars');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình Handlebars
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');

// Cấu hình khắc phục lỗi TLS alert 80 cho Render & Node v24
const mongooseOptions = {
    tls: true,
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 5000
};

// 1. Kết nối cơ sở dữ liệu (Đọc / Ghi)
const readConnection = mongoose.createConnection(process.env.READ_DB_URI, mongooseOptions);
const writeConnection = mongoose.createConnection(process.env.WRITE_DB_URI, mongooseOptions);

const bookSchema = new mongoose.Schema({
    productId: String,
    name: String,
    originalPrice: Number,
    priceWithVAT: Number
});

const ReadBook = readConnection.model('Book', bookSchema);
const WriteBook = writeConnection.model('Book', bookSchema);

// 2. Stateless Session lưu trực tiếp trên Cloud Atlas
const store = new MongoDBStore({
    uri: process.env.WRITE_DB_URI,
    collection: 'cloudSessions',
    connectionOptions: mongooseOptions
});

store.on('error', (err) => console.log('Session Store Error:', err.message));

app.use(session({
    secret: process.env.SESSION_SECRET || 'SecretKey_23IT022',
    resave: false,
    saveUninitialized: false,
    store: store
}));

// 3. Thông tin cá nhân hóa
const mssv = "23IT022";
const prefixMSSV = "022";
const vatRate = 6; // (2 + 4)%

app.use((req, res, next) => {
    res.locals.footerInfo = { fullName: "Lê Cảm", mssv, vatRate };
    next();
});

// 4. Luồng Xem danh sách (Read)
app.get('/', async (req, res) => {
    try {
        const books = await ReadBook.find().lean();
        res.render('home', { books, error: req.session.error });
        req.session.error = null;
    } catch (err) {
        console.error("Lỗi Read Connection:", err);
        res.status(500).send("Lỗi kết nối cơ sở dữ liệu: " + err.message);
    }
});

// 5. Luồng Thêm mới (Write)
app.post('/add', async (req, res) => {
    const { productId, name, price } = req.body;
    
    if (!productId || !productId.startsWith(prefixMSSV)) {
        req.session.error = `Từ chối xử lý: Mã sản phẩm bắt buộc phải bắt đầu bằng ${prefixMSSV}`;
        return res.redirect('/');
    }

    const originalPrice = parseFloat(price);
    const priceWithVAT = originalPrice + (originalPrice * vatRate / 100);

    try {
        await WriteBook.create({ productId, name, originalPrice, priceWithVAT });
        res.redirect('/');
    } catch (err) {
        console.error("Lỗi Write Connection:", err);
        req.session.error = "Lỗi ghi dữ liệu xuống đám mây";
        res.redirect('/');
    }
});

// 6. Bind chính xác 0.0.0.0 theo yêu cầu Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy thành công tại port ${PORT}`);
});