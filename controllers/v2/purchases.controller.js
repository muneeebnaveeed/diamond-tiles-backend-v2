const mongoose = require('mongoose');
const _ = require('lodash');
const axios = require('axios');
const { Model, convertUnits } = require('../../models/v2/purchases.model');
const Product = require('../../models/v2/products.model');
const Unit = require('../../models/v2/units.model');
const Sale = require('../../models/v2/sales.model');
const Inventory = require('../../models/v2/inventories.model');
const { createInventories, consumeInventories } = require('./inventories.controller');

const Supplier = require('../../models/v2/suppliers.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const { readQuantityFromString } = require('../../utils/readUnit');
const Logger = require('../../utils/logger');
const stringify = require('../../utils/stringify');

const logger = Logger('Purchases');

module.exports.getCount = catchAsync(async function (req, res, next) {
    const count = await Model.count({});
    res.status(200).json(count);
});

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, startDate, endDate } = req.query;

    const results = await Model.paginate(
        { createdAt: { $gte: startDate, $lte: endDate } },
        { projection: { __v: 0 }, populate: { path: 'supplier', select: '-__v' }, lean: true, page, limit, sort }
    );

    // logger.debug(`getAll() results ${stringify(results, null, 2)}`);

    // eslint-disable-next-line no-param-reassign
    results.docs.forEach((d) => {
        d.products.forEach((p) => {
            const unit = p.product.unit.value;
            if (p.quantity !== undefined && p.quantity !== null) p.quantity = convertUnits(p.quantity, unit);
            else if (p.variants) {
                Object.entries(p.variants).forEach(([key, value]) => {
                    p.variants[key] = convertUnits(value, unit);
                });
            }
        });
    });

    // logger.debug(`getAll() processedResults ${stringify(results, null, 2)}`);

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid purchase id', 400));

    const doc = await Model.findById(id).populate('supplier').lean();

    logger.debug(`getAll() doc ${stringify(doc, null, 2)}`);

    if (!doc) return next(new AppError('Purchase not found', 404));

    res.status(200).json(doc);
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['supplier', 'products', 'paid']);

    logger.debug(`addOne() body ${stringify(body)}`);

    if (Object.keys(body).length < 3) return next(new AppError('Please enter a valid purchase', 400));

    if (!mongoose.isValidObjectId(body.supplier)) return next(new AppError('Please enter a valid supplier id', 400));

    const supplier = await Supplier.findById(body.supplier).lean();

    logger.debug(`addOne() supplier ${stringify(supplier)}`);

    if (!supplier) return next(new AppError('Supplier does not exist', 404));

    const productIds = body.products.map((p) => mongoose.Types.ObjectId(p.product));

    logger.debug(`addOne() productIds ${stringify(productIds)}`);

    const productsInDB = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`addOne() productsInDB ${stringify(productsInDB)}`);

    const products = [];

    body.products.forEach((p, index) => {
        logger.debug(`addOne() p ${stringify(p)} index ${stringify(index)}`);

        p.product = productsInDB.find((e) => e._id.toString() === p.product);

        logger.debug(`addOne() p.product ${stringify(p.product)}`);

        if (!p.product) return next(new AppError('Product does not exist', 404));
        const { type, unit } = p.product;

        if (type.title.toLowerCase() === 'tile') {
            const variants = {};
            Object.entries(p.variants).forEach(([key, value]) => {
                const variant = readQuantityFromString(value, unit.value);
                logger.debug(`addOne() value ${stringify(value)} variant ${stringify(variant)}`);
                variants[key] = variant;
            });
            p.variants = variants;
        } else {
            const quantity = readQuantityFromString(p.quantity, unit.value);
            logger.debug(`addOne() quantity ${stringify(quantity)}`);
            p.quantity = quantity;
        }

        products.push(p);
    });

    const sourcePrices = products.map((p) => p.sourcePrice);
    const sourcePrice = sourcePrices.length > 1 ? sourcePrices.reduce((a, b) => a + b) : sourcePrices[0];
    body.isRemaining = body.paid < sourcePrice;
    body.totalSourcePrice = sourcePrice;

    logger.debug(
        `addOne() sourcePrices ${stringify(sourcePrices)} sourcePrice ${stringify(
            sourcePrice
        )} body.isRemaining ${stringify(body.isRemaining)} body.totalSourcePrice ${stringify(body.totalSourcePrice)}`
    );

    body.supplier = supplier;
    body.products = products;

    const inventories = products.map((p) => {
        const inventory = { product: p.product._id };
        if (p.product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = p.quantity;
        return inventory;
    });

    logger.debug(`addOne() inventories ${stringify(inventories)}`);

    await createInventories(inventories);

    await Model.create(body);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['supplier', 'products', 'paid']);
    const purchaseId = req.params.id;

    logger.debug(`edit() purchaseId ${stringify(purchaseId)} body ${stringify(body)}`);

    if (!mongoose.isValidObjectId(purchaseId)) return next(new AppError('Please enter a valid purchase id', 400));

    const purchase = await Model.findById(purchaseId);

    logger.debug(`edit() purchase ${stringify(purchase)}`);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    if (Object.keys(body).length < 3) return next(new AppError('Please enter a valid purchase', 400));

    if (!mongoose.isValidObjectId(body.supplier)) return next(new AppError('Please enter a valid supplier id', 400));

    const supplier = await Supplier.findById(body.supplier).lean();

    logger.debug(`edit() supplier ${stringify(supplier)}`);

    if (!supplier) return next(new AppError('Supplier does not exist', 404));

    const productIds = body.products.map((p) => mongoose.Types.ObjectId(p.product));

    logger.debug(`edit() productIds ${stringify(productIds)}`);

    const productsInDB = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`edit() productsInDB ${stringify(productsInDB)}`);

    const products = [];

    body.products.forEach((p, index) => {
        logger.debug(`edit() p ${stringify(p)} index ${stringify(index)}`);

        p.product = productsInDB.find((e) => e._id.toString() === p.product);

        logger.debug(`edit() p.product ${stringify(p.product)}`);

        if (!p.product) return next(new AppError('Product does not exist', 404));
        const { type, unit } = p.product;

        if (type.title.toLowerCase() === 'tile') {
            const variants = {};
            Object.entries(p.variants).forEach(([key, value]) => {
                const variant = readQuantityFromString(value, unit.value);
                logger.debug(`edit() value ${stringify(value)} variant ${stringify(variant)}`);
                variants[key] = variant;
            });
            p.variants = variants;
        } else {
            const quantity = readQuantityFromString(p.quantity, unit.value);
            logger.debug(`edit() quantity ${stringify(quantity)}`);
            p.quantity = quantity;
        }

        products.push(p);
    });

    const sourcePrices = products.map((p) => p.sourcePrice);
    const sourcePrice = sourcePrices.length > 1 ? sourcePrices.reduce((a, b) => a + b) : sourcePrices[0];
    body.isRemaining = body.paid < sourcePrice;
    body.totalSourcePrice = sourcePrice;

    logger.debug(
        `edit() sourcePrices ${stringify(sourcePrices)} sourcePrice ${stringify(
            sourcePrice
        )} body.isRemaining ${stringify(body.isRemaining)} body.totalSourcePrice ${stringify(body.totalSourcePrice)}`
    );

    body.supplier = supplier;
    body.products = products;

    const inventories = products.map((p) => {
        const inventory = { product: p.product._id };
        if (p.product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = p.quantity;
        return inventory;
    });

    logger.debug(`edit() inventories ${stringify(inventories)}`);

    const inventoriesToBeConsumed = purchase.products.map((p) => {
        const inventory = { product: p.product._id };
        if (p.product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = p.quantity;
        return inventory;
    });

    await createInventories(inventories);
    await consumeInventories(inventoriesToBeConsumed);

    purchase.supplier = body.supplier;
    purchase.products = body.products;
    purchase.paid = body.paid;

    await purchase.save();
    res.status(200).send();
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const purchase = await Model.findById(id);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    const { totalSourcePrice } = purchase;
    const oldPaid = purchase.paid;

    purchase.paid += amount;
    if (purchase.paid > totalSourcePrice)
        return next(
            new AppError(`Cannot clear khaata more than remaining. Only ${totalSourcePrice - oldPaid} remaining.`, 400)
        );

    purchase.isRemaining = purchase.paid < totalSourcePrice;

    await purchase.save();

    res.status(200).send();
});

