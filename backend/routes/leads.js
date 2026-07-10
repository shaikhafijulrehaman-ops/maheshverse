const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (accept images only)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB limit, max 10 files
  fileFilter: fileFilter
});

// @route   POST /api/leads
// @desc    Submit a lead (buy or sell)
// @access  Public
router.post('/', (req, res) => {
  // We handle potential multer upload first, then run validation
  upload.array('images', 10)(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const { type, name, phone, email } = req.body;

      // 1. Validate General Required Fields
      if (!type || !name || !phone) {
        return res.status(400).json({ message: 'Name, mobile number, and request type are required' });
      }

      // 2. Validate Mobile Number (Indian mobile format: 10 digits, optional country code)
      const phoneRegex = /^[6-9]\d{9}$/;
      // Clean phone number (strip whitespace or +91 prefix for validation check)
      let cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('+91')) {
        cleanPhone = cleanPhone.substring(3);
      } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.substring(2);
      } else if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }

      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number starting with 6-9' });
      }

      // 3. Validate Email (Optional)
      if (email && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ message: 'Please enter a valid email address' });
        }
      }

      // 4. Check for duplicate phone numbers in active leads (to prevent spam)
      // Checks if a lead with the same phone and type exists and is not closed/rejected, or was submitted in the last 2 hours.
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const existingLeads = await db.Lead.find({
        'personalInfo.phone': phone.trim(),
        type: type
      });

      // Filter check
      const isDuplicate = existingLeads.some(lead => {
        const status = lead.status;
        const isNotFinal = status !== 'closed' && status !== 'rejected';
        const isRecent = new Date(lead.createdAt) > twoHoursAgo;
        return isNotFinal || isRecent;
      });

      if (isDuplicate) {
        return res.status(400).json({
          message: 'A request from this mobile number is already in progress. Our team will contact you within 24 hours.'
        });
      }

      let newLeadData = {
        type,
        status: 'new',
        personalInfo: {
          name: name.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : ''
        }
      };

      // 5. Validate Type Specific Fields
      if (type === 'buy') {
        const {
          preferredLocation,
          propertyType,
          otherPropertyType,
          bhk,
          minBudget,
          maxBudget,
          loanRequired,
          readyToMove,
          additionalRequirements
        } = req.body;

        // Validation for buy budget
        const minB = minBudget ? Number(minBudget) : 0;
        const maxB = maxBudget ? Number(maxBudget) : 0;

        if (maxB && minB > maxB) {
          return res.status(400).json({ message: 'Minimum budget cannot exceed maximum budget' });
        }

        newLeadData.buyDetails = {
          preferredLocation: preferredLocation || 'Other',
          propertyType: propertyType || 'Others',
          otherPropertyType: propertyType === 'Others' ? otherPropertyType || '' : '',
          bhk: bhk || 'Not Applicable',
          minBudget: minB,
          maxBudget: maxB,
          loanRequired: loanRequired || 'No',
          readyToMove: readyToMove || "Doesn't Matter",
          additionalRequirements: additionalRequirements || ''
        };
      } else if (type === 'sell') {
        const {
          location,
          propertyType,
          otherPropertyType,
          constructionType,
          size,
          facing,
          age,
          expectedPrice,
          additionalInformation
        } = req.body;

        // Grab uploaded files paths
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        newLeadData.sellDetails = {
          location: location || 'Other',
          propertyType: propertyType || 'Others',
          otherPropertyType: propertyType === 'Others' ? otherPropertyType || '' : '',
          constructionType: constructionType || '',
          size: size || '',
          facing: facing || '',
          age: age || '',
          expectedPrice: expectedPrice ? Number(expectedPrice) : 0,
          images: imageUrls,
          additionalInformation: additionalInformation || ''
        };
      } else {
        return res.status(400).json({ message: 'Invalid lead type' });
      }

      const createdLead = await db.Lead.create(newLeadData);

      // Create a notification for the admin dashboard
      await db.Notification.create({
        message: `New ${type.toUpperCase()} lead received from ${name.trim()} (${phone.trim()})`,
        read: false,
        type: type === 'buy' ? 'buy_request' : 'sell_request'
      });

      res.status(201).json({
        success: true,
        message: 'Lead submitted successfully',
        lead: createdLead
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error during submission' });
    }
  });
});

