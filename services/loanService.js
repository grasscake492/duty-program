const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const LOANS_DIR = path.join(DATA_DIR, 'loans');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

const STATUS = {
    PENDING: 'Pending',
    PROCESSED: 'Processed',
    RETURNED: 'Returned'
};

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOANS_DIR)) fs.mkdirSync(LOANS_DIR, { recursive: true });
    if (!fs.existsSync(INVENTORY_FILE)) {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify([], null, 2), 'utf8');
    }
}

function readJson(filePath, fallback) {
    ensureStorage();
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return fallback;
    return JSON.parse(content);
}

function writeJson(filePath, data) {
    ensureStorage();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getStoredInventory() {
    return readJson(INVENTORY_FILE, []).map(normalizeInventoryItem);
}

function saveInventory(items) {
    writeJson(INVENTORY_FILE, items.map(normalizeInventoryItem));
}

function normalizeBaseStatus(status) {
    if (status === '需要维修' || status === '维护中') return '需要维修';
    return '在库';
}

function normalizeInventoryItem(item) {
    const totalQuantity = Number(item.totalQuantity);
    const availableQuantity = Number(
        item.availableQuantity === undefined ? totalQuantity : item.availableQuantity
    );
    const oldName = [item.name, item.model].filter(Boolean).join(' ').trim();

    return {
        id: item.id || `eq_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        category: String(item.category || '未分类').trim(),
        name: String(oldName || item.name || '').trim(),
        totalQuantity,
        availableQuantity,
        status: normalizeBaseStatus(item.status),
        updatedAt: item.updatedAt || new Date().toISOString()
    };
}

function validateInventoryItem(item) {
    if (!item.category || !item.name) throw new Error('设备分类和设备名称不能为空');
    if (!Number.isInteger(item.totalQuantity) || item.totalQuantity < 0) {
        throw new Error('总数量必须为非负整数');
    }
    if (!Number.isInteger(item.availableQuantity) || item.availableQuantity < 0) {
        throw new Error('可用数量必须为非负整数');
    }
    if (item.availableQuantity > item.totalQuantity) {
        throw new Error('可用数量不能大于总数量');
    }
}

function getInventory() {
    return enrichInventoryStatus(getStoredInventory());
}

function enrichInventoryStatus(inventory) {
    const activeLoans = readStoredLoans()
        .map(withEffectiveStatus)
        .filter(loan => loan.status === STATUS.PROCESSED);

    return inventory.map(item => {
        const relatedLoans = activeLoans.filter(loan =>
            loan.items.some(loanItem => loanItem.inventoryId === item.id)
        );
        const overdueLoan = relatedLoans.find(loan => loan.effectiveStatus === 'Overdue');

        if (overdueLoan) {
            return { ...item, displayStatus: '逾期未归还', displayStatusType: 'overdue' };
        }
        if (relatedLoans.length > 0) {
            const names = [...new Set(relatedLoans.map(loan => loan.borrowerName))].join('、');
            return { ...item, displayStatus: `${names}使用中`, displayStatusType: 'in-use' };
        }
        if (item.status === '需要维修') {
            return { ...item, displayStatus: '需要维修', displayStatusType: 'repair' };
        }
        return { ...item, displayStatus: '在库', displayStatusType: 'stored' };
    });
}

function addInventoryItem(payload) {
    const item = normalizeInventoryItem(payload);
    validateInventoryItem(item);

    const inventory = getStoredInventory();
    const duplicated = inventory.some(existing =>
        existing.category === item.category && existing.name === item.name
    );
    if (duplicated) throw new Error('同分类同名称设备已存在，请直接修改库存数量');

    item.updatedAt = new Date().toISOString();
    inventory.push(item);
    saveInventory(inventory);
    return enrichInventoryStatus([item])[0];
}

function updateInventoryItem(id, payload) {
    const inventory = getStoredInventory();
    const index = inventory.findIndex(item => item.id === id);
    if (index === -1) throw new Error('设备不存在');

    const borrowed = Math.max(0, inventory[index].totalQuantity - inventory[index].availableQuantity);
    const next = normalizeInventoryItem({ ...inventory[index], ...payload, id });
    if (payload.totalQuantity !== undefined && next.totalQuantity < borrowed) {
        throw new Error(`总数量不能小于当前已借出数量 ${borrowed}`);
    }
    if (payload.totalQuantity !== undefined && payload.availableQuantity === undefined) {
        next.availableQuantity = next.totalQuantity - borrowed;
    }
    validateInventoryItem(next);

    next.updatedAt = new Date().toISOString();
    inventory[index] = next;
    saveInventory(inventory);
    return enrichInventoryStatus([next])[0];
}

function deleteInventoryItem(id) {
    const inventory = getStoredInventory();
    const item = inventory.find(existing => existing.id === id);
    if (!item) throw new Error('设备不存在');
    if (item.availableQuantity !== item.totalQuantity) {
        throw new Error('该设备仍有借出数量，不能删除');
    }

    saveInventory(inventory.filter(existing => existing.id !== id));
}

function loanFilePath(id) {
    return path.join(LOANS_DIR, `${id}.json`);
}

function readStoredLoans() {
    ensureStorage();
    return fs.readdirSync(LOANS_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => readJson(path.join(LOANS_DIR, file), null))
        .filter(Boolean);
}

function pruneOldReturnedLoans() {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 5);

    readStoredLoans().forEach(loan => {
        const finishedAt = new Date(loan.returnedAt || loan.updatedAt || loan.createdAt);
        if (loan.status === STATUS.RETURNED && finishedAt < cutoff) {
            fs.unlinkSync(loanFilePath(loan.id));
        }
    });
}

function getLoans() {
    pruneOldReturnedLoans();
    return readStoredLoans()
        .map(withEffectiveStatus)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getLoan(id) {
    const loan = readJson(loanFilePath(id), null);
    if (!loan) throw new Error('申请单不存在');
    return loan;
}

function saveLoan(loan) {
    writeJson(loanFilePath(loan.id), loan);
}

function withEffectiveStatus(loan) {
    const effectiveStatus = isOverdue(loan) ? 'Overdue' : loan.status;
    return { ...loan, effectiveStatus };
}

function isOverdue(loan) {
    return loan.status === STATUS.PROCESSED && new Date() > new Date(loan.endTime);
}

function validateLoanPayload(payload) {
    if (!payload.borrowerName || !payload.phone) throw new Error('请填写借用人姓名和联系电话');
    if (!payload.startTime || !payload.endTime || !payload.pickupTime) {
        throw new Error('请完整填写借用时间、归还时间和前往借取时间');
    }
    if (new Date(payload.startTime) >= new Date(payload.endTime)) {
        throw new Error('预计归还时间必须晚于借用开始时间');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('请至少选择一项物资');
    }

    payload.items.forEach(item => {
        if (!item.inventoryId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
            throw new Error('物资清单中存在无效设备或数量');
        }
    });
}

function enrichRequestedItems(requestedItems) {
    const inventory = getStoredInventory();
    return requestedItems.map(requested => {
        const item = inventory.find(existing => existing.id === requested.inventoryId);
        if (!item) throw new Error('选择的设备不存在');
        if (item.status === '需要维修') throw new Error(`${item.name} 当前需要维修，暂不可借用`);
        return {
            inventoryId: item.id,
            category: item.category,
            name: item.name,
            quantity: Number(requested.quantity)
        };
    });
}

function assertInventoryAvailable(items, startTime, endTime) {
    const inventory = getStoredInventory();
    const conflicts = getConflictWarnings(items, startTime, endTime);

    items.forEach(requested => {
        const stock = inventory.find(item => item.id === requested.inventoryId);
        if (!stock) throw new Error('设备不存在');
        if (requested.quantity > stock.availableQuantity) {
            throw new Error(`${stock.name} 当前库存不足，剩余 ${stock.availableQuantity}`);
        }
    });

    const blocking = conflicts.find(conflict => conflict.availableDuringRequestedPeriod < conflict.requestedQuantity);
    if (blocking) {
        throw new Error(`${blocking.name} 与已借出时段冲突，可用 ${blocking.availableDuringRequestedPeriod}`);
    }
}

function createLoan(payload) {
    validateLoanPayload(payload);
    const items = enrichRequestedItems(payload.items);
    assertInventoryAvailable(items, payload.startTime, payload.endTime);

    const now = new Date().toISOString();
    const loan = {
        id: `loan_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        borrowerName: String(payload.borrowerName).trim(),
        phone: String(payload.phone).trim(),
        items,
        startTime: payload.startTime,
        endTime: payload.endTime,
        pickupTime: payload.pickupTime,
        note: String(payload.note || '').trim(),
        status: STATUS.PENDING,
        createdAt: now,
        updatedAt: now,
        processedAt: null,
        returnedAt: null
    };

    saveLoan(loan);
    return withEffectiveStatus(loan);
}

function changeLoanStatus(id, nextStatus) {
    const loan = getLoan(id);
    if (nextStatus === STATUS.PROCESSED) return markProcessed(loan);
    if (nextStatus === STATUS.RETURNED) return markReturned(loan);
    throw new Error('不支持的状态变更');
}

function markProcessed(loan) {
    if (loan.status !== STATUS.PENDING) throw new Error('只有待处理申请可以确认借出');
    assertInventoryAvailable(loan.items, loan.startTime, loan.endTime);

    const inventory = getStoredInventory();
    loan.items.forEach(requested => {
        const item = inventory.find(existing => existing.id === requested.inventoryId);
        item.availableQuantity -= requested.quantity;
        item.updatedAt = new Date().toISOString();
    });

    loan.status = STATUS.PROCESSED;
    loan.processedAt = new Date().toISOString();
    loan.updatedAt = loan.processedAt;

    saveInventory(inventory);
    saveLoan(loan);
    return withEffectiveStatus(loan);
}

function markReturned(loan) {
    if (loan.status !== STATUS.PROCESSED) throw new Error('只有已处理申请可以确认归还');

    const inventory = getStoredInventory();
    loan.items.forEach(requested => {
        const item = inventory.find(existing => existing.id === requested.inventoryId);
        if (item) {
            item.availableQuantity = Math.min(item.totalQuantity, item.availableQuantity + requested.quantity);
            item.updatedAt = new Date().toISOString();
        }
    });

    loan.status = STATUS.RETURNED;
    loan.returnedAt = new Date().toISOString();
    loan.updatedAt = loan.returnedAt;

    saveInventory(inventory);
    saveLoan(loan);
    return withEffectiveStatus(loan);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
    return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

function getConflictWarnings(items, startTime, endTime) {
    const inventory = getStoredInventory();
    const activeLoans = getLoans().filter(loan =>
        loan.status === STATUS.PROCESSED && overlaps(startTime, endTime, loan.startTime, loan.endTime)
    );

    return items.map(requested => {
        const stock = inventory.find(item => item.id === requested.inventoryId);
        const borrowedInPeriod = activeLoans.reduce((sum, loan) => {
            const matched = loan.items.find(item => item.inventoryId === requested.inventoryId);
            return sum + (matched ? matched.quantity : 0);
        }, 0);
        const totalQuantity = stock ? stock.totalQuantity : 0;

        return {
            inventoryId: requested.inventoryId,
            category: stock ? stock.category : requested.category,
            name: stock ? stock.name : requested.name,
            requestedQuantity: Number(requested.quantity),
            borrowedInPeriod,
            availableDuringRequestedPeriod: Math.max(0, totalQuantity - borrowedInPeriod)
        };
    }).filter(item => item.borrowedInPeriod > 0);
}

module.exports = {
    STATUS,
    ensureStorage,
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    getLoans,
    createLoan,
    changeLoanStatus,
    getConflictWarnings
};
