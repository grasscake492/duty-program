// 1. 在文件最顶部引入并配置 dotenv
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
// 从环境变量读取端口，如果没有则默认 3000
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 系统启动时自动检查并建立必备的系统文件夹结构
const requiredDirs =[
    path.join(__dirname, 'data', 'weeks'),
    path.join(__dirname, 'output')
];

requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[系统] 自动创建目录: ${dir}`);
    }
});

// ==========================================
// 新增：管理员登录接口（对接你的 login.html）
// ==========================================
app.post('/api/server', (req, res) => {
    const { username, password } = req.body;

    // 从 .env 文件中获取正确的账号密码 (提供默认值防止未配置报错)
    const validUser = process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || '123456';

    if (username === validUser && password === validPass) {
        // 验证成功，返回前端期望的 success: true
        res.json({ success: true, message: '登录成功' });
    } else {
        // 验证失败
        res.status(401).json({ success: false, message: '账号或密码错误' });
    }
});
// ==========================================

// 引入分层路由
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// 挂载路由
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

// 全局错误处理
app.use((err, req, res, next) => {
    console.error('[全局错误]', err.stack);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`图片社排班系统运行中...`);
    console.log(`请在浏览器访问: http://localhost:${PORT}`);
    console.log(`管理员账号: ${process.env.ADMIN_USERNAME}`);
    console.log(`=================================`);
});