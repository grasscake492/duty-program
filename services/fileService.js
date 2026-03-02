const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/weeks');

/**
 * 自动创建周目录并覆盖写入个人txt文件
 */
function saveUserAvailability(week, data) {
    const weekDir = path.join(DATA_DIR, week);

    // 目录如果不存在则自动创建
    if (!fs.existsSync(weekDir)) {
        fs.mkdirSync(weekDir, { recursive: true });
    }

    // 构建每个人的独立 TXT 路径
    const filePath = path.join(weekDir, `${data.name}.txt`);

    // 格式化JSON写入文本文件
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[文件写入] 成功保存个人数据: ${filePath}`);
}

/**
 * 读取某一周下所有人员的可用时间
 */
function getWeekData(week) {
    const weekDir = path.join(DATA_DIR, week);
    if (!fs.existsSync(weekDir)) {
        return[];
    }

    const users =[];
    const files = fs.readdirSync(weekDir);

    for (const file of files) {
        if (file.endsWith('.txt')) {
            const filePath = path.join(weekDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                users.push(JSON.parse(content));
            } catch (error) {
                console.error(`[文件读取] 解析文件失败 (${file}):`, error);
            }
        }
    }
    return users;
}

module.exports = {
    saveUserAvailability,
    getWeekData
};