const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/employees.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const { getSalaries } = require('./v2/expenses.controller');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const results = await Model.paginate(
        {
            $or: [{ name: { $regex: `${search}`, $options: 'i' } }],
        },
        { projection: { __v: 0 }, populate: 'employee', lean: true, page, limit, sort }
    );

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    const { page, limit, sort } = req.query;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const employee = await Model.findById(id, { __v: 0 }).lean();

    if (!employee) return next(new AppError('Employee does not exist', 404));

    const salaries = await getSalaries({ query: { 'employee._id': id }, page, limit, sort, next });

    res.status(200).json({
        employee,
        salaries: _.omit(salaries, ['page', 'prevPage', 'nextPage', 'limit']),
    });
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    const docs = req.body;

    if (!docs || !docs.length) return next(new AppError('Please enter valid employees', 400));

    await Model.insertMany(docs);

    res.status(200).json();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['name', 'phone', 'cnic', 'address', 'salary']);
    await Model.create(newDoc);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['name', 'phone', 'cnic', 'address', 'salary']);
    const employeeId = req.params.id;
    if (!mongoose.isValidObjectId(employeeId)) return next(new AppError('Invalid employee id', 400));
    const employee = await Model.findById(employeeId);
    if (!employee) return next(new AppError('Employee does not exist'));

    employee.name = newDoc.name;
    employee.phone = newDoc.phone;
    employee.cnic = newDoc.cnic;
    employee.address = newDoc.address;
    employee.salary = newDoc.salary;

    await employee.save();

    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['name', 'phone', 'cnic', 'address', 'salary']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid employee', 400));

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
