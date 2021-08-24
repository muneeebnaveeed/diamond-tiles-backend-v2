const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../../models/v2/expenses.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const Sale = require('../../models/v2/sales.model');
const Purchase = require('../../models/v2/purchases.model').Model;

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const docs = await Model.paginate(
        { title: { $regex: `${search}`, $options: 'i' } },
        { projection: { __v: 0 }, populate: { path: 'type', select: '-__v' }, lean: true, page, limit, sort }
    );

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const doc = _.pick(req.body, ['title', 'amount']);

    await Model.create(doc);

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

module.exports.getKhaata = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const salesPromise = Sale.find(
        { $and: [{ isRemaining: true }, { $and: [{ customer: { $ne: null } }, { customer: { $ne: undefined } }] }] },
        { __v: 0, isRemaining: 0 }
    )
        .populate({ path: 'customer', select: '_id name' })
        .lean();

    const inventoriesPromise = Purchase.find({ isRemaining: true }, { __v: 0, isRemaining: 0 })
        .populate({ path: 'supplier', select: '_id name' })
        .lean();

    const [sales, inventories] = await Promise.all([salesPromise, inventoriesPromise]);

    const data = [
        ...sales.map((s) => ({ ...s, type: 'sale' })),
        ...inventories.map((i) => ({ ...i, type: 'inventory' })),
    ];

    const totalDocs = data.length;
    const offset = page * limit;

    const docs = data.slice(0, limit);
    const totalPages = Math.ceil(totalDocs / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = totalDocs > offset;
    const pagingCounter = (page - 1) * offset + 1;

    res.status(200).json({ docs, totalDocs, totalPages, hasPrevPage, hasNextPage, pagingCounter });
});
