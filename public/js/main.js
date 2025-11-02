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
    const response = await fetch('/api/fetch-issues');
    if (!response.ok) throw new Error('拉取 GitHub Issues 失败');

    const issues = await response.json();

    // 解析 JSON body
    const parsed = issues.map(issue => {
        try {
            const data = JSON.parse(issue.body);
            if (!data.name || !data.phone || !data.role || !data.availability) return null;
            data.timestamp = new Date(data.timestamp || issue.created_at);
            data.html_url = issue.html_url;
            return data;
        } catch (err) {
            console.warn('解析 Issue body 失败', issue.html_url);
            return null;
        }
    }).filter(Boolean);

    return parsed;
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
        days.forEach(day => schedule[day] = Array(timeSlots.length).fill(null));

        // 构建最新提交字典，用于查手机号
        const latestByName = {};
        thisWeekIssues.forEach(issue => {
            try {
                const data = JSON.parse(issue.body);
                if (!data.name) return;
                const ts = new Date(data.timestamp || issue.created_at || Date.now()).getTime();
                if (!latestByName[data.name] || ts > latestByName[data.name].timestamp) {
                    latestByName[data.name] = { ...data, timestamp: ts };
                }
            } catch {}
        });

        const assignedPeople = new Set();

        // 排班
        Object.values(latestByName).forEach(p => {
            if (!p.availability || assignedPeople.has(p.name)) return;
            let placed = false;

            // 优先空格
            p.availability.sort(slot => {
                const day = slot.day;
                const timeIdx = timeSlots.indexOf(slot.time);
                const cell = schedule[day]?.[timeIdx];
                return cell ? 1 : -1; // 空格排前
            });

            for (const slot of p.availability) {
                const dayIndex = days.indexOf(slot.day);
                const timeIndex = timeSlots.indexOf(slot.time);
                if (dayIndex < 0 || timeIndex < 0) continue;

                const cell = schedule[slot.day][timeIndex];
                if (!cell) {
                    schedule[slot.day][timeIndex] = { intern: null, senior: null };
                }

                const tsObj = schedule[slot.day][timeIndex];
                const role = p.role || 'intern';

                if (!tsObj[role]) {
                    tsObj[role] = p.name;
                    assignedPeople.add(p.name);
                    placed = true;
                    break;
                }
            }

            if (!placed) console.warn(`未能排班: ${p.name} (${p.role})`);
        });

        // --- 渲染表格，显示 "xxx（电话号码）、xxx（电话号码）" ---
        tableBody.innerHTML = '';
        let emptyCount = 0;

        for (let ti = 0; ti < timeSlots.length; ti++) {
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            timeCell.textContent = timeSlots[ti];
            row.appendChild(timeCell);

            days.forEach(d => {
                const cell = document.createElement('td');
                const tsObj = schedule[d][ti];
                const valArr = [];

                // 实习生优先
                if (tsObj?.intern) {
                    const phone = latestByName[tsObj.intern]?.phone || '';
                    valArr.push(`${tsObj.intern}（${phone}）`);
                }
                if (tsObj?.senior) {
                    const phone = latestByName[tsObj.senior]?.phone || '';
                    valArr.push(`${tsObj.senior}（${phone}）`);
                }

                if (!valArr.length) emptyCount++;
                cell.textContent = valArr.join(', '); // 拼接成 "xxx（电话）, xxx（电话）"
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        }

        showNotification(`排班表生成成功，无人值班节数: ${emptyCount}`);

    } catch (err) {
        console.error(err);
        showNotification('生成排班表失败: ' + err.message, true);
    }
}


<!--excel生成函数-->
async function exportScheduleWithTemplate(schedule, startDate, endDate) {
    const workbook = await loadTemplate();
    const ws = workbook.Sheets[workbook.SheetNames[0]];

    // 更新 B3 日期
    const startStr = `${startDate.getFullYear()}年${startDate.getMonth()+1}月${startDate.getDate()}日`;
    const endStr = `${endDate.getMonth()+1}月${endDate.getDate()}日`;
    setCellValue(ws, 'B3', `${startStr}-${endStr}`, 'B3');

    // 定义映射
    const cellMapping = {
        '星期一': [ {cell:'B6', styleFrom:'B5'}, {cell:'B8', styleFrom:'B7'}, {cell:'B11', styleFrom:'B10'}, {cell:'B13', styleFrom:'B12'} ],
        '星期二': [ {cell:'D6', styleFrom:'D5'}, {cell:'D8', styleFrom:'D7'}, {cell:'D11', styleFrom:'D10'}, {cell:'D13', styleFrom:'D12'} ],
        '星期三': [ {cell:'F6', styleFrom:'F5'}, {cell:'F8', styleFrom:'F7'}, {cell:'F11', styleFrom:'F10'}, {cell:'F13', styleFrom:'F12'} ],
        '星期四': [ {cell:'B17', styleFrom:'B16'}, {cell:'B19', styleFrom:'B18'}, {cell:'B22', styleFrom:'B21'}, {cell:'B24', styleFrom:'B23'} ],
        '星期五': [ {cell:'D17', styleFrom:'D16'}, {cell:'D19', styleFrom:'D18'}, {cell:'D22', styleFrom:'D21'}, {cell:'D24', styleFrom:'D23'} ]
    };

    // 写入 schedule，保证实习生优先，格式为“姓名（电话）、姓名（电话）”
    const days = Object.keys(cellMapping);
    days.forEach(day => {
        const cells = cellMapping[day];
        schedule[day].forEach((tsObj, i) => {
            if (!cells[i]) return;
            const parts = [];

            // 实习生先
            if (tsObj?.intern) {
                const phone = tsObj.phone?.intern || '';
                parts.push(`${tsObj.intern}（${phone}）`);
            }
            // 高级再
            if (tsObj?.senior) {
                const phone = tsObj.phone?.senior || '';
                parts.push(`${tsObj.senior}（${phone}）`);
            }

            const value = parts.join(', '); // 多人用逗号分隔
            setCellValue(ws, cells[i].cell, value, cells[i].styleFrom);
        });
    });

    // 自动计算周数
    const weekNum = Math.ceil(((startDate - new Date(startDate.getFullYear(),0,1))/86400000 + new Date(startDate.getFullYear(),0,1).getDay()+1)/7);
    const filename = `新闻嗅觉图片社${startDate.getMonth()+1}月${startDate.getDate()}日 第${weekNum}周值班表.xlsx`;

    XLSX.writeFile(workbook, filename);
    console.log("导出 Excel 文件:", filename);
}
