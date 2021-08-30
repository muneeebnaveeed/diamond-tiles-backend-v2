const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);

module.exports = function (req, res, next) {
    req.query.page = req.query.page ? parseInt(req.query.page) : 1;
    req.query.limit = req.query.limit ? parseInt(req.query.limit) : 5;

    const { startDate, endDate } = req.query;

    // console.log('frontend', startDate, endDate);

    let dateToBeConverted = null;

    if (startDate) dateToBeConverted = startDate;
    else dateToBeConverted = new Date();

    // console.log('startDateBefore', dateToBeConverted);

    req.query.startDate = dayjs(dateToBeConverted).utcOffset(0).startOf('day').toDate();

    // console.log('startDateAfter', req.query.startDate);

    if (endDate) dateToBeConverted = endDate;
    else dateToBeConverted = new Date();

    // console.log('endDateBefore', dateToBeConverted);

    req.query.endDate = dayjs(dateToBeConverted).utcOffset(0).endOf('day').toDate();

    // console.log('endDateAfter', req.query.endDate);

    next();
};
