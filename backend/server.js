const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for credentials if needed
app.use(cors());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded property images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple check-alive endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: db.isMongo() ? 'MongoDB' : 'Local JSON DB Fallback',
    timestamp: new Date()
  });
});

// Import route handlers
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const locationRoutes = require('./routes/locations');
const propertyRoutes = require('./routes/properties');
const followupRoutes = require('./routes/followups');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');

// Bind API routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Fallback for Page Not Found on API
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Start Server and Connect Database
const startServer = async () => {
  // Connect to DB (Mongo or fallback JSON)
  await db.connect();

  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` MRV Server is running on port ${PORT}`);
    console.log(` Backend Mode: ${db.isMongo() ? 'MongoDB Direct' : 'Local File JSON DB'}`);
    console.log(` Health URL: http://localhost:${PORT}/api/health`);
    console.log(`=================================================`);
  });
};

startServer();
