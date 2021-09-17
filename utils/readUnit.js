const skipLastValue = (str) => str.slice(0, -1);

const readLastValue = (str) => str.slice(-1);

const readQuantityFromString = (str, boxValue) => {
    const quantity = skipLastValue(str);
    const unit = readLastValue(str).toLowerCase();
    const multiplier = unit === 't' ? 1 : boxValue;
    return quantity * multiplier;
};

module.exports.skipLastValue = skipLastValue;

module.exports.readLastValue = readLastValue;

module.exports.readQuantityFromString = readQuantityFromString;
