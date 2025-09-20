// ==================== GitHub 配置 ====================
const GITHUB_CONFIG = {
    owner: 'grasscake492',
    repo: 'duty-program',
    labels: ['scheduling', 'submission']
};

// ==================== 工具函数 ====================

// 下周范围（周一到周五）
function getNextWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=周日,1=周一
    const diffToMonday = (day === 0 ? 1 : 8 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    return { monday, friday };
}

// 本周周一 00:00:00
function getThisWeekStart() {
    const now = new Date();
    const day = now.getDay(); // 0=周日,1=周一...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// UI 通知
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification' + (isError ? ' error' : '');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// 构建提交数据
function buildSubmissionData() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();

    const availability = [];
    document.querySelectorAll('.schedule-cell.selected').forEach(cell => {
        availability.push({
            day: cell.getAttribute('data-day'),
            time: cell.getAttribute('data-time')
        });
    });

    const submission = { name, phone, availability, timestamp: new Date().toISOString() };
    console.log("构建的提交数据:", submission);
    return submission;
}

// 校验数据
function validateSubmissionData(data) {
    const errors = [];
    if (!data.name || data.name.length < 2) errors.push('请输入有效的姓名（至少2个字符）');
    if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) errors.push('请输入有效的手机号码');
    if (!data.availability || data.availability.length === 0) errors.push('请至少选择一个可用时间段');
    return errors;
}

// 清空表单
function clearForm() {
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.querySelectorAll('.schedule-cell.selected').forEach(cell => cell.classList.remove('selected'));
}

// ==================== 提交数据 ====================
async function submitToBackend() {
    const submissionData = buildSubmissionData();
    const errors = validateSubmissionData(submissionData);
    if (errors.length > 0) {
        showNotification(errors[0], true);
        return;
    }

    const submitButton = document.getElementById('submit-btn');
    submitButton.disabled = true;

    try {
        const response = await fetch('/api/create-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });

        const result = await response.json();
        console.log("提交结果:", result);

        if (response.ok && result.success) {
            showNotification('提交成功！数据已保存');
            clearForm();
            if (result.issueUrl) window.open(result.issueUrl, '_blank');
        } else {
            throw new Error(result.error || '提交失败');
        }
    } catch (err) {
        console.error(err);
        showNotification('提交失败: ' + err.message, true);
    } finally {
        submitButton.disabled = false;
    }
}

// ==================== GitHub 数据操作 ====================
async function fetchGitHubIssues() {
    console.log("fetchGitHubIssues 被调用了");
    const response = await fetch('/api/fetch-issues');
    if (!response.ok) throw new Error('拉取 GitHub Issues 失败');
    const data = await response.json();
    console.log("拉取到的 issues:", data);
    return data;
}

// ==================== 过滤函数 ====================
// 只保留本周提交的数据（剔除所有本周之前提交的）
function filterThisWeekIssues(issues) {
    const weekStart = getThisWeekStart();
    console.log("本周周一开始时间:", weekStart);

    return issues.filter(issue => {
        try {
            const data = JSON.parse(issue.body);
            const ts = new Date(data.timestamp);
            const keep = ts >= weekStart;
            console.log(`过滤 issue ${issue.id} 时间:`, ts, "是否保留:", keep);
            return keep;
        } catch (err) {
            console.warn("解析 issue.body 失败:", issue.body);
            return false;
        }
    });
}

// ==================== 查看 Issues ====================
async function viewIssues() {
    try {
        const issues = await fetchGitHubIssues();
        const thisWeekIssues = filterThisWeekIssues(issues);

        const container = document.getElementById('issues-list');
        container.innerHTML = '';

        if (thisWeekIssues.length === 0) {
            container.textContent = '本周暂无提交记录';
            return;
        }

        const list = document.createElement('ul');
        thisWeekIssues.forEach(issue => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${issue.html_url}" target="_blank">${issue.title}</a> - ${issue.created_at}`;
            list.appendChild(li);
        });
        container.appendChild(list);
    } catch (err) {
        console.error(err);
        showNotification('拉取 Issues 失败: ' + err.message, true);
    }
}

// ==================== 模板读取 ====================
async function loadTemplate() {
    const response = await fetch('/schedule_template.xlsx');
    if (!response.ok) throw new Error('模板文件加载失败');
    const arrayBuffer = await response.arrayBuffer();
    return XLSX.read(arrayBuffer, { type: 'array' });
}

