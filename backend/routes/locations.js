const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Seed default locations if empty
const seedDefaultLocations = async () => {
  try {
    const list = await db.Location.find();
    if (list.length === 0) {
      const defaults = [
        { name: 'Madhapur', isHidden: false, order: 1 },
        { name: 'Gachibowli', isHidden: false, order: 2 },
        { name: 'Kondapur', isHidden: false, order: 3 },
        { name: 'Jubilee Hills', isHidden: false, order: 4 },
        { name: 'Banjara Hills', isHidden: false, order: 5 },
        { name: 'Other', isHidden: false, order: 100 }
      ];
      for (const loc of defaults) {
        await db.Location.create(loc);
      }
      console.log('Default locations seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding locations:', err);
  }
};
seedDefaultLocations();

// @route   GET /api/locations
// @desc    Get all locations (customers get visible only, admin gets all)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const locations = await db.Location.find();
    
    // Sort by order ascending
    const sorted = locations.sort((a, b) => (a.order || 0) - (b.order || 0));

    // If admin is requesting, return all. Otherwise, only visible.
    // We check query param or authorization header if needed, but a simple 'all' query is easy
    const showAll = req.query.admin === 'true';
    if (showAll) {
      return res.json(sorted);
    }
    
    const visible = sorted.filter(loc => !loc.isHidden);
    res.json(visible);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/locations
// @desc    Create a new location
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name, isHidden, order } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const newLocation = await db.Location.create({
      name,
      isHidden: isHidden || false,
      order: order !== undefined ? order : 0
    });
    res.status(201).json(newLocation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/locations/:id
// @desc    Update a location
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name, isHidden, order } = req.body;
  try {
    const location = await db.Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const updated = await db.Location.findByIdAndUpdate(req.params.id, {
      name: name !== undefined ? name : location.name,
      isHidden: isHidden !== undefined ? isHidden : location.isHidden,
      order: order !== undefined ? order : location.order
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/locations/reorder
// @desc    Reorder multiple locations at once
// @access  Private
router.post('/reorder', auth, async (req, res) => {
  const { orders } = req.body; // Array of { id, order }
  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ message: 'Orders array is required' });
  }

  try {
    for (const item of orders) {
      await db.Location.findByIdAndUpdate(item.id, { order: item.order });
    }
    res.json({ message: 'Locations reordered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/locations/:id
// @desc    Delete a location
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const location = await db.Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    await db.Location.findByIdAndDelete(req.params.id);
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
