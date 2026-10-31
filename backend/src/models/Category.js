const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, select: false },
    type: { type: String, enum: ['income', 'expense'], required: true },
    color: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => value === undefined || /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
        message: 'Color must be a valid hexadecimal color.',
      },
    },
    icon: {
      type: String,
      trim: true,
      maxlength: 64,
      validate: {
        validator: (value) => value === undefined || /^[a-zA-Z0-9_-]+$/.test(value),
        message: 'Icon must contain only letters, numbers, underscores, or hyphens.',
      },
    },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

categorySchema.pre('validate', function normalizeCategoryName() {
  if (typeof this.name === 'string') {
    this.name = this.name.trim();
    this.normalizedName = this.name.toLowerCase();
  }
});

categorySchema.index(
  { userId: 1, normalizedName: 1, type: 1 },
  { unique: true, name: 'unique_owner_category_name_type' },
);

categorySchema.set('toJSON', {
  transform(document, result) {
    result.id = result._id.toString();
    delete result._id;
    delete result.__v;
    delete result.normalizedName;
    return result;
  },
});

module.exports = mongoose.model('Category', categorySchema);
