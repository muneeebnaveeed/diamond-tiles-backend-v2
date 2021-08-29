const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

const Database = require('./utils/db');
const AppError = require('./utils/AppError');

const tilesRoute = require('./routes/v2/products.route');
const customersRoute = require('./routes/v2/customers.route');
const employeesRoute = require('./routes/employees.route');
const suppliersRoute = require('./routes/v2/suppliers.route');
const typesRoute = require('./routes/v2/types.route');
const unitsRoute = require('./routes/v2/units.route');
const inventoriesRoute = require('./routes/v2/inventories.route');
const purchasesRoute = require('./routes/v2/purchases.route');

const salesRoute = require('./routes/v2/sales.route');
const expensesRoute = require('./routes/v2/expenses.route');
const salariesRoute = require('./routes/v2/salaries.route');

const dashboardRoute = require('./routes/dashboard.route');

const authRoute = require('./routes/auth.route');
const { errorController } = require('./controllers/errors.controller');
const { protect } = require('./controllers/auth.controller');

const app = express();

dotenv.config({ path: path.resolve(process.cwd(), `.${process.env.NODE_ENV}.env`) });

const port = process.env.PORT || 5500;

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    new Database()
        .connect()
        .then(() => console.log('Connected to DB'))
        .catch((err) => console.log(err.message));

    app.use(express.json());

    app.use(cors());

    app.get('/', (req, res) => {
        res.status(200).send(`Server running at PORT ${port}`);
    });

    app.use('/products', protect, tilesRoute);
    app.use('/customers', protect, customersRoute);
    app.use('/employees', protect, employeesRoute);
    app.use('/salaries', protect, salariesRoute);

    app.use('/suppliers', protect, suppliersRoute);
    app.use('/types', protect, typesRoute);
    app.use('/units', protect, unitsRoute);
    app.use('/inventories', protect, inventoriesRoute);
    app.use('/purchases', protect, purchasesRoute);

    app.use('/sales', protect, salesRoute);
    app.use('/expenses', protect, expensesRoute);
    app.use('/dashboard', protect, dashboardRoute);

    // app.use('/categories', protect, categoriesRoute);
    // app.use('/orders', protect, ordersRoute);
    app.use('/auth', authRoute);

    app.use('*', (req, res, next) => next(new AppError(`Cannot find ${req.originalUrl} on the server!`, 404)));

    app.use(errorController);
});
