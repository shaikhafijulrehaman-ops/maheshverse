const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// @route   GET /api/notifications
// @desc    Get all notifications & unread count
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await db.Notification.find();
    
    // Sort notifications by date descending
    const sorted = notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const unreadCount = sorted.filter(n => !n.read).length;
    
    // Limit to latest 50 notifications for performance
    const latest = sorted.slice(0, 50);

    res.json({
      notifications: latest,
      unreadCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.post('/read-all', auth, async (req, res) => {
  try {
    const unread = await db.Notification.find({ read: false });
    
    for (let notification of unread) {
      await db.Notification.findByIdAndUpdate(notification._id, { read: true });
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.post('/:id/read', auth, async (req, res) => {
  try {
    const notification = await db.Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    await db.Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await db.Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    await db.Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
