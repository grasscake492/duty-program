const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '../output');
const TEMPLATE_PATH = path.join(__dirname, '../template/template.xlsx');

// 注意：exceljs 是异步的，所以这里加了 async
async function exportToExcel(scheduleMatrix, folderString, weekNum, dateRangeStr) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`找不到模板文件，请确保模板存放在: template/template.xlsx`);
    }

    // 1. 实例化 Workbook 并读取模板（完美保留所有样式）
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);

    // 获取第一个工作表
    const worksheet = workbook.worksheets[0];

    // 2. 写入标题和日期（直接赋值会完美覆盖旧文字，但保留字体和居中格式）
    worksheet.getCell('B2').value = `新闻嗅觉图片社第${weekNum}周排班表`;
    worksheet.getCell('B3').value = dateRangeStr;

    // 3. 坐标映射表 (根据你的截图提取)
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

    // 4. 填入数据
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
                    // 给单元格赋值，ExcelJS 会自动保留该格子的原有样式
                    worksheet.getCell(targetCell).value = personStr;
                }
            }
        }
    }

    // 5. 导出文件
    const fileName = `新闻嗅觉图片社第${weekNum}周值班表.xlsx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    await workbook.xlsx.writeFile(filePath);

    return fileName;
}

module.exports = { exportToExcel };