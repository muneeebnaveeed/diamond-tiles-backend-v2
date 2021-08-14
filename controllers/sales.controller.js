/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/sales.model');
const Inventory = require('../models/inventories.model');
const Customer = require('../models/customers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const Type = require('../models/types.model');
const { convertUnitsOfInventory } = require('../models/purchases.model');

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
    // pick only wanted fields from body
    const body = _.pick(req.body, ['customer', 'retailPrice', 'inventory', 'quantity', 'paid', 'comments']);

    // if required fields are left out
    if (Object.keys(body).length < 4) return next(new AppError('Please enter a valid sale', 400));

    // if customer field is not a valid mongoose ID
    if (body.customer) {
        if (!mongoose.isValidObjectId(body.customer))
            return next(new AppError('Please enter a valid customer id', 400));

        // if customer does not exist
        const customer = await Customer.findById(body.customer).lean();

        if (!customer) return next(new AppError('Customer does not exist', 404));
    } else {
        delete body.customer;
    }

    // if inventory field is not a valid mongoose ID
    if (!mongoose.isValidObjectId(body.inventory)) return next(new AppError('Please enter a valid inventory id', 400));

    // if inventory does not exist
    const inventory = await Inventory.findOne({ _id: body.inventory }, { __v: 0 });

    if (!inventory) return next(new AppError('Inventory does not exist', 400));

    body.inventory = {
        _id: inventory._id,
        type: inventory.product.type.title,
        modelNumber: inventory.product.modelNumber,
        unit: inventory.product.unit,
    };

    inventory.quantity -= body.quantity;

    if (inventory.quantity < 0) return next(new AppError('Insufficient Inventory', 404));

    const promise = inventory.quantity > 0 ? inventory.save() : Inventory.findByIdAndDelete(inventory._id);

    body.isRemaining = parseInt(body.paid) !== parseInt(body.retailPrice);

    // add sale and update inventory concurrently
    const response = await Promise.all([Model.create(body), promise]);

    res.status(200).send(response[0]._id);
});

module.exports.refund = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const units = parseInt(req.params.units);

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const sale = await Model.findById(id);

    if (!sale) return next(new AppError('Sale does not exist', 404));

    if (units > sale.quantity) return next(new AppError('Cannot refund more units than the original sale', 404));

    const inventory = await Inventory.findById(sale.inventory._id);

    inventory.quantity += units;

    const promises = [inventory.save()];

    if (units === sale.quantity) promises.push(Model.findByIdAndDelete(sale._id));
    else {
        sale.quantity -= units;
        promises.push(sale.save());
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
