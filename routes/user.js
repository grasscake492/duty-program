const express = require('express');
const router = express.Router();
const fileService = require('../services/fileService');
const configService = require('../services/configService');

// 新增：前端拉取系统全局配置
router.get('/config', (req, res) => {
    res.json(configService.getConfig());
});

router.post('/submit', (req, res) => {
    try {
        const data = req.body;
        if (!data.name || !data.phone || !data.role || !data.week) {
            return res.status(400).json({ success: false, error: '缺少必要参数' });
        }
        fileService.saveUserAvailability(data.week, data);
        res.json({ success: true, message: '提交成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: '保存失败' });
    }
});

module.exports = router;