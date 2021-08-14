const mongoose = require('mongoose');
const _ = require('lodash');
const axios = require('axios');
const e = require('cors');
const { Model, convertUnitsOfInventory } = require('../models/purchases.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');
const Sale = require('../models/sales.model');
const Inventory = require('../models/inventories.model');
const { addInventory } = require('./inventories.controller');

const Supplier = require('../models/suppliers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getCount = catchAsync(async function (req, res, next) {
    const count = await Model.count({});
    res.status(200).json(count);
});

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const results = await Model.paginate(
        {},
        { projection: { __v: 0 }, populate: { path: 'supplier', select: '-__v' }, lean: true, page, limit, sort }
    );

    // eslint-disable-next-line no-param-reassign
    results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    const doc = await Model.findById(id).lean();

    if (!doc) return next(new AppError('Purchase not found', 404));
    res.status(200).json(convertUnitsOfInventory(doc));
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['supplier', 'sourcePrice', 'product', 'quantity', 'units', 'paid']);

    if (Object.keys(body).length !== 6) return next(new AppError('Please enter a valid inventory', 400));

    if (!mongoose.isValidObjectId(body.supplier)) return next(new AppError('Please enter a valid supplier id', 400));

    const supplier = await Supplier.findById(body.supplier).lean();

    if (!supplier) return next(new AppError('Supplier does not exist', 404));

    if (!mongoose.isValidObjectId(body.product)) return next(new AppError('Please enter a valid product id', 400));

    const product = await Product.findById(body.product, { __v: 0 }).lean();

    if (!product) return next(new AppError('Product does not exist', 400));

    body.units = [...new Set(body.units)];
    const unitIds = [];

    for (const u of body.units) {
        if (!mongoose.isValidObjectId(u)) return next(new AppError('Invalid unit id(s)', 400));
        unitIds.push(mongoose.Types.ObjectId(u));
    }

    const units = await Unit.find({ _id: { $in: unitIds } }, { __v: 0 }).lean();

    if (units.length !== unitIds.length) return next(new AppError('Invalid units', 400));

    const areValidUnits = units.every((u) => {
        if (!u.type || !product.type) return false;
        return u.type._id.toString() === product.type._id.toString();
    });
    if (!areValidUnits) return next(new AppError('Please enter units that are suitable for the product', 400));

    body.units = units.map((u) => ({ ..._.omit(u, ['type', 'createdAt']), unitExists: true }));

    body.isRemaining = body.paid < body.sourcePrice * body.quantity;

    body.product = { ...product, productExists: true };

    // await axios.post('http://localhost:4000/inventories', { product: product._id, quantity: body.quantity });

    await addInventory({ product: product._id, quantity: body.quantity }, next);

    const purchase = await Model.create(body);
    res.status(200).send(purchase._id);
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const inventory = await Model.findById(id);

    if (!inventory) return next(new AppError('Inventory does not exist', 404));

    const { sourcePrice, quantity, isRemaining } = inventory;

    if (!isRemaining) return next(new AppError('Khaata is already cleared', 400));

    // if (amount > sourcePrice - paid) return next(new AppError('You are paying amount in extra', 400));

    inventory.paid += amount;

    if (inventory.paid >= sourcePrice * quantity) inventory.isRemaining = false;

    await inventory.save();

    res.status(200).send();
});

module.exports.refund = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const units = parseInt(req.params.units);

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const purchase = await Model.findById(id);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    const inventory = await Inventory.findOne({ 'product._id': purchase.product._id });

    console.log(inventory);

    inventory.quantity -= units;

    if (purchase.quantity < units) return next(new AppError('Cannot refund more than the initial purchase', 404));
    if (inventory.quantity < 0) return next(new AppError('Cannot refund more than in stock', 404));

    purchase.quantity -= units;

    const promises = [purchase.save()];

    if (inventory.quantity > 0) promises.push(inventory.save());
    else promises.push(Inventory.findByIdAndDelete(inventory._id));

    // purchase.quantity -= units;

    // if (purchase.quantity < 0) return next(new AppError('Insufficient Inventory', 400));

    // if (purchase.quantity > 0) await purchase.save();
    // else await Model.findByIdAndDelete(id);

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
