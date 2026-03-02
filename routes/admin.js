const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const fileService = require('../services/fileService');
const scheduleService = require('../services/scheduleService');
const excelService = require('../services/excelService');
const configService = require('../services/configService');

// 1. POST 创建/更新排班配置
router.post('/create-schedule', (req, res) => {
    try {
        const { weekName, startDate, endDate, selectedDays } = req.body;

        // 简单校验
        if (!weekName || !selectedDays || selectedDays.length === 0) {
            return res.status(400).json({ success: false, error: '请完整填写周次名称并至少勾选一天' });
        }

        const config = {
            weekName,       // 例如 "第5周"
            startDate,      // "2026-03-02"
            endDate,        // "2026-03-08"
            selectedDays,   // 数组: [{ date: "2026-03-02", dayOfWeek: "星期一" }, ...]
            updatedAt: new Date().toISOString()
        };

        // 保存配置
        configService.setConfig(config);

        // 自动创建对应的数据文件夹
        const weekDir = path.join(__dirname, '../data/weeks', weekName);
        if (!fs.existsSync(weekDir)) {
            fs.mkdirSync(weekDir, { recursive: true });
        }

        res.json({ success: true, message: '排班周创建成功' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: '创建失败: ' + error.message });
    }
});

// 2. GET 查看本周数据 (读取当前配置的 weekName)
router.get('/week-data', (req, res) => {
    try {
        const config = configService.getConfig();
        if (!config.isSet) return res.json({ success: false, error: '暂无排班计划' });

        const data = fileService.getWeekData(config.weekName);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: '获取数据失败' });
    }
});

// 3. POST 生成排班
router.post('/generate', async (req, res) => {
    try {
        const config = configService.getConfig();
        if (!config.isSet) return res.status(400).json({ success: false, error: '请先创建排班计划' });

        const users = fileService.getWeekData(config.weekName);
        if (users.length === 0) return res.status(400).json({ success: false, error: '当前暂无人员提交数据' });

        // 传入 config，算法需要知道本周具体有哪几天
        const scheduleArray = scheduleService.generateSchedule(users, config.selectedDays);

        // 传入 config，Excel 需要知道日期范围
        const dateRangeStr = `${config.startDate} 至 ${config.endDate}`;
        const fileName = await excelService.exportToExcel(scheduleArray, config.weekName, config.weekName, dateRangeStr);

        res.json({
            success: true,
            data: scheduleArray,
            downloadUrl: `/api/admin/download/${encodeURIComponent(fileName)}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: '排班生成失败' });
    }
});

// 下载接口保持不变
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);
    res.download(filePath, filename, (err) => {
        if (err) console.error('[下载失败]', err);
    });
});

module.exports = router;