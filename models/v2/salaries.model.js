const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    employee: { type: mongoose.model('Employee').schema, required: [true, 'Employee is required'] },
    amount: { type: Number, required: [true, 'Enter a salary amount'] },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Salary', schema);

module.exports = Model;
