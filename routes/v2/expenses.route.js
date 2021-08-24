const router = require('express').Router();

const { getAll, addOne, remove, getKhaata } = require('../../controllers/v2/expenses.controller');
const autoParams = require('../../utils/autoParams');

router.get('/', autoParams, getAll);
router.get('/khaata', autoParams, getKhaata);
router.route('/').post(addOne);
// router.route('/many').post(addMany);
router.route('/id/:id').delete(remove);

module.exports = router;
