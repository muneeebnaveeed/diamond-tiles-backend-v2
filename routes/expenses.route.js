const router = require('express').Router();

const {
    getAll,
    addOne,
    remove,
    getAllTypes,
    addOneType,
    removeTypes,
    getAllSalaries,
    getKhaata,
    getOne,
} = require('../controllers/expenses.controller');
const autoParams = require('../utils/autoParams');

router.get('/', autoParams, getAll);
router.get('/id/:id', autoParams, getOne);
router.get('/types', autoParams, getAllTypes);
router.get('/salaries', autoParams, getAllSalaries);
router.get('/khaata', autoParams, getKhaata);
router.route('/').post(addOne);
router.route('/types').post(addOneType);
// router.route('/many').post(addMany);
router.route('/id/:id').delete(remove);
router.route('/types/id/:id').delete(removeTypes);

module.exports = router;
