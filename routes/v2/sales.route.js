const router = require('express').Router();

const { getAll, addOne, remove, getCount, refund, pay, getOne } = require('../../controllers/v2/sales.controller');
const autoParams = require('../../utils/autoParams');

router.get('/count', getCount);
router.get('/id/:id', getOne);

router.get('/', autoParams, getAll);
router.route('/').post(addOne);
router.put('/id/:id/refund', refund);
router.route('/pay/id/:id/amount/:amount').post(pay);
router.route('/id/:id').delete(remove);

module.exports = router;
