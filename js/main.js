// ==================== GitHub 配置 ====================
// 前端不再保存 token
const GITHUB_CONFIG = {
    owner: 'grasscake492',      // GitHub 用户名
    repo: 'duty-program',       // 仓库名
    labels: ['scheduling', 'submission'] // Issue 标签
};

// ==================== 工具函数 ====================

// 获取本周时间范围（周一至周日）
function getCurrentWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0 = 周日, 1 = 周一
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0,0,0,0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return { monday, sunday };
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

// 提交数据到后端 API（Vercel）
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

// 拉取 GitHub Issues（走后端 API）
async function fetchGitHubIssues() {
    const response = await fetch('/api/fetch-issues');
    if (!response.ok) throw new Error('拉取 GitHub Issues 失败');
    return await response.json();
}

// 查看 GitHub Issues 列表
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

// 生成本周排班表
async function generateScheduleFromGitHub() {
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '<tr><td colspan="6">正在生成...</td></tr>';

    try {
        const issues = await fetchGitHubIssues();
        const { monday, sunday } = getCurrentWeekRange();

        // 过滤本周数据
        const thisWeekIssues = issues.filter(issue => {
            try {
                const data = JSON.parse(issue.body);
                const ts = new Date(data.timestamp);
                return ts >= monday && ts <= sunday;
            } catch(e) {
                return false;
            }
        });

        const days = ['周一','周二','周三','周四','周五'];
        const timeSlots = ['8:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'];

        const schedule = {};
        days.forEach(day => schedule[day] = Array(timeSlots.length).fill(''));

        // 填充排班表
        thisWeekIssues.forEach(issue => {
            const data = JSON.parse(issue.body);
            const name = data.name || '';
            const phone = data.phone || '';
            const availability = data.availability || [];

            availability.forEach(slot => {
                const dayIndex = days.indexOf(slot.day);
                const timeIndex = timeSlots.indexOf(slot.time);
                if(dayIndex>=0 && timeIndex>=0){
                    const current = schedule[slot.day][timeIndex];
                    schedule[slot.day][timeIndex] = current ? current + `\n${name} (${phone})` : `${name} (${phone})`;
                }
            });
        });

        // 渲染表格
        tableBody.innerHTML = '';
        for(let i=0;i<timeSlots.length;i++){
            const row=document.createElement('tr');
            const timeCell=document.createElement('td');
            timeCell.textContent=timeSlots[i];
            row.appendChild(timeCell);

            days.forEach(day=>{
                const cell=document.createElement('td');
                cell.textContent=schedule[day][i] || '';
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        }

        showNotification('本周排班表生成成功！');
        exportScheduleToExcel(schedule, timeSlots, days);

    } catch(err){
        console.error(err);
        showNotification('生成排班表失败: ' + err.message, true);
    }
}

// ==================== Excel 导出 ====================
function exportScheduleToExcel(schedule, timeSlots, days) {
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    ws_data.push(['时间/日期', ...days]);

    for (let i = 0; i < timeSlots.length; i++) {
        const row = [timeSlots[i]];
        days.forEach(day => row.push(schedule[day][i] || ''));
        ws_data.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, '本周排班');

    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `本周排班-${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn) submitBtn.addEventListener('click', submitToBackend);

    const viewIssuesBtn = document.getElementById('view-issues-btn');
    if(viewIssuesBtn) viewIssuesBtn.addEventListener('click', viewIssues);

    const generateBtn = document.getElementById('generate-schedule-btn');
    if(generateBtn) generateBtn.addEventListener('click', generateScheduleFromGitHub);
});
