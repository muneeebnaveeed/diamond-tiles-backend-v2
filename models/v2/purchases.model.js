const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    supplier: { type: mongoose.Types.ObjectId, ref: 'Supplier', required: [true, 'Please enter a supplier'] },
    products: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter products'] },
    paid: {
        type: Number,
        required: [true, 'Please enter paid price'],
    },
    isRemaining: Boolean,
    createdAt: { type: Date, required: true, default: Date.now() },
});

const convertUnitsOfInventory = (inventory) => {
    inventory.quantity = { single: inventory.quantity };

    const { single } = inventory.quantity;
    const { title, value } = inventory.product.unit;
    const unitName = title.toLowerCase();

    if (single <= value) return;

    const wholeUnits = Math.floor(single / value);
    const remainingSingles = single - wholeUnits * value;

    inventory.quantity[unitName] = [wholeUnits, remainingSingles];

    console.log(inventory);
    return inventory;
};

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Purchase', schema);

module.exports = { Model, convertUnitsOfInventory };
