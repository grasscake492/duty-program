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

        if (!weekName || !selectedDays || selectedDays.length === 0) {
            return res.status(400).json({ success: false, error: '请完整填写周次名称并至少勾选一天' });
        }

        // 核心修改：从开始日期提取年份
        // startDate 格式为 "2026-03-02"
        const year = startDate.substring(0, 4);

        // 构造唯一的文件夹名称：年份-周次名 (例如: "2026-第5周")
        const folderName = `${year}-${weekName}`;

        const config = {
            weekName,       // 展示用： "第5周"
            folderName,     // 存储用： "2026-第5周" (新增字段)
            startDate,
            endDate,
            selectedDays,
            updatedAt: new Date().toISOString()
        };

        // 1. 保存配置
        configService.setConfig(config);

        // 2. 处理数据文件夹
        // 注意：现在使用的是 folderName (带年份的)
        const weekDir = path.join(__dirname, '../data/weeks', folderName);

        if (fs.existsSync(weekDir)) {
            // 如果 "2026-第5周" 已存在，说明是管理员在重置【本年度】的这一周
            // 此时应该清空，防止数据混淆。但不会误删 2025 年的数据。
            const files = fs.readdirSync(weekDir);
            files.forEach(file => {
                if (file.endsWith('.txt')) {
                    fs.unlinkSync(path.join(weekDir, file));
                }
            });
            console.log(`[系统] 已重置排班数据: ${folderName}`);
        } else {
            // 创建新目录
            fs.mkdirSync(weekDir, { recursive: true });
            console.log(`[系统] 新建年份排班目录: ${folderName}`);
        }

        res.json({ success: true, message: `排班创建成功！\n存储目录: ${folderName}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: '创建失败: ' + error.message });
    }
});

// 2. GET 查看本周数据
router.get('/week-data', (req, res) => {
    try {
        const config = configService.getConfig();
        if (!config.isSet) return res.json({ success: false, error: '暂无排班计划' });

        // 核心修改：读取 folderName (带年份的)
        const data = fileService.getWeekData(config.folderName);
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

        // 读取带年份的文件夹数据
        const users = fileService.getWeekData(config.folderName);
        if (users.length === 0) return res.status(400).json({ success: false, error: '当前暂无人员提交数据' });

        const scheduleArray = scheduleService.generateSchedule(users, config.selectedDays);

        const dateRangeStr = `${config.startDate} 至 ${config.endDate}`;

        // 导出时，folderName用于找模板位置（目前不需要），weekName用于Excel内部标题
        // 这里的 fileName 可以选择带年份也可以不带，为了清晰，建议带上年份
        // 传入 config.folderName 作为 weekNum 参数，这样文件名就是 "新闻嗅觉图片社2026-第5周值班表.xlsx"
        const fileName = await excelService.exportToExcel(
            scheduleArray,
            config.folderName, // 以前传的是 weekName，现在传 folderName (2026-第5周)
            config.weekName,   // 传给 Excel 内部标题用 (显示 "第5周")
            dateRangeStr
        );

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

// 下载接口
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);
    res.download(filePath, filename, (err) => {
        if (err) console.error('[下载失败]', err);
    });
});

module.exports = router;