module.exports.refund = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const body = req.body.map((b) => _.pick(b, ['product', 'sourcePrice', 'quantity', 'variants']));

    const productIds = body.map((b) => mongoose.Types.ObjectId(b.product));

    const [purchase, productsInDB] = await Promise.all([
        Model.findById(id).lean(),
        Product.find({ _id: { $in: productIds } }),
    ]);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    const promises = [];

    for (const b of body) {
        b.product = productsInDB.find((e) => e._id.toString() === b.product);

        if (!b.product) return next(new AppError('Product does not exist', 404));

        const index = purchase.products.findIndex((e) => e.product._id.toString() === b.product._id.toString());
        if (index === -1) return;

        const { unit } = b.product;
        const { products } = purchase;
        let newSourcePrice = null;
        let deleteProduct = false;

        if (b.variants) {
            const oldQuantities = Object.values(products[index].variants);
            const oldTotalQuantity =
                oldQuantities.length > 1 ? oldQuantities.reduce((x, y) => x + y) : oldQuantities[0];
            const oldSourcePricePerUnit = products[index].sourcePrice / oldTotalQuantity;

            Object.entries(b.variants).forEach(([key, value]) => {
                products[index].variants[key] -= readQuantityFromString(value, unit.value);
                if (products[index].variants[key] < 0)
                    return next(new AppError('Cannot refund more than initial purchase', 404));
            });

            const newQuantities = Object.values(products[index].variants);
            const newTotalQuantity =
                newQuantities.length > 1 ? newQuantities.reduce((x, y) => x + y) : newQuantities[0];

            newSourcePrice = Math.round(oldSourcePricePerUnit * newTotalQuantity);

            if (newTotalQuantity < 1) deleteProduct = true;
        } else {
            const quantity = readQuantityFromString(b.quantity, unit.value);
            const oldSourcePricePerUnit = quantity / b.sourcePrice;
            newSourcePrice = Math.round(oldSourcePricePerUnit * quantity);
            products[index].quantity -= quantity;

            if (products[index].quantity < 0)
                return next(new AppError('Cannot refund more than initial purchase', 404));

            if (products[index].quantity === 0) deleteProduct = true;
        }

        if (!deleteProduct) products[index].sourcePrice = newSourcePrice;
        else products.splice(index, 1);

        promises.push(Model.findByIdAndUpdate(id, { products }));
    }

    await Promise.all(promises);

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
