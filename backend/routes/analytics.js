const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// @route   GET /api/analytics
// @desc    Get dashboard analytics metrics
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const leads = await db.Lead.find();
    const locations = await db.Location.find();
    
    // 1. Basic Counts
    const totalLeads = leads.length;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLeads = leads.filter(l => new Date(l.createdAt) >= todayStart).length;

    const buyRequests = leads.filter(l => l.type === 'buy').length;
    const sellRequests = leads.filter(l => l.type === 'sell').length;

    const activeLocations = locations.filter(loc => !loc.isHidden).length;

    // 2. Status Breakdown (Conversion stats)
    const statusCounts = {
      new: 0,
      contacted: 0,
      interested: 0,
      site_visit: 0,
      negotiation: 0,
      closed: 0,
      rejected: 0
    };
    leads.forEach(l => {
      if (statusCounts[l.status] !== undefined) {
        statusCounts[l.status]++;
      } else {
        statusCounts[l.status] = 1;
      }
    });

    // Conversion rate: Closed leads / Total non-new/non-rejected leads, or closed/total * 100
    const closedDeals = statusCounts.closed || 0;
    const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;

    // Pending Followups (leads not closed/rejected and have status site_visit/negotiation/contacted/interested)
    const pendingFollowups = leads.filter(l => 
      l.status !== 'closed' && l.status !== 'rejected' && l.status !== 'new'
    ).length;

    // 3. Location distribution
    const locationCounts = {};
    leads.forEach(l => {
      const loc = l.type === 'buy' 
        ? (l.buyDetails?.preferredLocation || 'Other')
        : (l.sellDetails?.location || 'Other');
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    // Convert to sorted array
    const topLocations = Object.keys(locationCounts).map(name => ({
      name,
      count: locationCounts[name]
    })).sort((a, b) => b.count - a.count);

    // 4. Property Type distribution
    const propertyTypeCounts = {};
    leads.forEach(l => {
      const pt = l.type === 'buy' 
        ? (l.buyDetails?.propertyType || 'Others')
        : (l.sellDetails?.propertyType || 'Others');
      propertyTypeCounts[pt] = (propertyTypeCounts[pt] || 0) + 1;
    });
    const propertyTypesDist = Object.keys(propertyTypeCounts).map(name => ({
      name,
      count: propertyTypeCounts[name]
    })).sort((a, b) => b.count - a.count);

    // 5. Monthly Trend (last 6 months)
    const monthlyLeads = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize last 6 months including current month
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      monthlyLeads[key] = { buy: 0, sell: 0, total: 0 };
    }

    leads.forEach(l => {
      const date = new Date(l.createdAt);
      const key = `${months[date.getMonth()]} ${date.getFullYear().toString().substring(2)}`;
      if (monthlyLeads[key]) {
        if (l.type === 'buy') monthlyLeads[key].buy++;
        else monthlyLeads[key].sell++;
        monthlyLeads[key].total++;
      }
    });

    const monthlyTrends = Object.keys(monthlyLeads).map(name => ({
      name,
      buy: monthlyLeads[name].buy,
      sell: monthlyLeads[name].sell,
      total: monthlyLeads[name].total
    }));

    res.json({
      summary: {
        totalLeads,
        todayLeads,
        buyRequests,
        sellRequests,
        activeLocations,
        pendingFollowups,
        closedDeals,
        conversionRate
      },
      statusBreakdown: Object.keys(statusCounts).map(status => ({
        status,
        count: statusCounts[status]
      })),
      topLocations,
      propertyTypesDist,
      monthlyTrends
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
