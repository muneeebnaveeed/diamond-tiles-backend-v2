const router = require('express').Router();

const {
    getPendingUsers,
    getUsers,
    loginUser,
    registerUser,
    deleteOrders,
    deleteOrder,
    confirmUser,
    editUser,
    protect,
    decodeToken,
} = require('../controllers/auth.controller');

router.route('/').get(getUsers);
router.get('/decode/:token', decodeToken);
// router.route('/pending').get(getPendingUsers);
router.route('/confirm/:id/:role').put(confirmUser);
// router.route('/:id').put(editUser);
router.put('/:id', protect, editUser);
// router.route('/:id').get(getOrder);
router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
// router.route('/bulk').delete(deleteOrders);
// router.route('/id/:id').delete(deleteOrder);

module.exports = router;
