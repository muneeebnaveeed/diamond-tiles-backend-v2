const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter a name'],
        minlength: [4, 'Please enter a bare minimum of 4 characters in name'],
        maxlength: [35, 'Only 35 characters are allowed in name'],
    },
    phone: {
        type: String,
        required: [true, 'Please enter a phone number'],
    },
    cnic: {
        type: String,
        required: [true, 'Please enter CNIC'],
    },
    address: {
        type: String,
        required: [true, 'Please enter address'],
    },
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
