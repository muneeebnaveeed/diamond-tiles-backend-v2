const router = require('express').Router();
const autoParams = require('../utils/autoParams');

const { getPurchases, getSales, getRevenue, getProfit, getExpenses } = require('../controllers/dashboard.controller');

router.get('/purchases', autoParams, getPurchases);
router.get('/sales', autoParams, getSales);
router.get('/revenue', autoParams, getRevenue);
router.get('/expenses', autoParams, getExpenses);
router.get('/profit', autoParams, getProfit);

module.exports = router;
