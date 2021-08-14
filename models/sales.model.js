const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    customer: { type: mongoose.Types.ObjectId, ref: 'Customer' },
    inventory: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter an inventory'] },
    purchase: { type: mongoose.Types.ObjectId, ref: 'Purchase' },
    retailPrice: {
        type: Number,
        required: [true, 'Please enter retail price'],
    },
    paid: {
        type: Number,
        required: [true, 'Please enter paid amount'],
    },
    isRemaining: { type: Boolean, required: [true, 'Please enter isRemaining'] },
    quantity: {
        type: Number,
        required: [true, 'Please enter a quantity'],
        min: [1, 'Quantity must be greater than 0'],
    },
    comments: {
        type: String,
        maxlength: [255, 'Comments are no more than 255 characters'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);

const Model = mongoose.model('Sale', schema);

module.exports = Model;
