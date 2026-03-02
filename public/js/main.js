let sysConfig = null;
const weekDaysMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();

    // 1. 游客页面渲染
    if (document.getElementById('guest-schedule-container')) {
        renderGrid('guest-schedule-container', { interactive: true });
        bindSubmitEvent('guest-schedule-container');
    }

    // 2. 管理员页面渲染 (Tab 1)
    if (document.getElementById('admin-fill-grid')) {
        renderGrid('admin-fill-grid', { interactive: true });
        bindSubmitEvent('admin-fill-grid');
    }
});

// ================== 1. 配置加载 (修复 Undefined 问题) ==================
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        sysConfig = await res.json();

        const titleEl = document.getElementById('week-display-title'); // Admin 标题
        const weekInfoEl = document.getElementById('week-info');       // Guest 标题
        const guestBtn = document.getElementById('submit-btn');        // Guest 按钮

        let text = "";

        if (!sysConfig.isSet) {
            text = `<span style="color:#e74c3c;">管理员尚未创建排班计划</span>`;
            if(guestBtn) { guestBtn.disabled = true; guestBtn.innerText = "暂无计划"; }
        } else {
            // ⭐ 修复关键：读取正确的 weekName 字段
            text = `当前目标：<span style="color:#3498db;font-weight:bold;">${sysConfig.weekName}</span> <span style="font-size:0.85em;color:#666">(${sysConfig.startDate} 至 ${sysConfig.endDate})</span>`;
            if(guestBtn) { guestBtn.disabled = false; guestBtn.innerText = "提交排班"; }
        }

        if(titleEl) titleEl.innerHTML = text;
        if(weekInfoEl) weekInfoEl.innerHTML = text;

    } catch (e) {
        console.error("加载配置失败", e);
    }
}

// ================== 2. 超级通用的网格渲染函数 ==================
/**
 * @param {string} containerId 容器ID
 * @param {Object} options 配置项 { interactive: boolean, userData: Object }
 */
function renderGrid(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 如果没配置，显示提示
    if (!sysConfig || !sysConfig.isSet || !sysConfig.selectedDays) {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px; color:#999;">暂无排班计划</p>';
        return;
    }

    const days = sysConfig.selectedDays; // [{date, dayOfWeek}, ...]
    const times = ["一二节", "三四节", "五六节", "七八节"];

    // 设置 CSS Grid
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `80px repeat(${days.length}, 1fr)`;
    container.style.gap = '8px'; // 稍微大一点间距更好看

    let html = `<div class="time-slot" style="background:#34495e; color:white; padding:10px; text-align:center; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold;">时间</div>`;

    // 表头
    days.forEach(d => {
        const shortDate = d.date.substring(5);
        html += `<div class="day-header" style="background:#2c3e50; color:white; padding:10px; text-align:center; border-radius:6px; font-weight:bold;">
                    ${d.dayOfWeek}<br><span style="font-size:12px; font-weight:normal; opacity:0.8">${shortDate}</span>
                 </div>`;
    });

    // 单元格
    times.forEach(time => {
        html += `<div class="time-slot" style="background:#34495e; color:white; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold;">${time}</div>`;

        days.forEach(d => {
            // 检查是否需要高亮 (用于 Tab 2 查看模式)
            let isSelected = false;
            if (options.userData && options.userData.availability) {
                // 比对 date 和 time
                isSelected = options.userData.availability.some(
                    slot => slot.date === d.date && slot.time === time
                );
            }

            const activeClass = isSelected ? 'selected' : '';
            const activeText = isSelected ? '已选' : '空闲';
            const baseStyle = `background:${isSelected ? '#2ecc71' : '#ecf0f1'}; color:${isSelected ? 'white' : '#7f8c8d'};`;
            const cursorStyle = options.interactive ? 'cursor:pointer;' : 'cursor:default;';

            html += `<div class="schedule-cell ${activeClass}" 
                          data-time="${time}" data-day="${d.dayOfWeek}" data-date="${d.date}" 
                          style="${baseStyle} ${cursorStyle} height:60px; display:flex; align-items:center; justify-content:center; border-radius:6px; user-select:none; font-weight:${isSelected?'bold':'normal'}; transition:all 0.2s;">
                          ${activeText}
                     </div>`;
        });
    });

    container.innerHTML = html;

    // 只有交互模式下才绑定点击事件
    if (options.interactive) {
        container.querySelectorAll('.schedule-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                this.classList.toggle('selected');
                if(this.classList.contains('selected')) {
                    this.style.background = '#2ecc71';
                    this.style.color = 'white';
                    this.style.fontWeight = 'bold';
                    this.textContent = '已选';
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 2px 8px rgba(46,204,113,0.4)';
                } else {
                    this.style.background = '#ecf0f1';
                    this.style.color = '#7f8c8d';
                    this.style.fontWeight = 'normal';
                    this.textContent = '空闲';
                    this.style.transform = 'scale(1)';
                    this.style.boxShadow = 'none';
                }
            });
        });
    }
}

