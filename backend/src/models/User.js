const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SUPPORTED_CURRENCIES } = require('../utils/currencies');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    status: { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: 'EUR',
      trim: true,
    },
    country: { type: String, default: 'France', trim: true },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.set('toJSON', {
  transform(document, result) {
    result.id = result._id.toString();
    delete result._id;
    delete result.__v;
    delete result.password;
    return result;
  },
});

module.exports = mongoose.model('User', userSchema);
