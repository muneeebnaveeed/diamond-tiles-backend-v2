const mongoose = require('mongoose');
const _ = require('lodash');
const { Model, Type } = require('../models/expenses.model');
const Employee = require('../models/employees.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const Sale = require('../models/sales.model');
const Purchase = require('../models/purchases.model').Model;

async function getSalaries({ query = {}, page, limit, sort, next }) {
    let salaryType = await Type.findOne({ title: 'salary' }).lean();

    if (!salaryType) salaryType = await Type.create({ title: 'salary' });

    const docs = await Model.paginate(
        { type: salaryType._id, ...query },
        { projection: { __v: 0 }, populate: { path: 'type', select: '-__v' }, sort, lean: true, page, limit }
    );

    return docs;
}

module.exports.getSalaries = getSalaries;

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    let salaryType = await Type.findOne({ title: 'salary' }).lean();

    if (!salaryType) salaryType = await Type.create({ title: 'salary' });

    const docs = await Model.paginate(
        {
            $and: [{ type: { $ne: salaryType._id } }, { $or: [{ title: { $regex: `${search}`, $options: 'i' } }] }],
        },
        { projection: { __v: 0 }, populate: { path: 'type', select: '-__v' }, lean: true, page, limit, sort }
    );

    const employeeIds = [];

    docs.docs.forEach((d) => {
        if (d.employee) employeeIds.push(d.employee._id);
    });

    const uniqueEmployeeIds = [...new Set(employeeIds)].map((id) => mongoose.Types.ObjectId(id));

    const employees = await Employee.find({ _id: { $in: uniqueEmployeeIds } }, { __v: 0 }).lean();

    const existingEmployeeIds = employees.map((e) => e._id.toString());

    docs.docs.forEach((d) => {
        if (d.employee && d.employee._id.toString()) {
            if (existingEmployeeIds.includes(d.employee._id.toString())) d.employeeExists = true;
        }
    });

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const doc = await Model.findById(id, { __v: 0 }).populate({ path: 'type', select: '-__v' }).lean();

    if (!doc) return next(new AppError('Expense does not exist', 404));

    if (doc.employee) {
        const employee = await Employee.findById(doc.employee, { __v: 0 }).lean();
        if (employee) doc.employeeExists = true;
    }

    res.status(200).json(doc);
});

module.exports.getAllSalaries = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const docs = await getSalaries({ page, limit, sort });

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getAllTypes = catchAsync(async function (req, res, next) {
    const { sort } = req.query;
    const docs = await Type.find({}, { __v: 0 }, { sort }).lean();
    res.status(200).json(docs);
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

    console.log(sales, inventories);

    const docs = data.slice(0, limit);
    const totalPages = Math.ceil(totalDocs / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = totalDocs > offset;
    const pagingCounter = (page - 1) * offset + 1;

    res.status(200).json({ docs, totalDocs, totalPages, hasPrevPage, hasNextPage, pagingCounter });
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const doc = _.pick(req.body, ['title', 'amount', 'type', 'comments', 'employee']);

    let validExpenseLength = 3;

    if (doc.employee) validExpenseLength = 2;

    if (Object.keys(doc).length < validExpenseLength) return next(new AppError('Please enter valid expense', 400));

    if (!mongoose.isValidObjectId(doc.type)) return next(new AppError('Please enter valid type id', 400));

    const type = await Type.findById(doc.type).lean();

    if (!type) return next(new AppError('Type does not exist', 404));

    if (doc.employee) {
        if (type.title !== 'salary') return next(new AppError('Salary type must be attached with salary', 400));

        if (!mongoose.isValidObjectId(doc.employee)) return next(new AppError('Please enter valid employee id', 400));

        const employee = await Employee.findById(doc.employee, {
            __v: 0,
            createdAt: 0,
            phone: 0,
            cnic: 0,
            address: 0,
        }).lean();

        if (!employee) return next(new AppError('Employee does not exist', 404));

        doc.amount = employee.salary;
        doc.employee = employee;
        doc.title = `Salary - ${employee.name}`;
    }

    await Model.create(doc);

    res.status(200).json();
});

module.exports.addOneType = catchAsync(async function (req, res, next) {
    const doc = _.pick(req.body, ['title']);

    if (Object.keys(doc).length !== 1) return next(new AppError('Please enter valid expense type', 400));

    await Type.create(doc);

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

module.exports.removeTypes = catchAsync(async function (req, res, next) {
    const ids = req.params.id.split(',');

    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id(s)', 400));
    }

    const typeIds = [...new Set(ids)].map((id) => mongoose.Types.ObjectId(id));

    const expenses = await Model.find({ type: { $in: typeIds } });
    const expenseIds = [...new Set(expenses.map((e) => e._id))];

    await Promise.all([Model.deleteMany({ _id: { $in: expenseIds } }), Type.deleteMany({ _id: { $in: typeIds } })]);

    res.status(200).json();
});
