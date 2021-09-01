const mongoose = require('mongoose');
const _ = require('lodash');
const dayjs = require('dayjs');
const Model = require('../../models/v2/inventories.model');
const Product = require('../../models/v2/products.model');
const Unit = require('../../models/v2/units.model');
const { convertUnitsOfInventory, convertUnits } = require('../../models/v2/purchases.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const { readQuantityFromString } = require('../../utils/readUnit');

async function createInventories(inventories, next) {
    const body = inventories.map((b) => _.pick(b, ['product', 'quantity', 'variants']));
    const productIds = [...new Set(body.map((b) => b.product))].map((e) => mongoose.Types.ObjectId(e));
    const productsInDB = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    if (productsInDB.length < productIds.length) return next(new AppError('Product(s) does not exist', 404));

    const inventoriesInDB = await Model.find({ 'product._id': { $in: productIds } }).lean();

    const promises = [];

    for (const b of body) {
        b.product = productsInDB.find((e) => e._id.toString() === b.product.toString());
        const inventoryInDB = inventoriesInDB.find((e) => e.product._id.toString() === b.product._id.toString());

        if (inventoryInDB) {
            if (b.quantity)
                inventoryInDB.quantity +=
                    typeof b.quantity === 'number'
                        ? b.quantity
                        : readQuantityFromString(b.quantity, b.product.unit.value);
            else if (b.variants)
                Object.entries(b.variants).forEach(([key, value]) => {
                    let q = inventoryInDB.variants[key] ?? 0;
                    q += typeof value === 'number' ? value : readQuantityFromString(value, b.product.unit.value);
                    inventoryInDB.variants[key] = q;
                });
            else return next(new AppError('Something went wrong', 400));

            promises.push(Model.findByIdAndUpdate(inventoryInDB._id, inventoryInDB));
        } else if (!inventoryInDB) {
            const newInventory = { product: b.product };
            if (b.quantity)
                newInventory.quantity =
                    typeof b.quantity === 'number'
                        ? b.quantity
                        : readQuantityFromString(b.quantity, b.product.unit.value);
            else if (b.variants) {
                const variants = {};
                Object.entries(b.variants).forEach(([key, value]) => {
                    variants[key] =
                        typeof value === 'number' ? value : readQuantityFromString(value, b.product.unit.value);
                });
                newInventory.variants = variants;
            } else return next(new AppError('Something went wrong', 400));

            promises.push(Model.create(newInventory));
        }
    }

    await Promise.all(promises);
}

module.exports.createInventories = createInventories;

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const results = await Model.paginate(
        {
            'product.modelNumber': { $regex: `${search}`, $options: 'i' },
        },
        { projection: { __v: 0 }, lean: true, page, limit, sort }
    );

    // eslint-disable-next-line no-param-reassign
    results.docs.forEach((d) => {
        const unit = d.product.unit.value;
        if (d.quantity !== undefined && d.quantity !== null) d.quantity = convertUnits(d.quantity, unit);
        else if (d.variants) {
            Object.entries(d.variants).forEach(([key, value]) => {
                d.variants[key] = convertUnits(value, unit);
            });
        }
    });

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const inventories = req.body;
    await createInventories(inventories, next);
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
