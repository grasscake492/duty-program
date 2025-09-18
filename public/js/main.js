// ==================== GitHub 配置 ====================
const GITHUB_CONFIG = {
    owner: 'grasscake492',
    repo: 'duty-program',
    labels: ['scheduling', 'submission']
};

// ==================== 工具函数 ====================
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

function getLastWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=周日, 1=周一...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() + diffToMonday - 7);
    lastMonday.setHours(0,0,0,0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23,59,59,999);

    return { lastMonday, lastSunday };
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification' + (isError ? ' error' : '');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

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

function validateSubmissionData(data) {
    const errors = [];
    if (!data.name || data.name.length < 2) errors.push('请输入有效的姓名（至少2个字符）');
    if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) errors.push('请输入有效的手机号码');
    if (!data.availability || data.availability.length === 0) errors.push('请至少选择一个可用时间段');
    return errors;
}

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

async function viewIssues() {
    try {
        const issues = await fetchGitHubIssues();
        const container = document.getElementById('issues-list');
        container.innerHTML = '';

        if (issues.length === 0) {
            container.textContent = '暂无提交记录';
            return;
        }

        const list = document.createElement('ul');
        issues.forEach(issue => {
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
        const { lastMonday, lastSunday } = getLastWeekRange();

        const thisWeekIssues = issues.filter(issue => {
            try {
                const data = JSON.parse(issue.body);
                const ts = new Date(data.timestamp);
                // 只要不是上周提交的数据，就保留
                return ts > lastSunday;
            } catch {
                return false;
            }
        });


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

        const workbook = await loadTemplate();
        exportScheduleWithTemplate(workbook, schedule, timeSlots, days, monday, friday);

    } catch (err) {
        console.error(err);
        showNotification('生成排班表失败: ' + err.message, true);
    }
}

// ==================== Excel 导出（模板版，自动写日期） ====================
function exportScheduleWithTemplate(workbook, schedule, timeSlots, days, startDate, endDate) {
    const ws = workbook.Sheets[workbook.SheetNames[0]];

    // 下一周日期写入模板 B3
    const startStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
    const endStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    ws['B3'] = { t: 's', v: `${startStr}-${endStr}` };

    // 映射表：每一天对应的单元格数组（只写左上角单元格）
    const cellMapping = {
        '星期一': ['B6','B8','B11','B13'],
        '星期二': ['D6','D8','D11','D13'],
        '星期三': ['F6','F8','F11','F13'],
        '星期四': ['B17','B19','B22','B24'],
        '星期五': ['D17','D19','D22','D24']
    };

    for (const day of days) {
        const cells = cellMapping[day];
        if (!cells) continue;

        for (let i = 0; i < schedule[day].length; i++) {
            const value = schedule[day][i] || '';
            const firstCell = cells[i]; // 只写左上角
            if (firstCell) ws[firstCell] = { t: 's', v: value };
        }
    }

    // 保存文件
    const filename = `新闻嗅觉图片社${startDate.getMonth() + 1}月${startDate.getDate()}日 第x周值班表.xlsx`;
    console.log("导出 Excel 文件:", filename);
    XLSX.writeFile(workbook, filename);
}
