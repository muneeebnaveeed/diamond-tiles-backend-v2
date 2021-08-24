const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../../models/v2/products.model');
const Purchase = require('../../models/v2/purchases.model').Model;
const Sale = require('../../models/v2/sales.model');
const Type = require('../../models/v2/types.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const Unit = require('../../models/v2/units.model');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const results = await Model.paginate(
        {
            $or: [{ modelNumber: { $regex: `${search}`, $options: 'i' } }],
        },
        {
            projection: { __v: 0 },
            lean: true,
            page,
            limit,
            sort,
        }
    );

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const { inventoriesPage, inventoriesLimit, inventoriesSort, salesPage, salesLimit, salesSort } = req.query;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const product = await Model.findById(id, { __v: 0 }).lean();

    if (!product) return next(new AppError('Product does not exist', 404));

    const inventories = await Purchase.paginate(
        { 'product._id': mongoose.Types.ObjectId(id) },
        {
            populate: { path: 'supplier', select: '-__v' },
            projection: { __v: 0 },
            lean: true,
            page: inventoriesPage,
            limit: inventoriesLimit,
            sort: inventoriesSort,
        }
    );

    let relevantInventoryIds = [];
    inventories.docs.forEach((i) => {
        if (i.product && i.product._id) relevantInventoryIds.push(i.product._id.toString());
    });

    relevantInventoryIds = [...new Set(relevantInventoryIds)].map((inventoryId) =>
        mongoose.Types.ObjectId(inventoryId)
    );

    const sales = Sale.paginate(
        { 'inventory._id': { $in: relevantInventoryIds } },
        {
            populate: { path: 'customer', select: '-__v' },
            projection: { __v: 0 },
            lean: true,
            page: salesPage,
            limit: salesLimit,
            sort: salesSort,
        }
    );

    res.status(200).json({
        product,
        inventories: _.omit(inventories, ['page', 'prevPage', 'nextPage', 'limit']),
        sales: _.omit(sales, ['page', 'prevPage', 'nextPage', 'limit']),
    });
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['modelNumber', 'type', 'unit']);

    if (Object.keys(newDoc).length < 3) return next(new AppError('Please enter a valid product', 400));

    const [type, unit] = await Promise.all([
        Type.findById(newDoc.type, { __v: 0 }).lean(),
        Unit.findById(newDoc.unit, { __v: 0 }).lean(),
    ]);

    if (!type) return next(new AppError('Type does not exist', 404));
    if (!unit) return next(new AppError('Unit does not exist', 404));

    if (unit.type.title !== type.title) return next(new AppError('Unit not compatible', 400));

    newDoc.type = type;
    newDoc.unit = _.omit(unit, ['type']);

    await Model.create(newDoc);

    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['modelNumber', 'type', 'retailPrice']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid product', 400));

    const [type, unit] = await Promise.all([Type.findById(newDoc.type).lean(), Unit.findById(newDoc.unit)].lean());

    if (!type) return next('Type or unit does not exist', 404);
    if (!unit) return next('Unit or unit does not exist', 404);

    newDoc.type = type;
    newDoc.unit = unit;

    await Model.findByIdAndUpdate(id, newDoc, { runValidators: true });

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
