const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Seed default property types if empty
const seedDefaultPropertyTypes = async () => {
  try {
    const list = await db.PropertyType.find();
    if (list.length === 0) {
      const defaults = [
        { name: 'Plot', isEnabled: true },
        { name: 'Villa', isEnabled: true },
        { name: 'Independent House', isEnabled: true },
        { name: 'Apartment', isEnabled: true },
        { name: 'Commercial', isEnabled: true },
        { name: 'Farm Land', isEnabled: true },
        { name: 'Open Land', isEnabled: true },
        { name: 'Others', isEnabled: true }
      ];
      for (const pt of defaults) {
        await db.PropertyType.create(pt);
      }
      console.log('Default property types seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding property types:', err);
  }
};
seedDefaultPropertyTypes();

// @route   GET /api/properties
// @desc    Get all property types (public gets enabled, admin gets all)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const types = await db.PropertyType.find();
    
    const showAll = req.query.admin === 'true';
    if (showAll) {
      return res.json(types);
    }

    const enabled = types.filter(pt => pt.isEnabled);
    res.json(enabled);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/properties
// @desc    Create a new property type
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name, isEnabled } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const newPt = await db.PropertyType.create({
      name,
      isEnabled: isEnabled !== undefined ? isEnabled : true
    });
    res.status(201).json(newPt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/properties/:id
// @desc    Update property type (edit name, enable/disable)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name, isEnabled } = req.body;
  try {
    const type = await db.PropertyType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ message: 'Property type not found' });
    }

    const updated = await db.PropertyType.findByIdAndUpdate(req.params.id, {
      name: name !== undefined ? name : type.name,
      isEnabled: isEnabled !== undefined ? isEnabled : type.isEnabled
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete property type
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const type = await db.PropertyType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ message: 'Property type not found' });
    }
    await db.PropertyType.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property type deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
