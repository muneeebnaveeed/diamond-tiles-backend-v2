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
const Logger = require('../../utils/logger');
const stringify = require('../../utils/stringify');

const logger = Logger('inventories');

async function createInventories(inventories, next) {
    const body = inventories.map((b) => _.pick(b, ['product', 'quantity', 'variants']));

    logger.debug(`createInventories() body ${stringify(body)}`);

    const productIds = [...new Set(body.map((b) => b.product))].map((e) => mongoose.Types.ObjectId(e));

    logger.debug(`createInventories() productIds ${stringify(productIds)}`);

    const productsInDB = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`createInventories() productsInDB ${stringify(productsInDB)}`);

    if (productsInDB.length < productIds.length) return next(new AppError('Product(s) does not exist', 404));

    const inventoriesInDB = await Model.find({ 'product._id': { $in: productIds } }).lean();

    logger.debug(`createInventories() inventoriesInDB ${stringify(inventoriesInDB)}`);

    const promises = [];

    body.forEach((b, index) => {
        logger.debug(`createInventories() b${index} ${stringify(b)}`);

        b.product = productsInDB.find((e) => e._id.toString() === b.product.toString());

        logger.debug(`createInventories() b.product ${stringify(b.product)}`);

        const inventoryInDB = inventoriesInDB.find((e) => e.product._id.toString() === b.product._id.toString());

        logger.debug(`createInventories() inventoryInDB ${stringify(inventoryInDB)}`);

        if (inventoryInDB) {
            if (b.quantity) {
                inventoryInDB.quantity +=
                    typeof b.quantity === 'number'
                        ? b.quantity
                        : readQuantityFromString(b.quantity, b.product.unit.value);
                logger.debug(`createInventories() inventoryInDB.quantity ${stringify(inventoryInDB.quantity)}`);
            } else if (b.variants) {
                Object.entries(b.variants).forEach(([key, value], i) => {
                    let q = inventoryInDB.variants[key] ?? 0;
                    logger.debug(`createInventories() key-value-q-${i} ${stringify({ key, value, q })}`);
                    q += typeof value === 'number' ? value : readQuantityFromString(value, b.product.unit.value);
                    inventoryInDB.variants[key] = q;
                });
            } else return next(new AppError('Something went wrong', 400));

            promises.push(Model.findByIdAndUpdate(inventoryInDB._id, inventoryInDB));
        } else if (!inventoryInDB) {
            const newInventory = { product: b.product };
            if (b.quantity) {
                newInventory.quantity =
                    typeof b.quantity === 'number'
                        ? b.quantity
                        : readQuantityFromString(b.quantity, b.product.unit.value);
            } else if (b.variants) {
                const variants = {};
                Object.entries(b.variants).forEach(([key, value]) => {
                    variants[key] =
                        typeof value === 'number' ? value : readQuantityFromString(value, b.product.unit.value);
                });
                newInventory.variants = variants;
            } else return next(new AppError('Something went wrong', 400));

            promises.push(Model.create(newInventory));
        }
    });

    await Promise.all(promises);
}

async function consumeInventories(inventories, next) {
    const body = inventories.map((b) => _.pick(b, ['product', 'quantity', 'variants']));

    logger.debug(`consumeInventories() body ${stringify(body)}`);

    const productIds = [...new Set(body.map((b) => b.product))].map((e) => mongoose.Types.ObjectId(e));

    logger.debug(`consumeInventories() productIds ${stringify(productIds)}`);

    const productsInDB = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`consumeInventories() productsInDB ${stringify(productsInDB)}`);

    if (productsInDB.length < productIds.length) return next(new AppError('Product(s) does not exist', 404));

    const inventoriesInDB = await Model.find({ 'product._id': { $in: productIds } }).lean();

    logger.debug(`consumeInventories() inventoriesInDB ${stringify(inventoriesInDB)}`);

    const promises = [];

    body.forEach((b, index) => {
        logger.debug(`consumeInventories() b${index} ${stringify(b)}`);

        b.product = productsInDB.find((e) => e._id.toString() === b.product.toString());

        logger.debug(`consumeInventories() b.product ${stringify(b.product)}`);

        const inventory = inventoriesInDB.find((e) => e.product._id.toString() === b.product._id.toString());

        logger.debug(`consumeInventories() inventory ${stringify(inventory)}`);

        if (!inventory) return next(new AppError('Product not in stock', 404));

        const { type, unit } = inventory.product;

        if (type.title.toLowerCase() === 'tile') {
            const inventoryVariants = { ...inventory.variants };
            Object.entries(b.variants).forEach(([key, value]) => {
                const quantity = typeof value === 'number' ? value : readQuantityFromString(value, unit.value);
                logger.debug(`consumeInventories() key-value-quantity ${stringify({ key, value, quantity })}`);

                const inventoryQuantity = inventory.variants[key] - quantity;

                logger.debug(
                    `consumeInventories() key-value-inventoryQuantity ${stringify({ key, value, inventoryQuantity })}`
                );

                if (inventoryQuantity < 0) return next(new AppError('Insufficient inventory', 404));

                inventoryVariants[key] = inventoryQuantity;
            });

            Object.entries(inventoryVariants).forEach(([key, value]) => {
                if (value === 0) delete inventoryVariants[key];
            });

            promises.push(Model.findByIdAndUpdate(inventory._id, { variants: inventoryVariants }));
        } else {
            const quantity = typeof b.value === 'number' ? b.value : readQuantityFromString(b.quantity, unit.value);
            inventory.quantity -= quantity;

            if (inventory.quantity === 0) promises.push(Model.findByIdAndDelete(inventory._id));
            else if (inventory.quantity < 0) return next(new AppError('Insufficient inventory', 404));
            else promises.push(Model.findByIdAndUpdate(inventory._id, { quantity: inventory.quantity }));
        }
    });

    await Promise.all(promises);
}

module.exports.createInventories = createInventories;
module.exports.consumeInventories = consumeInventories;

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

module.exports.edit = catchAsync(async function (req, res, next) {
    const inventories = req.body;

    logger.debug(`edit() inventories ${stringify(inventories)}`);

    const deleted = await Model.findOneAndDelete({ 'product._id': mongoose.Types.ObjectId(inventories[0].product) });

    logger.debug(`edit() deleted ${stringify(deleted)}`);

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