// ==================== 排班生成 ====================
async function generateScheduleFromGitHub() {
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '<tr><td colspan="7">正在生成...</td></tr>';

    try {
        const issues = await fetchGitHubIssues();
        const thisWeekIssues = filterThisWeekIssues(issues);
        console.log("本周 issues 数:", thisWeekIssues.length);

        const days = ['星期一','星期二','星期三','星期四','星期五'];
        const timeSlots = ['一二节','三四节','五六节','七八节'];

        const schedule = {};
        days.forEach(day => schedule[day] = Array(timeSlots.length).fill(''));

        const assignedPeople = new Set();

        for (const issue of thisWeekIssues) {
            try {
                const data = JSON.parse(issue.body);
                const name = data.name || '';
                const phone = data.phone || '';
                const availability = data.availability || [];

                console.log(`处理 issue: ${name}`, availability);

                if (assignedPeople.has(name)) continue;

                let placed = false;
                availability.some(slot => {
                    const dayIndex = days.indexOf(slot.day);
                    const timeIndex = timeSlots.indexOf(slot.time);
                    console.log("匹配 slot:", slot, "dayIndex:", dayIndex, "timeIndex:", timeIndex);

                    if (dayIndex >= 0 && timeIndex >= 0 && !schedule[slot.day][timeIndex]) {
                        schedule[slot.day][timeIndex] = `${name}（${phone}）`;
                        assignedPeople.add(name);
                        placed = true;
                        return true;
                    }
                    return false;
                });

                if (!placed) console.warn(`未能排班: ${name}`);
            } catch (err) {
                console.warn("解析 issue.body 失败:", issue.body);
            }
        }

        console.log("最终生成的 schedule:", schedule);

        // 渲染表格
        tableBody.innerHTML = '';
        for (let i = 0; i < timeSlots.length; i++) {
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            timeCell.textContent = timeSlots[i];
            row.appendChild(timeCell);

            days.forEach(day => {
                const cell = document.createElement('td');
                cell.textContent = schedule[day][i] || '';
                row.appendChild(cell);
            });

            const signCell = document.createElement('td');
            signCell.textContent = '';
            row.appendChild(signCell);

            tableBody.appendChild(row);
        }

        showNotification('排班表生成成功！');

        const { monday, friday } = getNextWeekRange();
        const workbook = await loadTemplate();
        exportScheduleWithTemplate(workbook, schedule, timeSlots, days, monday, friday);

    } catch (err) {
        console.error(err);
        showNotification('生成排班表失败: ' + err.message, true);
    }
}

function exportScheduleWithTemplate(workbook, schedule, timeSlots, days, startDate, endDate) {
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    // --- 核心函数：写入时保留样式 ---
    function setCellValue(ws, targetCell, value, styleSourceCell) {
        if (ws[targetCell]) {
            ws[targetCell].v = value; // 已有单元格 → 保留样式
        } else {
            ws[targetCell] = {
                t: 's',
                v: value,
                s: ws[styleSourceCell]?.s || {}
            };
        }
    }

    // 下一周日期写入模板 B3
    const startStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
    const endStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    if (ws['B3']) {
        ws['B3'].v = `${startStr}-${endStr}`;   // ✅ 只改值，不覆盖样式
    } else {
        ws['B3'] = { t: 's', v: `${startStr}-${endStr}` };
    }

    // 映射表：每一天对应的单元格数组（只写左上角单元格）
    // --- 定义映射：每个目标单元格 + 样式来源 ---
    const cellMapping = {
        '星期一': [
            { cell: 'B6', styleFrom: 'B5' },
            { cell: 'B8', styleFrom: 'B7' },
            { cell: 'B11', styleFrom: 'B10' },
            { cell: 'B13', styleFrom: 'B12' }
        ],
        '星期二': [
            { cell: 'D6', styleFrom: 'D5' },
            { cell: 'D8', styleFrom: 'D7' },
            { cell: 'D11', styleFrom: 'D10' },
            { cell: 'D13', styleFrom: 'D12' }
        ],
        '星期三': [
            { cell: 'F6', styleFrom: 'F5' },
            { cell: 'F8', styleFrom: 'F7' },
            { cell: 'F11', styleFrom: 'F10' },
            { cell: 'F13', styleFrom: 'F12' }
        ],
        '星期四': [
            { cell: 'B17', styleFrom: 'B16' },
            { cell: 'B19', styleFrom: 'B18' },
            { cell: 'B22', styleFrom: 'B21' },
            { cell: 'B24', styleFrom: 'B23' }
        ],
        '星期五': [
            { cell: 'D17', styleFrom: 'D16' },
            { cell: 'D19', styleFrom: 'D18' },
            { cell: 'D22', styleFrom: 'D21' },
            { cell: 'D24', styleFrom: 'D23' }
        ]
    };


    for (const day of days) {
        const cells = cellMapping[day];
        if (!cells) continue;

        for (let i = 0; i < schedule[day].length; i++) {
            const value = schedule[day][i] || '';
            const firstCell = cells[i]; // 只写左上角
            if (firstCell) {
                const { cell, styleFrom } = cells[i] || {};
                if (cell) {
                    setCellValue(ws, cell, value, styleFrom);
                }

            }
        }
    }

    // 保存文件
    const filename = `新闻嗅觉图片社${startDate.getMonth() + 1}月${startDate.getDate()}日 第x周值班表.xlsx`;
    console.log("导出 Excel 文件:", filename);
    XLSX.writeFile(workbook, filename);
}