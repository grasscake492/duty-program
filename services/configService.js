const fs = require('fs');
const path = require('path');

// 存储当前生效的排班配置
const configPath = path.join(__dirname, '../data/active_schedule.json');

/**
 * 获取当前生效的排班配置
 */
function getConfig() {
    if (!fs.existsSync(configPath)) {
        return { isSet: false };
    }
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { isSet: true, ...config };
    } catch (e) {
        return { isSet: false };
    }
}

/**
 * 保存管理员创建的新排班配置
 * @param {Object} scheduleConfig 包含 weekName, dates, days 等
 */
function setConfig(scheduleConfig) {
    // 保存配置到 JSON
    fs.writeFileSync(configPath, JSON.stringify(scheduleConfig, null, 2), 'utf8');
    return true;
}

module.exports = { getConfig, setConfig };