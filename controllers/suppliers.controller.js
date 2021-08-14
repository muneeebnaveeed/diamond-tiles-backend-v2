const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/suppliers.model');
const Purchase = require('../models/purchases.model').Model;

const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const { convertUnitsOfInventory } = require('../models/purchases.model');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const results = await Model.paginate(
        {
            $or: [
                { name: { $regex: `${search}`, $options: 'i' } },
                { phone: { $regex: `${search}`, $options: 'i' } },
                { company: { $regex: `${search}`, $options: 'i' } },
            ],
        },
        { projection: { __v: 0 }, lean: true, page, limit, sort }
    );

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const { page, limit, sort } = req.query;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const supplier = await Model.findById(id, { __v: 0 }).lean();

    if (!supplier) return next(new AppError('Supplier does not exist', 404));

    // const product = await Product.findById(inventory.product._id, { __v: 0, inventory: 0 }).lean();

    const inventories = await Purchase.paginate(
        { supplier: id },
        {
            projection: { __v: 0, inventory: 0 },
            populate: { path: 'supplier', select: { __v: 0 } },
            lean: true,
            page: page,
            limit: limit,
            sort: sort,
        }
    );

    // eslint-disable-next-line no-param-reassign
    inventories.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json({
        supplier,
        inventories: _.omit(inventories, ['page', 'prevPage', 'nextPage', 'limit']),
    });
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    const docs = req.body;

    if (!docs || !docs.length) return next(new AppError('Please enter valid suppliers', 400));

    await Model.insertMany(docs);

    res.status(200).json();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['name', 'phone', 'company']);
    await Model.create(newDoc);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['name', 'phone', 'company']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid supplier', 400));

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
