const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    customer: { type: mongoose.Types.ObjectId, ref: 'Customer' },
    products: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter products'] },
    paid: {
        type: Number,
        required: [true, 'Please enter paid price'],
    },
    isRemaining: Boolean,
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Sale', schema);

module.exports = Model;
