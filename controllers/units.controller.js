const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/units.model');
const Type = require('../models/types.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { type } = req.query;
    if (type) {
        if (!mongoose.isValidObjectId(type)) return next(new AppError('Invalid Type ID', 400));
    }
    let docs = await Model.find({}, { __v: 0 }).lean();

    if (type) docs = docs.filter((d) => d.type?._id?.toString() === type);

    res.status(200).json(docs);
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['title', 'value', 'type']);

    if (Object.keys(newDoc).length !== 3) return next(new AppError('Please enter a valid unit', 400));

    const type = await Type.findById(newDoc.type).lean();

    if (!type) return next(new AppError('Type does not exist', 404));

    newDoc.type = type;

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
