// ==================== GitHub 配置 ====================
const GITHUB_CONFIG = {
    owner: 'grasscake492',
    repo: 'duty-program',
    labels: ['scheduling', 'submission']
};

// ==================== 登录逻辑区域 ====================

// 游客直接进入游客页面
function loginAsGuest() {
    window.location.href = "/guest.html";
}

// 点击“管理员登录”按钮时显示输入框
function toggleAdminLogin() {
    const adminBox = document.getElementById("admin-login");
    if (adminBox.style.display === "none" || adminBox.style.display === "") {
        adminBox.style.display = "block";
    } else {
        adminBox.style.display = "none";
    }
}

// 管理员登录验证
async function loginAsAdmin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            alert("管理员登录成功！");
            window.location.href = "/admin.html";
        } else {
            alert(data.error || "账号或密码错误！");
        }
    } catch (err) {
        console.error("登录错误：", err);
        alert("服务器连接失败，请稍后再试。");
    }
}

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

// ==================== 构建提交数据 & role 绑定 ====================

// 构建提交数据
let selectedRole = null;

// 绑定 role radio 按钮事件
function bindRoleRadios() {
    const radios = document.querySelectorAll('input[name="role"]');
    radios.forEach(radio => {
        // 用户选择时更新 selectedRole
        radio.addEventListener('change', (e) => {
            selectedRole = e.target.value;
            console.log('当前选中身份:', selectedRole);
        });

        // 页面加载时如果有默认选中值，初始化 selectedRole
        if (radio.checked) {
            selectedRole = radio.value;
            console.log('页面加载时默认选中身份:', selectedRole);
        }
    });
}

// 页面加载完成后绑定
document.addEventListener('DOMContentLoaded', bindRoleRadios);


// 确保 DOM 渲染完成后再绑定

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

    const submission = {
        name,
        phone,
        role: selectedRole,       // <- 确保有值
        availability,
        timestamp: new Date().toISOString()
    };

    console.log("构建的提交数据:", submission);
    return submission;
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
