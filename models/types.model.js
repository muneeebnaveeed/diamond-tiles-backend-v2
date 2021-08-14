const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter a title'],
        minlength: [3, 'Please enter a bare minimum of 3 characters in title'],
        maxlength: [25, 'Only 25 characters are allowed in title'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Type', schema);

module.exports = Model;
