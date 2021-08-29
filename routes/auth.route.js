const router = require('express').Router();

const {
    getUsers,
    loginUser,
    registerUser,
    confirmUser,
    editUser,
    protect,
    decodeToken,
    remove,
} = require('../controllers/auth.controller');

router.route('/').get(getUsers);
router.get('/decode/:token', decodeToken);
router.route('/confirm/:id/:role').put(confirmUser);
// router.put('/:id', protect, editUser);
router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
router.route('/id/:id').delete(remove);

module.exports = router;
