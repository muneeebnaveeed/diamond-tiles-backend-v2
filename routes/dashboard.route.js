const router = require('express').Router();
const autoParams = require('../utils/autoParams');

const { getAll, addOne, edit, remove, getOne } = require('../controllers/v2/customers.controller');
const { getPurchases, getSales, getRevenue, getProfit, getExpenses } = require('../controllers/dashboard.controller');

router.get('/purchases', getPurchases);
router.get('/sales', getSales);
router.get('/revenue', getRevenue);
router.get('/expenses', getExpenses);
router.get('/profit', getProfit);

router.get('/', autoParams, getAll);
router.get('/id/:id', autoParams, getOne);
router.route('/').post(addOne);
router.route('/id/:id').patch(edit);
router.route('/id/:id').delete(remove);

module.exports = router;
