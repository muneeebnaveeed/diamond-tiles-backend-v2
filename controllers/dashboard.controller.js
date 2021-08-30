const mongoose = require('mongoose');
const _ = require('lodash');
const Purchase = require('../models/v2/purchases.model').Model;
const Model = require('../models/v2/customers.model');
const Sale = require('../models/v2/sales.model');
const Type = require('../models/v2/types.model');
const Expense = require('../models/v2/expenses.model');
const Salary = require('../models/v2/salaries.model');

const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getPurchases = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const results = await Purchase.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const sum = results.map((item) => item.totalSourcePrice).reduce((prev, curr) => prev + curr, 0);

    res.status(200).send({
        sum,
        count: results.length,
    });
});

module.exports.getSales = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const results = await Sale.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const sum = results.map((item) => item.totalRetailPrice).reduce((prev, curr) => prev + curr, 0);

    console.log({ sum });

    res.status(200).send({
        sum,
        count: results.length,
    });
});
async function getRevenue(startDate, endDate) {
    const sales = await Sale.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const retailPrices = sales.map((item) => item.totalRetailPrice);
    const sourcePrices = [];

    sales.forEach((sale) => sale.products.forEach((product) => sourcePrices.push(product.sourcePrice)));

    let retailPrice = 0;
    if (retailPrices.length) {
        retailPrice = retailPrices.length > 1 ? retailPrices.reduce((prev, curr) => prev + curr, 0) : retailPrices[0];
    }
    let sourcePrice = 0;
    if (sourcePrices.length) {
        sourcePrice = sourcePrices.length > 1 ? sourcePrices.reduce((prev, curr) => prev + curr, 0) : sourcePrices[0];
    }

    return retailPrice - sourcePrice;
}
module.exports.getRevenue = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const revenue = await getRevenue(startDate, endDate);

    res.status(200).json(revenue);
});

async function getExpenses(startDate, endDate) {
    const expenses = await Expense.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const totalExpenses = expenses.map((item) => item.amount).reduce((prev, curr) => prev + curr, 0);

    const salaries = await Salary.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const totalSalaries = salaries.map((item) => item.amount).reduce((prev, curr) => prev + curr, 0);

    return totalExpenses + totalSalaries;
}

module.exports.getProfit = catchAsync(async function (req, res, next) {
    // Revenue - Expenses
    const { startDate, endDate } = req.query;

    const revenue = await getRevenue(startDate, endDate);
    const expenses = await getExpenses(startDate, endDate);

    res.status(200).json({ profit: revenue - expenses });
});

module.exports.getExpenses = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const amount = await getExpenses(startDate, endDate);
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
