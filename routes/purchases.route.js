const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const { getAll, addOne, remove, pay, getCount, refund, getOne } = require('../controllers/purchases.controller');

router.get('/count', getCount);
router.get('/', autoParams, getAll);
router.get('/id/:id', getOne);

router.route('/').post(addOne);
router.put('/:id/refund/:units', refund);

router.route('/pay/id/:id/amount/:amount').post(pay);
router.route('/id/:id').delete(remove);

module.exports = router;
