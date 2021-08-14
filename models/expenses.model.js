const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const ExpenseTypeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter a title'],
        minlength: [3, 'Please enter a bare minimum of 3 characters in title'],
        maxlength: [25, 'Only 25 characters are allowed in title'],
    },
    createdAt: { type: Date, required: true, default: Date.now() },
});

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter a title'],
        minlength: [4, 'Please enter a bare minimum of 4 characters in title'],
        maxlength: [35, 'Only 35 characters are allowed in title'],
        // validate: {
        //     validator: function (t) {
        //         if (!this.employee && t) return true;
        //         if (this.employee && !t) return true;
        //         return false;
        //     },
        //     message: 'Either Employee or Title can be placed at once',
        // },
    },
    comments: {
        type: String,
        maxlength: [255, 'Comments are no more than 255 characters'],
    },
    amount: {
        type: Number,
        validate: {
            validator: function (a) {
                if (!this.employee || !a) return true;
                return a > 1;
            },
            message: 'Invalid amount',
        },
    },
    type: {
        type: mongoose.Types.ObjectId,
        ref: 'ExpenseType',
        required: [true, 'Type is required'],
    },
    employee: {},
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
ExpenseTypeSchema.plugin(mongoosePagiante);
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Expense', schema);
const Type = mongoose.model('ExpenseType', ExpenseTypeSchema);

module.exports = { Model, Type };
