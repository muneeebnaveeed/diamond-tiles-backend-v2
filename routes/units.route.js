const router = require('express').Router();

const { getAll, addOne, remove } = require('../controllers/units.controller');

router.route('/').get(getAll);
router.route('/').post(addOne);
router.route('/id/:id').delete(remove);

module.exports = router;
