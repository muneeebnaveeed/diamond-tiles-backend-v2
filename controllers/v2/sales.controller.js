/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');
const _ = require('lodash');
const Logger = require('../../utils/logger');
const Model = require('../../models/v2/sales.model');
const Inventory = require('../../models/v2/inventories.model');
const Product = require('../../models/v2/products.model');

const Customer = require('../../models/v2/customers.model');
const { catchAsync } = require('../errors.controller');
const AppError = require('../../utils/AppError');
const Type = require('../../models/v2/types.model');
const { readQuantityFromString } = require('../../utils/readUnit');
const { convertUnits } = require('../../models/v2/purchases.model');
const { consumeInventories, createInventories } = require('./inventories.controller');
const stringify = require('../../utils/stringify');

const logger = Logger('sales');

module.exports.getCount = catchAsync(async function (req, res, next) {
    const count = await Model.count({});
    res.status(200).json(count);
});

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, startDate, endDate } = req.query;

    const results = await Model.paginate(
        { createdAt: { $gte: startDate, $lte: endDate } },
        {
            projection: { __v: 0 },
            populate: { path: 'customer', select: '-__v' },
            lean: true,
            page,
            limit,
            sort,
        }
    );

    // results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));
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

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Invalid sale id', 400));

    const doc = await Model.findById(id, { __v: 0 }).populate('customer');

    if (!doc) return next(new AppError('Sale not found', 404));

    // results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(doc);
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const sale = await Model.findById(id);

    if (!sale) return next(new AppError('Inventory does not exist', 404));

    const { totalRetailPrice, paid, isRemaining } = sale;

    if (!isRemaining) return next(new AppError('Khaata is already cleared', 400));

    // if (amount > sourcePrice - paid) return next(new AppError('You are paying amount in extra', 400));

    sale.paid += amount;

    if (sale.paid >= totalRetailPrice) sale.isRemaining = false;

    await sale.save();

    res.status(200).send();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['customer', 'products', 'paid']);

    logger.debug(`addOne() body ${stringify(body)}`);

    if (Object.keys(body).length < 3) return next(new AppError('Please enter a valid purchase', 400));

    if (!mongoose.isValidObjectId(body.customer)) return next(new AppError('Please enter a valid customer id', 400));

    const customer = await Customer.findById(body.customer, { __v: 0 }).lean();

    if (!customer) return next(new AppError('Customer does not exist', 404));

    const productIds = [...new Set(body.products.map((p) => p.product))].map((id) => mongoose.Types.ObjectId(id));

    logger.debug(`addOne() productIds ${stringify(productIds)}`);

    const products = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`addOne() products ${stringify(products)}`);

    const processedProducts = body.products.map((p, index) => {
        const currProduct = _.cloneDeep(p);
        logger.debug(`addOne() p${index} ${stringify(p)}`);

        const product = products.find((e) => e._id.toString() === p.product.toString());

        logger.debug(`addOne() product ${stringify(product)}`);

        const { type, unit } = product;

        if (type.title.toLowerCase() === 'tile') {
            const variants = {};

            Object.entries(p.variants).forEach(([key, value]) => {
                const quantity = readQuantityFromString(value, unit.value);
                logger.debug(`addOne() key-value-quantity ${stringify({ key, value, quantity })}`);

                variants[key] = quantity;
            });
            currProduct.variants = variants;
        } else {
            const quantity = readQuantityFromString(p.quantity, unit.value);
            currProduct.quantity = quantity;
        }

        currProduct.product = product;

        return currProduct;
    });

    const inventories = body.products.map((p, i) => {
        const product = products.find((pp) => pp._id.toString() === p.product);
        logger.debug(`addOne() inventories-${i} ${stringify(p)}`);

        const inventory = { product: product._id };
        if (product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = product.quantity;
        return inventory;
    });

    logger.debug(`addOne() inventories ${stringify(inventories)}`);

    const totalRetailPrice =
        body.products.length > 1
            ? body.products.map((p) => p.retailPrice).reduce((a, b) => a + b)
            : body.products[0].retailPrice;
    body.isRemaining = body.paid < totalRetailPrice;

    body.customer = customer;
    body.products = processedProducts;
    body.totalRetailPrice = totalRetailPrice;

    logger.debug(`addOne() body.products ${stringify(body.products)}`);

    await Promise.all([Model.create(body), consumeInventories(inventories, next)]);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['customer', 'products', 'paid']);
    const saleId = req.params.id;

    logger.debug(`edit() saleId ${stringify(saleId)} body ${stringify(body)}`);

    if (!mongoose.isValidObjectId(saleId)) return next(new AppError('Please enter a valid sale id', 400));

    const sale = await Model.findById(saleId);

    logger.debug(`edit() sale ${stringify(sale)}`);

    if (!sale) return next(new AppError('Sale does not exist', 404));

    if (Object.keys(body).length < 3) return next(new AppError('Please enter a valid sale', 400));

    if (!mongoose.isValidObjectId(body.customer)) return next(new AppError('Please enter a valid customer id', 400));

    const customer = await Customer.findById(body.customer, { __v: 0 }).lean();

    if (!customer) return next(new AppError('Customer does not exist', 404));

    const productIds = [...new Set(body.products.map((p) => p.product))].map((id) => mongoose.Types.ObjectId(id));

    logger.debug(`edit() productIds ${stringify(productIds)}`);

    const products = await Product.find({ _id: { $in: productIds } }, { __v: 0 }).lean();

    logger.debug(`edit() products ${stringify(products)}`);

    const processedProducts = body.products.map((p, index) => {
        const currProduct = _.cloneDeep(p);
        logger.debug(`edit() p${index} ${stringify(p)}`);

        const product = products.find((e) => e._id.toString() === p.product.toString());

        logger.debug(`edit() product ${stringify(product)}`);

        const { type, unit } = product;

        if (type.title.toLowerCase() === 'tile') {
            const variants = {};

            Object.entries(p.variants).forEach(([key, value]) => {
                const quantity = readQuantityFromString(value, unit.value);
                logger.debug(`edit() key-value-quantity ${stringify({ key, value, quantity })}`);

                variants[key] = quantity;
            });
            currProduct.variants = variants;
        } else {
            const quantity = readQuantityFromString(p.quantity, unit.value);
            currProduct.quantity = quantity;
        }

        currProduct.product = product;

        return currProduct;
    });

    const inventories = body.products.map((p, i) => {
        const product = products.find((pp) => pp._id.toString() === p.product);
        logger.debug(`edit() inventories-${i} ${stringify(p)}`);

        const inventory = { product: product._id };
        if (product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = product.quantity;
        return inventory;
    });

    logger.debug(`edit() inventories ${stringify(inventories)}`);

    const totalRetailPrice =
        body.products.length > 1
            ? body.products.map((p) => p.retailPrice).reduce((a, b) => a + b)
            : body.products[0].retailPrice;

    body.isRemaining = body.paid < totalRetailPrice;
    body.customer = customer;
    body.products = processedProducts;
    body.totalRetailPrice = totalRetailPrice;

    logger.debug(`edit() body.products ${stringify(body.products)}`);

    const inventoriesToBeCreated = sale.products.map((p) => {
        const inventory = { product: p.product._id };
        if (p.product.type.title.toLowerCase() === 'tile') inventory.variants = p.variants;
        else inventory.quantity = p.quantity;
        return inventory;
    });

    sale.isRemaining = body.isRemaining;
    sale.customer = body.customer;
    sale.products = body.products;
    sale.totalRetailPrice = body.totalRetailPrice;
    sale.paid = body.paid;

    await createInventories(inventoriesToBeCreated, next);
    await consumeInventories(inventories, next);
    await sale.save();
    res.status(200).send();
});

