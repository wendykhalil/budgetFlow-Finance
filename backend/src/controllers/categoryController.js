const mongoose = require('mongoose');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

const categoryFields = ['name', 'type', 'color', 'icon', 'isArchived'];

function readCategoryInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Category details must be an object.' };
  }

  const providedFields = categoryFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
  if (partial && providedFields.length === 0) {
    return { error: 'Provide at least one category field to update.' };
  }

  const updates = {};
  for (const field of providedFields) {
    const value = body[field];
    if (field === 'name') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
        return { error: 'Name must contain 1 to 80 characters.' };
      }
      updates.name = value.trim();
    } else if (field === 'type') {
      if (!['income', 'expense'].includes(value)) {
        return { error: 'Type must be income or expense.' };
      }
      updates.type = value;
    } else if (field === 'color') {
      if (
        typeof value !== 'string' ||
        !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
      ) {
        return { error: 'Color must be a valid hexadecimal color.' };
      }
      updates.color = value.trim();
    } else if (field === 'icon') {
      if (
        typeof value !== 'string' ||
        value.trim().length > 64 ||
        !/^[a-zA-Z0-9_-]+$/.test(value.trim())
      ) {
        return { error: 'Icon must contain 1 to 64 letters, numbers, underscores, or hyphens.' };
      }
      updates.icon = value.trim();
    } else {
      if (typeof value !== 'boolean') {
        return { error: 'isArchived must be a boolean.' };
      }
      updates.isArchived = value;
    }
  }

  if (!partial) {
    for (const field of ['name', 'type']) {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        return { error: `${field} is required.` };
      }
    }
  }

  return { updates };
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

function legacyCategoryNamePattern(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedName}$`, 'i');
}

async function ensureUniqueName(userId, name, type, excludedId) {
  const query = {
    userId,
    normalizedName: name.trim().toLowerCase(),
    type,
  };
  if (excludedId) query._id = { $ne: excludedId };
  return !(await Category.exists(query));
}

async function listCategories(req, res, next) {
  try {
    const filter = { userId: req.user.id };
    if (req.query.includeArchived !== 'true') filter.isArchived = false;
    const categories = await Category.find(filter).sort({ type: 1, name: 1 });
    return res.status(200).json({ categories });
  } catch (error) {
    return next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { updates, error } = readCategoryInput(req.body);
    if (error) return res.status(400).json({ message: error });

    if (!(await ensureUniqueName(req.user.id, updates.name, updates.type))) {
      return res.status(409).json({ message: 'A category with this name and type already exists.' });
    }

    const category = await Category.create({
      ...updates,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      const eventCategory = category.toJSON();
      delete eventCategory.userId;
      io.to(`user:${req.user.id}`).emit('category:created', {
        category: eventCategory,
      });
    }

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { updates, error } = readCategoryInput(req.body, true);
    if (error) return res.status(400).json({ message: error });
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!category) return res.status(404).json({ message: 'Category not found.' });

    const nextName = updates.name || category.name;
    const nextType = updates.type || category.type;
    if (!(await ensureUniqueName(req.user.id, nextName, nextType, category.id))) {
      return res.status(409).json({ message: 'A category with this name and type already exists.' });
    }

    if (updates.type && updates.type !== category.type) {
      const incompatibleTransaction = await Transaction.exists({
        userId: req.user.id,
        type: { $ne: updates.type },
        $or: [
          { categoryId: category.id },
          { category: legacyCategoryNamePattern(category.name) },
        ],
      });
      if (incompatibleTransaction) {
        return res.status(409).json({
          message: 'Category type cannot be changed while it is used by transactions of another type.',
        });
      }
    }

    const oldName = category.name;
    category.set(updates);
    await category.save();

    if (category.name !== oldName) {
      await Transaction.updateMany(
        { userId: req.user.id, categoryId: category.id },
        { $set: { category: category.name } },
      );
    }

    return res.status(200).json({ category });
  } catch (error) {
    return next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!category) return res.status(404).json({ message: 'Category not found.' });

    const referenced = await Transaction.exists({
      userId: req.user.id,
      $or: [
        { categoryId: category.id },
        { category: legacyCategoryNamePattern(category.name) },
      ],
    });

    if (referenced) {
      category.isArchived = true;
      await category.save();
      return res.status(200).json({
        action: 'archived',
        message: 'Category is used by transactions and has been archived.',
        category,
      });
    }

    await Category.deleteOne({ _id: category.id, userId: req.user.id });
    return res.status(200).json({
      action: 'deleted',
      message: 'Category deleted.',
      categoryId: category.id,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