// ================== 3. 提交逻辑 ==================
function bindSubmitEvent(gridContainerId) {
    let submitBtn;
    // 区分 Guest 页面和 Admin 页面
    if (gridContainerId === 'admin-fill-grid') {
        submitBtn = document.querySelector('#user #submit-btn');
    } else {
        submitBtn = document.getElementById('submit-btn');
    }

    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
        let name, phone, roleRadio;

        if (gridContainerId === 'admin-fill-grid') {
            name = document.querySelector('#user #name').value.trim();
            phone = document.querySelector('#user #phone').value.trim();
            roleRadio = document.querySelector('#user input[name="role"]:checked');
        } else {
            name = document.getElementById('name').value.trim();
            phone = document.getElementById('phone').value.trim();
            roleRadio = document.querySelector('input[name="role"]:checked');
        }

        if (!name || !phone || !roleRadio) return alert("请完整填写姓名、手机号和身份！");

        const container = document.getElementById(gridContainerId);
        const selectedCells = container.querySelectorAll('.schedule-cell.selected');

        if (selectedCells.length === 0) return alert("请至少勾选一个时间段！");

        const availability = Array.from(selectedCells).map(cell => ({
            day: cell.getAttribute('data-day'),
            date: cell.getAttribute('data-date'),
            time: cell.getAttribute('data-time')
        }));

        const payload = {
            name, phone, role: roleRadio.value,
            week: sysConfig.weekName,
            availability
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "提交中...";

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                alert("提交成功！");
                if (gridContainerId !== 'admin-fill-grid') {
                    window.location.reload();
                } else {
                    // Admin 填表后只清空数据，不刷新
                    selectedCells.forEach(c => c.click()); // 反选
                    document.querySelector('#user #name').value = '';
                    document.querySelector('#user #phone').value = '';
                    submitBtn.disabled = false;
                    submitBtn.innerText = "提交排班";
                }
            } else {
                alert("失败: " + result.error);
                submitBtn.disabled = false;
            }
        } catch (e) {
            alert("网络错误");
            submitBtn.disabled = false;
        }
    });
}

// ================== 4. Admin 功能 (查看详情 & 生成) ==================

// 加载已提交名单 (Tab 2)
window.loadSubmittedData = async function() {
    if (!sysConfig || !sysConfig.isSet) return alert("无排班计划");
    try {
        const res = await fetch('/api/admin/week-data');
        const result = await res.json();

        const container = document.getElementById('submitted-list-view');
        const detailArea = document.getElementById('user-detail-view');
        if(!container) return;

        container.innerHTML = '';
        detailArea.style.display = 'none'; // 隐藏详情区

        if (result.success && result.data.length > 0) {
            result.data.forEach(user => {
                const tag = document.createElement('div');
                tag.className = 'user-tag';
                tag.innerText = `${user.name}`;

                // 点击查看详情逻辑
                tag.onclick = () => {
                    document.querySelectorAll('.user-tag').forEach(t => t.classList.remove('active-tag'));
                    tag.classList.add('active-tag');

                    // 显示详情区域
                    detailArea.style.display = 'block';
                    document.getElementById('detail-name').innerText = user.name;

                    // 调用通用渲染器，传入用户数据，生成只读网格
                    renderGrid('readonly-view-grid', { interactive: false, userData: user });
                };
                container.appendChild(tag);
            });
        } else {
            container.innerHTML = '<p style="color:#999">暂无提交数据</p>';
        }
    } catch (e) { alert("加载失败"); }
};

