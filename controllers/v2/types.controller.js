const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../../models/v2/types.model');
const Product = require('../../models/v2/products.model');
const Unit = require('../../models/v2/units.model');

const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const docs = await Model.find({}, { __v: 0 });
    res.status(200).json(docs);
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['title']);
    await Model.create(newDoc);
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
