const _ = require('lodash');
const Purchase = require('../models/v2/purchases.model').Model;
const Sale = require('../models/v2/sales.model');
const Expense = require('../models/v2/expenses.model');
const Salary = require('../models/v2/salaries.model');

const { catchAsync } = require('./errors.controller');

module.exports.getPurchases = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    console.log(await Purchase.find(), startDate, endDate);

    const results = await Purchase.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
    const prices = results.map((item) => item.totalSourcePrice);
    let sum = 0;
    if (prices.length > 1) sum = prices.reduce((prev, curr) => prev + curr, 0);
    else if (prices.length === 1) sum = prices[0];

    res.status(200).send({
        sum,
        count: results.length,
    });
});

module.exports.getSales = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const results = await Sale.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();

    const prices = results.map((item) => item.totalRetailPrice);
    let sum = 0;
    if (prices.length > 1) sum = prices.reduce((prev, curr) => prev + curr, 0);
    else if (prices.length === 1) sum = prices[0];

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
    const [expenses, salaries] = await Promise.all([
        Expense.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
        Salary.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
    ]);
    const totalExpenses = expenses.map((item) => item.amount).reduce((prev, curr) => prev + curr, 0);

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