module.exports.refund = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const body = req.body.map((b) => _.pick(b, ['product', 'quantity', 'sourcePrice', 'variants']));

    const productIds = [...new Set(body.map((b) => b.product))].map((e) => mongoose.Types.ObjectId(e));

    const [purchase, productsInDB] = await Promise.all([
        Model.findById(id).lean(),
        Inventory.find({ 'product._id': { $in: productIds } }),
    ]);

    if (!purchase) return next(new AppError('Purchase does not exist', 404));

    const promises = [];

    for (const b of body) {
        const inventory = productsInDB.find((e) => e.product._id.toString() === b.product);
        b.product = inventory.product;

        if (!b.product) return next(new AppError('Product does not exist', 404));

        const index = purchase.products.findIndex((e) => e.product._id.toString() === b.product._id.toString());
        if (index === -1) return;

        const { unit } = b.product;
        const { products } = purchase;
        let newSourcePrice = null;

        if (b.variants) {
            const oldQuantities = Object.values(products[index].variants);
            const oldTotalQuantity =
                oldQuantities.length > 1 ? oldQuantities.reduce((x, y) => x + y) : oldQuantities[0];
            const oldSourcePricePerUnit = products[index].sourcePrice / oldTotalQuantity;

            Object.entries(b.variants).forEach(([key, value]) => {
                products[index].variants[key] -= readQuantityFromString(value, unit.value);
                if (products[index].variants[key] < 0) return next(new AppError('Insufficient Inventory', 404));
            });

            const newQuantities = Object.values(products[index].variants);
            const newTotalQuantity =
                newQuantities.length > 1 ? newQuantities.reduce((x, y) => x + y) : newQuantities[0];

            newSourcePrice = Math.round(oldSourcePricePerUnit * newTotalQuantity);
        } else {
            const quantity = readQuantityFromString(b.quantity, unit.value);
            const oldSourcePricePerUnit = b.sourcePrice / quantity;
            products[index].quantity -= quantity;
            newSourcePrice = Math.round(oldSourcePricePerUnit * products[index].quantity);
            if (products[index].quantity < -1) return next(new AppError('Insufficient Inventory', 404));
        }

        products[index].sourcePrice = newSourcePrice;

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
