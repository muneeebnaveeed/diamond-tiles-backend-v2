const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/types.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');

const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const docs = await Model.find({}, { __v: 0 });
    res.status(200).json(docs);
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const { page, limit, sort, search } = req.query;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const type = await Model.findById(id, { __v: 0 });

    const promises = [
        Product.paginate(
            { $and: [{ type: mongoose.Types.ObjectId(id) }, { modelNumber: { $regex: search, $options: 'i' } }] },
            {
                projection: { __v: 0, type: 0 },
                lean: true,
                page: page,
                limit: limit,
                sort: sort,
            }
        ),
        Unit.find({}, { __v: 0, type: 0 }),
    ];

    const [products, units] = await Promise.all(promises);

    res.status(200).json({
        type,
        products: _.omit(products, ['page', 'prevPage', 'nextPage', 'limit']),
        units,
    });
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['title']);
    const type = await Model.create(newDoc);
    await Unit.create({ type: type._id, title: 'Single', value: 1 });
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
