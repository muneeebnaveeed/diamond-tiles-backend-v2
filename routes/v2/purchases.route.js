const router = require('express').Router();

const autoParams = require('../../utils/autoParams');
const { getAll, addOne, remove, getCount, getOne, edit } = require('../../controllers/v2/purchases.controller');

router.get('/count', getCount);
router.get('/', autoParams, getAll);
router.get('/id/:id', getOne);
router.patch('/id/:id', edit);

router.route('/').post(addOne);
router.route('/id/:id').delete(remove);

module.exports = router;
