/**
 * 智能排班算法 (支持动态列)
 * @param {Array} users 用户数据
 * @param {Array} selectedDays 管理员配置的日期数组 [{date, dayOfWeek}, ...]
 */
function generateSchedule(users, selectedDays) {
    // 1. 动态生成表头
    // Row 0: ["时间/日期", "星期一", "星期二", ...]
    const headerRow = ["时间/日期", ...selectedDays.map(d => d.dayOfWeek)];
    const schedule = [headerRow];

    const times = ["一二节", "三四节", "五六节", "七八节"];

    // 初始化空表格
    times.forEach(t => {
        // 第一列是时间，后面是空字符串
        const row = [t, ...selectedDays.map(() => "")];
        schedule.push(row);
    });

    // 映射辅助
    const timeRowIndex = { "一二节": 1, "三四节": 2, "五六节": 3, "七八节": 4 };

    // 2. 状态记录
    const shiftCounts = {}; // 记录每人总次数
    const dailyRecord = {}; // 记录每人每天是否已排 (防止一天排两次)

    users.forEach(u => {
        shiftCounts[u.name] = 0;
        dailyRecord[u.name] = {};
    });

    // 3. 构建 Slots
    const slots = [];
    times.forEach(time => {
        selectedDays.forEach((dayObj, index) => {
            // 注意：这里 data column index = index + 1 (因为第0列是标题)
            const colIndex = index + 1;
            const dayName = dayObj.dayOfWeek;

            // 筛选可用人员
            const availableUsers = users.filter(u =>
                u.availability.some(a => a.day === dayName && a.time === time)
            );

            slots.push({
                day: dayName,
                date: dayObj.date,
                time,
                colIndex,
                rowIndex: timeRowIndex[time],
                availableUsers
            });
        });
    });

    // 4. 排序：优先排“人少”的格子
    slots.sort((a, b) => a.availableUsers.length - b.availableUsers.length);

    // 5. 填空
    for (const slot of slots) {
        // 过滤
        let candidates = slot.availableUsers.filter(u => {
            if (shiftCounts[u.name] >= 1) return false; // 每周限1次
            if (dailyRecord[u.name][slot.day]) return false; // 每天限1次
            return true;
        });

        if (candidates.length === 0) continue;

        // 优先高级
        candidates.sort((a, b) => {
            if (a.role === 'senior' && b.role !== 'senior') return -1;
            if (a.role !== 'senior' && b.role === 'senior') return 1;
            return 0;
        });

        const selected = candidates[0];
        const val = `${selected.name}（${selected.phone}）`;

        // 写入矩阵
        // 检查格子里是否已经有人（防止逻辑漏洞），如果有，用逗号拼接
        const currentVal = schedule[slot.rowIndex][slot.colIndex];
        schedule[slot.rowIndex][slot.colIndex] = currentVal ? currentVal + "、" + val : val;

        // 更新状态
        shiftCounts[selected.name]++;
        dailyRecord[selected.name][slot.day] = true;
    }

    return schedule;
}

module.exports = { generateSchedule };