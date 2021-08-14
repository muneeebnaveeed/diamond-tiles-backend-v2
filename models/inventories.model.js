const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    product: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter a product'] },
    quantity: { type: Number, required: [true, 'Please enter a quantity'], min: [0, 'Quantity must be positive'] },
    units: {},
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Inventory', schema);

module.exports = Model;
