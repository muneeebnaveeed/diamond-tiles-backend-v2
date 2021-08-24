/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../../models/v2/sales.model');
const Inventory = require('../../models/v2/inventories.model');
const Customer = require('../../models/v2/customers.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const Type = require('../../models/v2/types.model');
const { readQuantityFromString } = require('../../utils/readUnit');

module.exports.getCount = catchAsync(async function (req, res, next) {
    const count = await Model.count({});
    res.status(200).json(count);
});

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const results = await Model.paginate(
        {},
        {
            projection: { __v: 0 },
            populate: { path: 'customer', select: '-__v' },
            lean: true,
            page,
            limit,
            sort,
        }
    );

    // results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    const doc = await Model.findById(id);

    if (!doc) return next(new AppError('Sale not found', 404));

    // results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(doc);
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const sale = await Model.findById(id);

    if (!sale) return next(new AppError('Inventory does not exist', 404));

    const { sourcePrice, paid, isRemaining } = sale;

    if (!isRemaining) return next(new AppError('Khaata is already cleared', 400));

    // if (amount > sourcePrice - paid) return next(new AppError('You are paying amount in extra', 400));

    sale.paid += amount;

    if (sale.paid >= sourcePrice) sale.isRemaining = false;

    await sale.save();

    res.status(200).send();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['customer', 'products', 'paid']);

    if (Object.keys(body).length < 3) return next(new AppError('Please enter a valid purchase', 400));

    if (!mongoose.isValidObjectId(body.customer)) return next(new AppError('Please enter a valid customer id', 400));

    const customer = await Customer.findById(body.customer, { __v: 0 }).lean();

    if (!customer) return next(new AppError('Customer does not exist', 404));

    const productIds = [...new Set(body.products.map((p) => p.product))].map((id) => mongoose.Types.ObjectId(id));

    console.log(productIds);

    const productsInDB = await Inventory.find({ 'product._id': { $in: productIds } }, { __v: 0 }).lean();
    const products = [];

    for (const p of body.products) {
        const inventory = productsInDB.find((e) => e.product._id.toString() === p.product);
        p.product = inventory.product;
        if (!p.product) return next(new AppError('Product does not exist', 404));
        const { type, unit } = inventory.product;

        if (type.title.toLowerCase() === 'tile') {
            const variants = {};
            Object.entries(p.variants).forEach(([key, value]) => {
                variants[key] = readQuantityFromString(value, unit.value);
            });
            p.variants = variants;
        } else {
            const quantity = readQuantityFromString(p.quantity, unit.value);
            p.quantity = quantity;
        }

        products.push(p);
    }

    const sourcePrice =
        products.length > 1 ? products.map((p) => p.sourcePrice).reduce((a, b) => a + b) : products[0].sourcePrice;
    body.isRemaining = body.paid < sourcePrice;

    // await addInventory({ product: product._id, quantity: body.quantity }, next);

    body.customer = customer;
    body.products = products;

    await Model.create(body);
    res.status(200).send();
});

module.exports.refund = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const body = req.body.map((b) => _.pick(b, ['product', 'quantity', 'sourcePrice', 'variants']));

    const productIds = [...new Set(body.map((b) => b.product))].map((e) => mongoose.Types.ObjectId(e));

    const [purchase, productsInDB] = await Promise.all([
        Model.findById(id).lean(),
        Inventory.find({ 'product._id': { $in: productIds } }),
    ]);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    const promises = [];

    for (const b of body) {
        const inventory = productsInDB.find((e) => e.product._id.toString() === b.product);
        b.product = inventory.product;

        if (!b.product) return next(new AppError('Product does not exist', 404));

        const index = purchase.products.findIndex((e) => e.product._id.toString() === b.product._id.toString());
        if (index === -1) return;

        const { unit } = b.product;
        const { products } = purchase;
        let newSourcePrice = null;

        if (b.variants) {
            const oldQuantities = Object.values(products[index].variants);
            const oldTotalQuantity =
                oldQuantities.length > 1 ? oldQuantities.reduce((x, y) => x + y) : oldQuantities[0];
            const oldSourcePricePerUnit = products[index].sourcePrice / oldTotalQuantity;

            Object.entries(b.variants).forEach(([key, value]) => {
                products[index].variants[key] -= readQuantityFromString(value, unit.value);
                if (products[index].variants[key] < 0) return next(new AppError('Insufficient Inventory', 404));
            });

            const newQuantities = Object.values(products[index].variants);
            const newTotalQuantity =
                newQuantities.length > 1 ? newQuantities.reduce((x, y) => x + y) : newQuantities[0];

            newSourcePrice = Math.round(oldSourcePricePerUnit * newTotalQuantity);
        } else {
            const quantity = readQuantityFromString(b.quantity, unit.value);
            const oldSourcePricePerUnit = b.sourcePrice / quantity;
            products[index].quantity -= quantity;
            newSourcePrice = Math.round(oldSourcePricePerUnit * products[index].quantity);
            if (products[index].quantity < -1) return next(new AppError('Insufficient Inventory', 404));
        }

        products[index].sourcePrice = newSourcePrice;

        promises.push(Model.findByIdAndUpdate(id, { products }));
    }

    await Promise.all(promises);

    res.status(200).send();
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
