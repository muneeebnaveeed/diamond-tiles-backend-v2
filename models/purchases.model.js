const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    supplier: { type: mongoose.Types.ObjectId, ref: 'Supplier', required: [true, 'Please enter a supplier'] },
    product: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter a product'] },
    sourcePrice: {
        type: Number,
        required: [true, 'Please enter source price'],
    },
    paid: {
        type: Number,
        required: [true, 'Please enter paid price'],
    },
    isRemaining: { type: Boolean, required: [true, 'Please enter isRemaining'] },
    quantity: { type: Number, required: [true, 'Please enter a quantity'], min: [0, 'Quantity must be positive'] },
    units: {},
    comments: {
        type: String,
        maxlength: [255, 'Comments are no more than 255 characters'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
    khaataClearedAt: { type: Date },
});

const convertUnitsOfInventory = (inventory) => {
    console.log('inventory.quantity:%s', inventory.quantity);
    inventory.quantity = { single: inventory.quantity };
    const { single } = inventory.quantity;
    inventory.units.forEach(({ title, value }) => {
        const unitName = title.toLowerCase();

        if (single <= value) return;

        const wholeUnits = Math.floor(single / value);
        const remainingSingles = single - wholeUnits * value;

        inventory.quantity[unitName] = [wholeUnits, remainingSingles];
    });
    console.log(inventory);
    return inventory;
};

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Purchase', schema);

module.exports = { Model, convertUnitsOfInventory };
