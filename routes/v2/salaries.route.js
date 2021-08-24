const router = require('express').Router();

const { getAll, addOne, remove } = require('../../controllers/v2/salaries.controller');
const autoParams = require('../../utils/autoParams');

router.get('/', autoParams, getAll);
router.route('/').post(addOne);
router.route('/id/:id').delete(remove);

module.exports = router;
