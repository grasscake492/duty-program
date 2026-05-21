const express = require('express');
const router = express.Router();
const loanService = require('../services/loanService');

function sendError(res, error) {
    res.status(400).json({ success: false, error: error.message || '操作失败' });
}

router.get('/inventory', (req, res) => {
    try {
        res.json({ success: true, data: loanService.getInventory() });
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/inventory', (req, res) => {
    try {
        const item = loanService.addInventoryItem(req.body);
        res.json({ success: true, data: item });
    } catch (error) {
        sendError(res, error);
    }
});

router.put('/inventory/:id', (req, res) => {
    try {
        const item = loanService.updateInventoryItem(req.params.id, req.body);
        res.json({ success: true, data: item });
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/inventory/:id', (req, res) => {
    try {
        loanService.deleteInventoryItem(req.params.id);
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/apply', (req, res) => {
    try {
        const loan = loanService.createLoan(req.body);
        res.json({ success: true, data: loan, message: '申请提交成功，请等待管理员审核' });
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/loans', (req, res) => {
    try {
        res.json({ success: true, data: loanService.getLoans() });
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/loans/:id/status', (req, res) => {
    try {
        const loan = loanService.changeLoanStatus(req.params.id, req.body.status);
        res.json({ success: true, data: loan });
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/conflicts', (req, res) => {
    try {
        const warnings = loanService.getConflictWarnings(
            req.body.items || [],
            req.body.startTime,
            req.body.endTime
        );
        res.json({ success: true, data: warnings });
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
