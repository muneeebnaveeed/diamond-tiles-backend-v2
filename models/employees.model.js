const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter a name'],
    },
    phone: String,
    cnic: String,
    address: String,
    salary: {
        type: String,
        required: [true, 'Please enter salary'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.index({ name: 'text', phone: 'text' });
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Employee', schema);

module.exports = Model;
