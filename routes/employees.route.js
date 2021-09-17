const router = require('express').Router();
const autoParams = require('../utils/autoParams');

const { getAll, addOne, edit, remove, getOne } = require('../controllers/employees.controller');

router.get('/', autoParams, getAll);
router.get('/id/:id', autoParams, getOne);
router.route('/').post(addOne);
router.get('/id/:id', edit);

router.route('/id/:id').patch(edit);
router.route('/id/:id').delete(remove);

module.exports = router;
