const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/inventories.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');
const { convertUnitsOfInventory } = require('../models/purchases.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

const addInventory = async (b, next) => {
    const body = _.pick(b, ['product', 'quantity']);

    if (Object.keys(body).length < 2) return next(new AppError('Please enter a valid inventory', 400));

    if (!mongoose.isValidObjectId(body.product)) return next(new AppError('Please enter a valid product id', 400));

    const product = await Product.findById(body.product, { __v: 0 }).lean();

    if (!product) return next(new AppError('Product does not exist', 400));

    const units = await Unit.find({ type: product.type._id }, { __v: 0 }).lean();

    body.units = units.map((u) => ({ ..._.omit(u, ['type', 'createdAt']) }));

    body.product = { ...product };

    const existingInventory = await Model.findOne({ product: body.product }).lean();

    if (existingInventory) {
        const i = await Model.findOne({ product: body.product });
        i.quantity += parseInt(body.quantity);
        await i.save();
    } else {
        await Model.create(body);
    }
};

module.exports.addInventory = addInventory;

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const results = await Model.paginate({}, { projection: { __v: 0 }, lean: true, page, limit, sort });

    // eslint-disable-next-line no-param-reassign
    results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    await addInventory(req.body, next);
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
