const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '../output');
const TEMPLATE_PATH = path.join(__dirname, '../template/template.xlsx');

/**
 * 导出 Excel
 * @param {Array} scheduleMatrix 排班矩阵
 * @param {string} filePrefix 文件名前缀 (例如 "2026-第5周")
 * @param {string} displayWeekTitle 表格内部显示的周次 (例如 "第5周")
 * @param {string} dateRangeStr 日期范围
 */
async function exportToExcel(scheduleMatrix, filePrefix, displayWeekTitle, dateRangeStr) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`找不到模板文件，请确保模板存放在: template/template.xlsx`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const worksheet = workbook.worksheets[0];

    // 1. 写入表格内部标题 (保持友好的 "第5周")
    // 假设模板 A2 是标题 "新闻嗅觉图片社第 x 周排班表"
    worksheet.getCell('A2').value = `新闻嗅觉图片社${displayWeekTitle}排班表`;
    worksheet.getCell('A3').value = dateRangeStr;

    // 2. 坐标映射
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

    // 3. 填入数据
    const days = scheduleMatrix[0];
    for (let rowIdx = 1; rowIdx < scheduleMatrix.length; rowIdx++) {
        const timeSlot = scheduleMatrix[rowIdx][0];

        for (let colIdx = 1; colIdx < scheduleMatrix[rowIdx].length; colIdx++) {
            const day = days[colIdx];
            let personStr = scheduleMatrix[rowIdx][colIdx];

            if (personStr) {
                personStr = personStr.replace(/，/g, '、');
                const mapKey = `${day}_${timeSlot}`;
                const targetCell = cellMap[mapKey];

                if (targetCell) {
                    worksheet.getCell(targetCell).value = personStr;
                }
            }
        }
    }

    // 4. 导出文件名 (带上年份，方便归档)
    // 例如：新闻嗅觉图片社2026-第5周值班表.xlsx
    const fileName = `新闻嗅觉图片社${filePrefix}值班表.xlsx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    await workbook.xlsx.writeFile(filePath);

    return fileName;
}

module.exports = { exportToExcel };