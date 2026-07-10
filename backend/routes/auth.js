const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'mrv_secret_key_luxury_real_estate';

// Seeding function for default admin
const seedDefaultAdmin = async () => {
  try {
    const adminExists = await db.User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.User.create({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@maheshverse.com',
        role: 'admin'
      });
      console.log('Default admin seeded successfully: username=admin, password=admin123');
    }
  } catch (err) {
    console.error('Error seeding default admin:', err);
  }
};

// Seed admin immediately
seedDefaultAdmin();

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    let user;
    if (db.isMongo()) {
      user = await db.User.findOne({
        $or: [
          { username: username.trim() },
          { email: username.trim() }
        ]
      });
    } else {
      const allUsers = await db.User.find({});
      user = allUsers.find(u => 
        u.username === username.trim() || 
        u.email === username.trim()
      );
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isDisabled) {
      return res.status(403).json({ message: 'This administrative account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: user._id,
      username: user.username,
      role: user.role
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '7d' }, // 7 days token expiration
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get user data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password recovery (gives instructions / mock reset link)
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Please specify your username' });
  }

  try {
    const user = await db.User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'Username does not exist' });
    }

    // In a real application, we'd send an email.
    // For this local premium application, we will return a simulated recovery key,
    // so the admin can proceed directly to reset the password easily.
    res.json({
      message: 'Password reset code generated.',
      simulatedCode: 'MRV-RESET-999', // Security token the user can use to verify
      instructions: 'Please use code MRV-RESET-999 to reset your password.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using recovery code
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { username, code, newPassword } = req.body;
  if (!username || !code || !newPassword) {
    return res.status(400).json({ message: 'Please provide all fields' });
  }

  if (code !== 'MRV-RESET-999') {
    return res.status(400).json({ message: 'Invalid or expired recovery code' });
  }

  try {
    const user = await db.User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'Username does not exist' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.User.findByIdAndUpdate(user._id, { password: hashedPassword });

    res.json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/users
// @desc    List all admin users
// @access  Private (Admin only)
router.get('/users', auth, async (req, res) => {
  try {
    const users = await db.User.find({});
    const safeUsers = users.map(u => ({
      id: u._id || u.id,
      _id: u._id || u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      isDisabled: u.isDisabled || false
    }));
    res.json(safeUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/users
// @desc    Create a new admin user
// @access  Private (Admin only)
router.post('/users', auth, async (req, res) => {
  const { username, email, password, role, isDisabled } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email and password are required' });
  }

  try {
    const userExists = await db.User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.User.create({
      username: username.trim(),
      email: email.trim(),
      password: hashedPassword,
      role: role || 'admin',
      isDisabled: isDisabled || false
    });

    res.json({
      id: newUser._id || newUser.id,
      _id: newUser._id || newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      isDisabled: newUser.isDisabled
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/users/:id
// @desc    Update an admin user
// @access  Private (Admin only)
router.put('/users/:id', auth, async (req, res) => {
  const { username, email, password, role, isDisabled } = req.body;

  try {
    const user = await db.User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const updates = {};
    if (username) updates.username = username.trim();
    if (email) updates.email = email.trim();
    if (role) updates.role = role;
    if (isDisabled !== undefined) {
      if (req.user.id === req.params.id && isDisabled === true) {
        return res.status(400).json({ message: 'You cannot deactivate your own active session account' });
      }
      updates.isDisabled = isDisabled;
    }
    if (password && password.trim() !== '') {
      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db.User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({
      id: updatedUser._id || updatedUser.id,
      _id: updatedUser._id || updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      isDisabled: updatedUser.isDisabled
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete an admin user
// @access  Private (Admin only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own active administrator account' });
    }

    const deleted = await db.User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Admin user removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
