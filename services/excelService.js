const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '../output');
const TEMPLATE_PATH = path.join(__dirname, '../template/template.xlsx');

/**
 * 导出 Excel
 * @param {Array} scheduleMatrix 排班矩阵
 * @param {string} folderName 文件夹名 (用于存档)
 * @param {string} displayTitle 表格内显示的周次
 * @param {string} dateRange 日期范围
 * @param {number} timestamp 时间戳
 */
async function exportToExcel(scheduleMatrix, folderName, displayTitle, dateRange, timestamp) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`找不到模板文件`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const worksheet = workbook.worksheets[0];

    // 1. 写入标题和日期
    worksheet.getCell('A2').value = `新闻嗅觉图片社${displayTitle}排班表`;
    worksheet.getCell('A3').value = dateRange;

    // 2. 坐标映射 (保持你之前的配置)
    const cellMap = {
        "星期一_一二节": "B6", "星期二_一二节": "D6", "星期三_一二节": "F6",
        "星期一_三四节": "B8", "星期二_三四节": "D8", "星期三_三四节": "F8",
        "星期一_五六节": "B11", "星期二_五六节": "D11", "星期三_五六节": "F11",
        "星期一_七八节": "B13", "星期二_七八节": "D13", "星期三_七八节": "F13",

        "星期四_一二节": "B17", "星期五_一二节": "D17",
        "星期四_三四节": "B19", "星期五_三四节": "D19",
        "星期四_五六节": "B22", "星期五_五六节": "D22",
        "星期四_七八节": "B24", "星期五_七八节": "D24"
    };

    // 3. 填入数据 (使用逗号/顿号处理多人的逻辑)
    const daysHeader = scheduleMatrix[0];
    for (let rowIdx = 1; rowIdx < scheduleMatrix.length; rowIdx++) {
        const timeSlot = scheduleMatrix[rowIdx][0];
        for (let colIdx = 1; colIdx < scheduleMatrix[rowIdx].length; colIdx++) {
            const dayName = daysHeader[colIdx];
            let personStr = scheduleMatrix[rowIdx][colIdx];

            if (personStr) {
                personStr = personStr.replace(/，/g, '、');
                const mapKey = `${dayName}_${timeSlot}`;
                const targetCell = cellMap[mapKey];
                if (targetCell) {
                    worksheet.getCell(targetCell).value = personStr;
                }
            }
        }
    }

    // 4. 文件名带上时间戳，防止浏览器缓存
    // 生成的文件名类似于：新闻嗅觉图片社2026-第5周值班表_1698372100.xlsx
    const fileName = `新闻嗅觉图片社${folderName}值班表_${timestamp}.xlsx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    // 5. 写入文件并等待完成
    await workbook.xlsx.writeFile(filePath);

    return fileName;
}

module.exports = { exportToExcel };