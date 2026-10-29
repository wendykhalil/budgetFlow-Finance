const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, default: '' },
    status: { type: String, enum: ['completed', 'pending'], default: 'completed' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

transactionSchema.set('toJSON', {
  transform(document, result) {
    result.id = result._id.toString();
    delete result._id;
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.model('Transaction', transactionSchema);
