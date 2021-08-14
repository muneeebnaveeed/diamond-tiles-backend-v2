const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    modelNumber: {
        type: String,
        required: [true, 'Please enter a model number'],
    },
    retailPrice: Number,
    type: {
        type: mongoose.SchemaTypes.Mixed,
        required: [true, 'Type is required'],
    },
    unit: { type: String, required: [true, 'Unit is required'] },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Product', schema);

module.exports = Model;
