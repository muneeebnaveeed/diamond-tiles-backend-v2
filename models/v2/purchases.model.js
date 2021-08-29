const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    supplier: { type: mongoose.Types.ObjectId, ref: 'Supplier', required: [true, 'Please enter a supplier'] },
    products: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter products'] },
    paid: {
        type: Number,
        required: [true, 'Please enter paid price'],
    },
    totalSourcePrice: { type: Number, required: [true, 'Please enter total source price'] },
    isRemaining: Boolean,
    createdAt: { type: Date, required: true, default: Date.now() },
});

const convertUnits = (quantity, unit) => {
    const wholeUnits = Math.floor(quantity / unit);
    const remainingSingles = quantity - wholeUnits * unit;

    return [wholeUnits, remainingSingles];
};

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Purchase', schema);

module.exports = { Model, convertUnits };