// 生成排班 (Tab 3)
window.generateSchedule = async function() {
    if (!sysConfig || !sysConfig.isSet) return alert("无排班计划");
    try {
        const res = await fetch('/api/admin/generate', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            // 1. 先渲染预览表格
            renderResultTable(result.data);

            // 2. 再显示下载按钮
            const dlArea = document.getElementById('export-download-area');
            dlArea.innerHTML = `<a href="${result.downloadUrl}" target="_blank" class="download-btn">下载Excel 排班表</a>`;

            alert("排班生成成功！请在下方预览或下载。");
        } else {
            alert("生成失败: " + result.error);
        }
    } catch (e) { alert("错误"); }
};

// 渲染生成结果预览表
function renderResultTable(matrix) {
    const table = document.getElementById('schedule-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // 表头
    thead.innerHTML = `<tr>${matrix[0].map(h => `<th>${h}</th>`).join('')}</tr>`;

    // 表体
    tbody.innerHTML = '';
    for (let i = 1; i < matrix.length; i++) {
        let html = '<tr>';
        matrix[i].forEach((cell, idx) => {
            // 第一列是时间，或者内容不为空，给点底色
            const hasContent = (idx > 0 && cell !== "");
            const style = hasContent ? 'background:#d1f2eb; color:#16a085; font-weight:bold;' : '';
            html += `<td style="${style}">${cell || '-'}</td>`;
        });
        html += '</tr>';
        tbody.innerHTML += html;
    }
}

// 日期计算预览 (Tab 3 创建时用)
window.previewDates = function() {
    const startVal = document.getElementById('start-date').value;
    const endVal = document.getElementById('end-date').value;
    const container = document.getElementById('date-selection-area');
    const checkboxesDiv = document.getElementById('dates-checkboxes');

    if (!startVal || !endVal) return;
    const start = new Date(startVal);
    const end = new Date(endVal);

    if (start > end) return alert("结束日期不能早于开始日期");

    container.style.display = 'block';
    checkboxesDiv.innerHTML = '';

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayName = weekDaysMap[d.getDay()];
        const isChecked = d.getDay() !== 0 ? 'checked' : '';

        const div = document.createElement('div');
        div.innerHTML = `
            <label style="cursor:pointer; display:flex; align-items:center; gap:8px; background:#f8f9fa; padding:8px 12px; border-radius:6px; border:1px solid #eee;">
                <input type="checkbox" name="sched-day" value="${dateStr}" data-day="${dayName}" ${isChecked}>
                <div style="line-height:1.2">
                    <div style="font-weight:bold; color:#2c3e50;">${dateStr}</div>
                    <div style="font-size:12px; color:#7f8c8d;">${dayName}</div>
                </div>
            </label>
        `;
        checkboxesDiv.appendChild(div);
    }
};

window.createSchedule = async function() {
    const weekName = document.getElementById('week-name').value.trim();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!weekName) return alert("请输入周次名称");
    const checkboxes = document.querySelectorAll('input[name="sched-day"]:checked');
    if (checkboxes.length === 0) return alert("请至少勾选一天");

    const selectedDays = Array.from(checkboxes).map(cb => ({
        date: cb.value,
        dayOfWeek: cb.getAttribute('data-day')
    }));

    if (sysConfig && sysConfig.isSet && sysConfig.weekName === weekName) {
        if(!confirm(`确认覆盖 "${weekName}" 的排班计划吗？`)) return;
    }

    try {
        const res = await fetch('/api/admin/create-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekName, startDate, endDate, selectedDays })
        });
        const result = await res.json();
        if (result.success) {
            alert("计划创建成功！");
            window.location.reload();
        } else alert(result.error);
    } catch (e) { alert("网络错误"); }
};