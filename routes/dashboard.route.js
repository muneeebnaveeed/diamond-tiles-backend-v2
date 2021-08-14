const router = require('express').Router();
const autoParams = require('../utils/autoParams');

const { getAll, addOne, addMany, edit, remove, getOne } = require('../controllers/customers.controller');
const { getProfit, getExpenses } = require('../controllers/dashboard.controller');

router.get('/profit/:type', getProfit);
router.get('/expenses', getExpenses);

router.get('/', autoParams, getAll);
router.get('/id/:id', autoParams, getOne);
router.route('/').post(addOne);
router.route('/many').post(addMany);
router.route('/id/:id').patch(edit);
router.route('/id/:id').delete(remove);

module.exports = router;