// @route   GET /api/leads
// @desc    Get all leads with filtering, searching, and sorting
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const leads = await db.Lead.find();
    
    // Apply server-side filtering
    let filtered = [...leads];

    const { search, type, location, propertyType, status, date, budgetMin, budgetMax } = req.query;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(l => 
        l.personalInfo.name.toLowerCase().includes(searchLower) ||
        l.personalInfo.phone.includes(searchLower) ||
        (l.personalInfo.email && l.personalInfo.email.toLowerCase().includes(searchLower))
      );
    }

    if (type) {
      filtered = filtered.filter(l => l.type === type);
    }

    if (status) {
      filtered = filtered.filter(l => l.status === status);
    }

    if (location) {
      filtered = filtered.filter(l => {
        if (l.type === 'buy') {
          return l.buyDetails && l.buyDetails.preferredLocation === location;
        } else {
          return l.sellDetails && l.sellDetails.location === location;
        }
      });
    }

    if (propertyType) {
      filtered = filtered.filter(l => {
        if (l.type === 'buy') {
          return l.buyDetails && l.buyDetails.propertyType === propertyType;
        } else {
          return l.sellDetails && l.sellDetails.propertyType === propertyType;
        }
      });
    }

    // Filter by budget
    if (budgetMin) {
      const minVal = Number(budgetMin);
      filtered = filtered.filter(l => {
        if (l.type === 'buy') {
          return l.buyDetails && l.buyDetails.minBudget >= minVal;
        } else {
          return l.sellDetails && l.sellDetails.expectedPrice >= minVal;
        }
      });
    }

    if (budgetMax) {
      const maxVal = Number(budgetMax);
      filtered = filtered.filter(l => {
        if (l.type === 'buy') {
          return l.buyDetails && l.buyDetails.maxBudget <= maxVal;
        } else {
          return l.sellDetails && l.sellDetails.expectedPrice <= maxVal;
        }
      });
    }

    // Filter by date range (e.g. today, yesterday, last_7_days, last_30_days)
    if (date) {
      const now = new Date();
      let cutOffDate = new Date();
      
      if (date === 'today') {
        cutOffDate.setHours(0, 0, 0, 0);
      } else if (date === 'yesterday') {
        cutOffDate.setDate(now.getDate() - 1);
        cutOffDate.setHours(0,0,0,0);
        const endOfYesterday = new Date(cutOffDate);
        endOfYesterday.setHours(23,59,59,999);
        filtered = filtered.filter(l => {
          const leadDate = new Date(l.createdAt);
          return leadDate >= cutOffDate && leadDate <= endOfYesterday;
        });
      } else if (date === 'last_7_days') {
        cutOffDate.setDate(now.getDate() - 7);
      } else if (date === 'last_30_days') {
        cutOffDate.setDate(now.getDate() - 30);
      }

      if (date !== 'yesterday') {
        filtered = filtered.filter(l => new Date(l.createdAt) >= cutOffDate);
      }
    }

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leads/:id
// @desc    Get lead by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await db.Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/leads/:id
// @desc    Update lead details (name, phone, email)
// @access  Private
router.patch('/:id', auth, async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const lead = await db.Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const personalInfo = {
      ...lead.personalInfo,
      name: name !== undefined ? name.trim() : lead.personalInfo.name,
      phone: phone !== undefined ? phone.trim() : lead.personalInfo.phone,
      email: email !== undefined ? email.trim() : lead.personalInfo.email
    };

    const updated = await db.Lead.findByIdAndUpdate(
      req.params.id,
      { personalInfo },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/leads/:id/status
// @desc    Update lead status
// @access  Private
router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'contacted', 'interested', 'site_visit', 'negotiation', 'closed', 'rejected'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const lead = await db.Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const updated = await db.Lead.findByIdAndUpdate(req.params.id, { status });

    // Auto-create a history entry for the status update in followup
    await db.Followup.create({
      leadId: req.params.id,
      date: new Date(),
      notes: `Status updated to ${status.toUpperCase()} by ${req.user.username}`
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/leads/:id
// @desc    Delete a lead
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await db.Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Delete image files from disk if this is a sell request with images
    if (lead.type === 'sell' && lead.sellDetails && lead.sellDetails.images) {
      lead.sellDetails.images.forEach(imgUrl => {
        const fileName = imgUrl.split('/').pop();
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    await db.Lead.findByIdAndDelete(req.params.id);
    
    // Clean up followups associated with this lead
    const followups = await db.Followup.find({ leadId: req.params.id });
    for (let f of followups) {
      await db.Followup.findByIdAndDelete(f._id);
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/leads/upload-images
// @desc    Upload images and return local URLs
// @access  Public
router.post('/upload-images', (req, res) => {
  upload.array('images', 10)(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    res.json({ urls: imageUrls });
  });
});

module.exports = router;
