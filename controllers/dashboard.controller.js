const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/v2/customers.model');
const Sale = require('../models/v2/sales.model');
const Type = require('../models/v2/types.model');
const Expense = require('../models/v2/expenses.model').Model;

const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

async function getExpenses() {
    const salaryType = await Type.findOne({ title: 'salary' }).lean();

    if (!salaryType) return 0;

    const expenses = await Expense.find({ type: { $ne: salaryType._id } }).lean();

    const amounts = [];
    expenses.forEach((expense) => amounts.push(expense.amount));
    const amount = amounts.reduce((a, b) => a + b);

    return amount;
}

module.exports.getProfit = catchAsync(async function (req, res, next) {
    const { type } = req.params;

    if (!['gross', 'net'].includes(type.toLowerCase()))
        return next(new AppError('Invalid profit type. Profit type can only be NET or GROSS', 400));

    const sales = await Sale.find().lean();
    const profits = [];
    sales.forEach((sale) => profits.push(sale.retailPrice - sale.inventory.sourcePrice));
    let profit = profits.reduce((a, b) => a + b);

    if (type === 'net') {
        const expenses = await getExpenses();
        profit -= expenses;
    }

    res.status(200).json(profit);
});

module.exports.getExpenses = catchAsync(async function (req, res, next) {
    const amount = await getExpenses();
    res.status(200).json(amount);
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const { page, limit, sort } = req.query;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const customer = await Model.findById(id, { __v: 0 }).lean();

    if (!customer) return next(new AppError('Customer does not exist', 404));

    const sales = await Sale.paginate(
        { customer: mongoose.Types.ObjectId(id) },
        {
            populate: { path: 'customer', select: '-__v' },
            projection: { __v: 0 },
            lean: true,
            page,
            limit,
            sort,
        }
    );

    res.status(200).json({
        customer,
        sales: _.omit(sales, ['page', 'prevPage', 'nextPage', 'limit']),
    });
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    const docs = req.body;

    if (!docs || !docs.length) return next(new AppError('Please enter valid customers', 400));

    await Model.insertMany(docs);

    res.status(200).json();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['name', 'phone']);
    await Model.create(newDoc);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['name', 'phone']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid customer', 400));

    await Model.updateOne({ _id: id }, newDoc, { runValidators: true });

    res.status(200).json();
});

module.exports.remove = catchAsync(async function (req, res, next) {
    let ids = req.params.id.split(',');

    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id(s)', 400));
    }

    ids = ids.map((id) => mongoose.Types.ObjectId(id));

    await Model.deleteMany({ _id: { $in: ids } });

    res.status(200).json();
});
