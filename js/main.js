// ==================== GitHub 配置 ====================
// 前端不保存 token，交由后端 API 处理
const GITHUB_CONFIG = {
    owner: 'grasscake492',
    repo: 'duty-program',
    labels: ['scheduling', 'submission']
};

// ==================== 工具函数 ====================

// 获取下一周时间范围（周一到周五）
function getNextWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=周日,1=周一
    const diffToMonday = (day === 0 ? 1 : 8 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0,0,0,0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23,59,59,999);

    return { monday, friday };
}

// 获取当前是今年的第几周
function getWeekNumber(date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const pastDays = Math.floor((date - firstDay) / 86400000);
    return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

// 显示通知
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

    return { name, phone, availability, timestamp: new Date().toISOString() };
}

// 验证提交数据
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

        if (response.ok && result.success) {
            showNotification('提交成功！数据已保存到 GitHub Issue');
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
    const response = await fetch('/api/fetch-issues');
    if (!response.ok) throw new Error('拉取 GitHub Issues 失败');
    return await response.json();
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

// ==================== 排班生成 ====================
async function generateScheduleFromGitHub() {
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '<tr><td colspan="7">正在生成...</td></tr>';

    try {
        const issues = await fetchGitHubIssues();
        const { monday, friday } = getNextWeekRange();

        const thisWeekIssues = issues.filter(issue => {
            try {
                const data = JSON.parse(issue.body);
                const ts = new Date(data.timestamp);
                return ts >= monday && ts <= friday;
            } catch {
                return false;
            }
        });

        const days = ['周一','周二','周三','周四','周五'];
        const timeSlots = ['8:00-10:00','10:00-12:00','14:00-16:00','16:00-18:00'];

        const schedule = {};
        days.forEach(day => schedule[day] = Array(timeSlots.length).fill(''));

        // 记录已排班的人员，保证一周只排一次
        const assignedPeople = new Set();

        // 优先安排人数较少的时间段
        for (const issue of thisWeekIssues) {
            const data = JSON.parse(issue.body);
            const name = data.name || '';
            const phone = data.phone || '';
            const availability = data.availability || [];

            if (assignedPeople.has(name)) continue;

            let placed = false;
            availability.some(slot => {
                const dayIndex = days.indexOf(slot.day);
                const timeIndex = timeSlots.indexOf(slot.time);
                if (dayIndex >= 0 && timeIndex >= 0 && !schedule[slot.day][timeIndex]) {
                    schedule[slot.day][timeIndex] = `${name}（${phone}）`;
                    assignedPeople.add(name);
                    placed = true;
                    return true;
                }
                return false;
            });

            if (!placed) {
                console.warn(`未能排班: ${name}`);
            }
        }

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
            signCell.textContent = ''; // 签到列留空
            row.appendChild(signCell);

            tableBody.appendChild(row);
        }

        showNotification('排班表生成成功！');
        exportScheduleToExcel(schedule, timeSlots, days, monday, friday);

    } catch (err) {
        console.error(err);
        showNotification('生成排班表失败: ' + err.message, true);
    }
}

// ==================== Excel 导出 ====================
function exportScheduleToExcel(schedule, timeSlots, days, monday, friday) {
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    // 标题
    const weekNum = getWeekNumber(monday);
    const title = `新闻嗅觉图片社第${weekNum}周值班（${monday.getFullYear()}年${monday.getMonth()+1}月${monday.getDate()}日-${friday.getMonth()+1}月${friday.getDate()}日）`;
    ws_data.push([title]);
    ws_data.push([]);

    // 表头
    ws_data.push(['时间/日期', ...days, '签到']);

    // 表格内容
    for (let i = 0; i < timeSlots.length; i++) {
        const row = [timeSlots[i]];
        days.forEach(day => row.push(schedule[day][i] || ''));
        row.push(''); // 签到列
        ws_data.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, '排班表');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', submitToBackend);

    const viewIssuesBtn = document.getElementById('view-issues-btn');
    if (viewIssuesBtn) viewIssuesBtn.addEventListener('click', viewIssues);

    const generateBtn = document.getElementById('generate-schedule-btn');
    if (generateBtn) generateBtn.addEventListener('click', generateScheduleFromGitHub);
});
