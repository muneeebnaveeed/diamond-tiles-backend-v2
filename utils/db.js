const mongoose = require('mongoose');
const Logger = require('./logger');

const logger = Logger('app');

module.exports = class Database {
    constructor() {
        logger.debug('Created instance of DB');

        this.connectionString = process.env.DB_CONNECTION_STRING;
        // this.authString = this.getAuthString(process.env.DB_PASSWORD);
        this.authString = process.env.DB_CONNECTION_STRING;
    }

    getAuthString(password) {
        return this.connectionString.replace('<password>', password);
    }

    connect() {
        logger.debug('Connecting to DB...');

        return mongoose.connect(this.authString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true,
        });
    }
};
