const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// @route   GET /api/followups/lead/:leadId
// @desc    Get all followups for a specific lead
// @access  Private
router.get('/lead/:leadId', auth, async (req, res) => {
  try {
    const list = await db.Followup.find({ leadId: req.params.leadId });
    // Sort by date/createdAt descending to show history newest first
    const sorted = list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    res.json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/followups
// @desc    Add a follow-up action or scheduled reminder
// @access  Private
router.post('/', auth, async (req, res) => {
  const { leadId, date, notes } = req.body;

  if (!leadId || !date) {
    return res.status(400).json({ message: 'Lead ID and Date are required' });
  }

  try {
    const lead = await db.Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const newFollowup = await db.Followup.create({
      leadId,
      date: new Date(date),
      notes: notes || ''
    });

    res.status(201).json(newFollowup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/followups/:id
// @desc    Delete a follow-up entry
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const followup = await db.Followup.findById(req.params.id);
    if (!followup) {
      return res.status(404).json({ message: 'Follow-up entry not found' });
    }
    await db.Followup.findByIdAndDelete(req.params.id);
    res.json({ message: 'Followup deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
