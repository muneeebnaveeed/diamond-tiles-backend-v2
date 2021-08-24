const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter a name'],
    },
    value: {
        type: Number,
        required: [true, 'Please enter a value'],
        min: [1, 'Please enter a valid value'],
    },
    type: {
        type: mongoose.model('Type').schema,
        required: [true, 'Type is required'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Unit', schema);

module.exports = Model;
