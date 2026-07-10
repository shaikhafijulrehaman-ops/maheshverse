import React, { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '../utils/audio';
import logo from '../assets/logo.png';
import { supabase, supabaseClient } from '../utils/supabaseClient';

export default function AdminDashboard({ token, onLogout, apiBaseUrl }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'buy_leads' | 'sell_leads' | 'locations' | 'properties' | 'settings' | 'export' | 'analytics' | 'profile'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data lists
  const [leads, setLeads] = useState([]);
  const [locations, setLocations] = useState([]);
  const [properties, setProperties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [analytics, setAnalytics] = useState(null);

  // Loading/Operation States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Selected Lead Details Modal
  const [selectedLead, setSelectedLead] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [newFollowupDate, setNewFollowupDate] = useState('');
  const [newFollowupNotes, setNewFollowupNotes] = useState('');

  // Filtering/Search parameters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterPropType, setFilterPropType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Location/Property Editor Dialog states
  const [locEditId, setLocEditId] = useState(null);
  const [locName, setLocName] = useState('');
  const [locIsHidden, setLocIsHidden] = useState(false);
  const [locOrder, setLocOrder] = useState(0);

  const [propEditId, setPropEditId] = useState(null);
  const [propName, setPropName] = useState('');
  const [propIsEnabled, setPropIsEnabled] = useState(true);

  // Add Lead Form state variables
  const [addType, setAddType] = useState('buy');
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addLocation, setAddLocation] = useState('');
  const [addPropType, setAddPropType] = useState('');
  const [addBudget, setAddBudget] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addError, setAddError] = useState('');

  // Admin user CRUD states
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminEditId, setAdminEditId] = useState(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRole, setAdminRole] = useState('admin');
  const [adminIsDisabled, setAdminIsDisabled] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  // Currently logged-in profile states (Settings tab)
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Lead inline edit states
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editLeadName, setEditLeadName] = useState('');
  const [editLeadPhone, setEditLeadPhone] = useState('');
  const [editLeadEmail, setEditLeadEmail] = useState('');

  // Refs for tracking old notifications count to trigger sound
  const prevUnreadCountRef = useRef(0);
  const notifDropdownRef = useRef(null);

  // Load dashboard baseline data
  useEffect(() => {
    fetchInitialData();
    
    // Set up polling for new leads and notifications (every 5 seconds)
    const pollInterval = setInterval(() => {
      pollNotifications();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Fetch all tables
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLeads(),
        fetchLocations(),
        fetchProperties(),
        fetchNotifications(),
        fetchAnalytics(),
        fetchAdminUsers(),
        fetchCurrentUser()
      ]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // ----------------------------------------------------
  // API FETCH METHODS
  // ----------------------------------------------------
  
  const fetchLeads = async () => {
    try {
      if (supabaseClient.isEnabled) {
        let data = await supabaseClient.getLeads();
        
        // Apply search filtering locally
        if (search) {
          const s = search.toLowerCase();
          data = data.filter(l => 
            l.personalInfo.name.toLowerCase().includes(s) || 
            l.personalInfo.phone.includes(s) || 
            (l.personalInfo.email && l.personalInfo.email.toLowerCase().includes(s))
          );
        }
        
        // Filter by Tab Type
        if (activeTab === 'buy_leads') {
          data = data.filter(l => l.type === 'buy');
        } else if (activeTab === 'sell_leads') {
          data = data.filter(l => l.type === 'sell');
        } else if (filterType) {
          data = data.filter(l => l.type === filterType);
        }
        
        // Filter by status
        if (filterStatus) {
          data = data.filter(l => l.status === filterStatus);
        }
        
        // Filter by location
        if (filterLocation) {
          data = data.filter(l => {
            const loc = l.type === 'buy' ? l.buyDetails?.preferredLocation : l.sellDetails?.location;
            return loc === filterLocation;
          });
        }
        
        // Filter by property category
        if (filterPropType) {
          data = data.filter(l => {
            const pt = l.type === 'buy' ? l.buyDetails?.propertyType : l.sellDetails?.propertyType;
            return pt === filterPropType;
          });
        }
        
        // Filter by date period
        if (filterDate) {
          const now = new Date();
          data = data.filter(l => {
            const dt = new Date(l.createdAt);
            if (filterDate === 'today') {
              return dt.toDateString() === now.toDateString();
            } else if (filterDate === 'yesterday') {
              const yesterday = new Date(now - 86400000);
              return dt.toDateString() === yesterday.toDateString();
            } else if (filterDate === 'last_7_days') {
              return now - dt <= 7 * 86400000;
            } else if (filterDate === 'last_30_days') {
              return now - dt <= 30 * 86400000;
            }
            return true;
          });
        }
        
        setLeads(data);
      } else {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (activeTab === 'buy_leads') {
          params.append('type', 'buy');
        } else if (activeTab === 'sell_leads') {
          params.append('type', 'sell');
        } else if (filterType) {
          params.append('type', filterType);
        }
        
        if (filterStatus) params.append('status', filterStatus);
        if (filterLocation) params.append('location', filterLocation);
        if (filterPropType) params.append('propertyType', filterPropType);
        if (filterDate) params.append('date', filterDate);
        
        const res = await fetch(`${apiBaseUrl}/api/leads?${params.toString()}`, { headers });
        const data = await res.json();
        setLeads(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  };

  // Re-trigger leads fetch whenever filter variables change
  useEffect(() => {
    fetchLeads();
  }, [search, filterType, filterStatus, filterLocation, filterPropType, filterDate, activeTab]);

  const fetchLocations = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getLocations();
        setLocations(data);
      } else {
        const res = await fetch(`${apiBaseUrl}/api/locations?admin=true`, { headers });
        const data = await res.json();
        setLocations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchProperties = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getPropertyTypes();
        setProperties(data);
      } else {
        const res = await fetch(`${apiBaseUrl}/api/properties?admin=true`, { headers });
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getNotifications();
        setNotifications(data);
        const unread = data.filter(n => !n.read).length;
        setUnreadNotifications(unread);
        prevUnreadCountRef.current = unread;
      } else {
        const res = await fetch(`${apiBaseUrl}/api/notifications`, { headers });
        const data = await res.json();
        if (data && data.notifications) {
          setNotifications(data.notifications);
          setUnreadNotifications(data.unreadCount);
          prevUnreadCountRef.current = data.unreadCount;
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const pollNotifications = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getNotifications();
        const unread = data.filter(n => !n.read).length;
        if (unread > prevUnreadCountRef.current) {
          playNotificationSound();
          fetchLeads();
          fetchAnalytics();
        }
        setNotifications(data);
        setUnreadNotifications(unread);
        prevUnreadCountRef.current = unread;
      } else {
        const res = await fetch(`${apiBaseUrl}/api/notifications`, { headers });
        const data = await res.json();
        if (data && data.notifications) {
          if (data.unreadCount > prevUnreadCountRef.current) {
            playNotificationSound();
            fetchLeads();
            fetchAnalytics();
          }
          setNotifications(data.notifications);
          setUnreadNotifications(data.unreadCount);
          prevUnreadCountRef.current = data.unreadCount;
        }
      }
    } catch (err) {
      console.error('Error polling notifications:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getAnalytics();
        setAnalytics(data);
      } else {
        const res = await fetch(`${apiBaseUrl}/api/analytics`, { headers });
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  // Close notifications panel on outside click
  useEffect(() => {
    const clickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.markAllNotificationsRead();
      } else {
        await fetch(`${apiBaseUrl}/api/notifications/read-all`, {
          method: 'POST',
          headers
        });
      }
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // Mark single notification as read
  const handleMarkNotificationRead = async (id) => {
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.markNotificationRead(id);
      } else {
        await fetch(`${apiBaseUrl}/api/notifications/${id}/read`, {
          method: 'POST',
          headers
        });
      }
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // LEAD OPERATION METHODS (STATUS, MODAL, TIMELINE)
  // ----------------------------------------------------
  
  const handleOpenLead = async (lead) => {
    setSelectedLead(lead);
    try {
      if (supabaseClient.isEnabled) {
        const data = await supabaseClient.getFollowups(lead._id || lead.id);
        setFollowups(data);
      } else {
        const res = await fetch(`${apiBaseUrl}/api/followups/lead/${lead._id || lead.id}`, { headers });
        const data = await res.json();
        setFollowups(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    setActionLoading(true);
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.updateLeadStatus(leadId, newStatus);
        await fetchLeads();
        await fetchAnalytics();
        if (selectedLead && (selectedLead._id === leadId || selectedLead.id === leadId)) {
          const updatedLead = { ...selectedLead, status: newStatus };
          setSelectedLead(updatedLead);
          handleOpenLead(updatedLead);
        }
      } else {
        const res = await fetch(`${apiBaseUrl}/api/leads/${leadId}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
          await fetchLeads();
          await fetchAnalytics();
          if (selectedLead && (selectedLead._id === leadId || selectedLead.id === leadId)) {
            const updatedLead = { ...selectedLead, status: newStatus };
            setSelectedLead(updatedLead);
            handleOpenLead(updatedLead);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFollowup = async (e) => {
    e.preventDefault();
    if (!newFollowupDate) return;

    try {
      const leadId = selectedLead._id || selectedLead.id;
      if (supabaseClient.isEnabled) {
        await supabaseClient.createFollowup(leadId, newFollowupDate, newFollowupNotes);
      } else {
        await fetch(`${apiBaseUrl}/api/followups`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            leadId,
            date: newFollowupDate,
            notes: newFollowupNotes
          })
        });
      }
      setNewFollowupDate('');
      setNewFollowupNotes('');
      handleOpenLead(selectedLead);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to permanently delete this lead?')) return;
    
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.deleteLead(leadId);
      } else {
        await fetch(`${apiBaseUrl}/api/leads/${leadId}`, {
          method: 'DELETE',
          headers
        });
      }
      setSelectedLead(null);
      fetchLeads();
      fetchAnalytics();
    } catch (err) {
      console.error(err);
    }
  };

  const startEditingLead = () => {
    setEditLeadName(selectedLead.personalInfo.name || '');
    setEditLeadPhone(selectedLead.personalInfo.phone || '');
    setEditLeadEmail(selectedLead.personalInfo.email || '');
    setIsEditingLead(true);
  };

  const handleSaveLeadEdits = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const { error } = await supabase
          .from('leads')
          .update({
            name: editLeadName.trim(),
            phone: editLeadPhone.trim(),
            email: editLeadEmail.trim()
          })
          .eq('id', selectedLead._id || selectedLead.id);
        if (error) throw error;
      } else {
        const res = await fetch(`${apiBaseUrl}/api/leads/${selectedLead._id || selectedLead.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: editLeadName.trim(),
            phone: editLeadPhone.trim(),
            email: editLeadEmail.trim()
          })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to save edits');
        }
      }
      
      const updated = {
        ...selectedLead,
        personalInfo: {
          ...selectedLead.personalInfo,
          name: editLeadName.trim(),
          phone: editLeadPhone.trim(),
          email: editLeadEmail.trim()
        }
      };
      setSelectedLead(updated);
      setIsEditingLead(false);
      fetchLeads();
    } catch (err) {
      alert('Failed to save edits: ' + err.message);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!addName.trim() || !addPhone.trim() || !addLocation) {
      setAddError('Please fill in all required fields.');
      return;
    }

    const cleanPhone = addPhone.trim().replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setAddError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setActionLoading(true);

    try {
      if (supabaseClient.isEnabled) {
        const isDuplicate = await supabaseClient.checkDuplicateLead(addPhone, addType);
        if (isDuplicate) {
          throw new Error('A request from this mobile number is already in progress.');
        }

        const leadPayload = {
          type: addType,
          status: 'new',
          personalInfo: { name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim() },
          buyDetails: addType === 'buy' ? {
            preferredLocation: addLocation,
            propertyType: addPropType || 'Plot',
            minBudget: addBudget || '0',
            maxBudget: addBudget || '0',
            additionalRequirements: addNotes.trim()
          } : null,
          sellDetails: addType === 'sell' ? {
            location: addLocation,
            propertyType: addPropType || 'Plot',
            expectedPrice: addBudget || '0',
            additionalInformation: addNotes.trim()
          } : null
        };

        await supabaseClient.createLead(leadPayload);
        
        await supabaseClient.createNotification(
          `Admin created ${addType.toUpperCase()} lead: ${addName.trim()} (${addPhone.trim()})`,
          'info'
        );

        setAddName('');
        setAddPhone('');
        setAddEmail('');
        setAddLocation('');
        setAddPropType('');
        setAddBudget('');
        setAddNotes('');
        setShowAddLeadModal(false);
        
        fetchLeads();
        fetchAnalytics();
      } else {
        const formData = new FormData();
        formData.append('type', addType);
        formData.append('name', addName.trim());
        formData.append('phone', addPhone.trim());
        formData.append('email', addEmail.trim());

        if (addType === 'buy') {
          formData.append('preferredLocation', addLocation);
          formData.append('propertyType', addPropType || 'Plot');
          formData.append('minBudget', addBudget || '0');
          formData.append('maxBudget', addBudget || '0');
          formData.append('additionalRequirements', addNotes.trim());
        } else {
          formData.append('location', addLocation);
          formData.append('propertyType', addPropType || 'Plot');
          formData.append('expectedPrice', addBudget || '0');
          formData.append('additionalInformation', addNotes.trim());
        }

        const res = await fetch(`${apiBaseUrl}/api/leads`, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Submission failed.');
        }

        setAddName('');
        setAddPhone('');
        setAddEmail('');
        setAddLocation('');
        setAddPropType('');
        setAddBudget('');
        setAddNotes('');
        setShowAddLeadModal(false);
        
        fetchLeads();
        fetchAnalytics();
      }
    } catch (err) {
      setAddError(err.message || 'Error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  // Print utility for single lead details
  const handlePrintLead = () => {
    window.print();
  };

  // Copy Lead details to clipboard
  const handleCopyLeadDetails = () => {
    if (!selectedLead) return;
    const name = selectedLead.personalInfo.name;
    const phone = selectedLead.personalInfo.phone;
    const email = selectedLead.personalInfo.email || 'N/A';
    const type = selectedLead.type.toUpperCase();
    const status = selectedLead.status.toUpperCase();
    
    let detailsStr = `MRV Lead Details (${type})\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nStatus: ${status}\n`;
    
    if (selectedLead.type === 'buy') {
      const buy = selectedLead.buyDetails || {};
      detailsStr += `Location: ${buy.preferredLocation}\nProp Type: ${buy.propertyType}\nBHK: ${buy.bhk}\nBudget: ₹${buy.minBudget || 0} - ₹${buy.maxBudget || 0}\nLoan Required: ${buy.loanRequired}\nReady to Move: ${buy.readyToMove}\nNotes: ${buy.additionalRequirements || 'None'}`;
    } else {
      const sell = selectedLead.sellDetails || {};
      detailsStr += `Location: ${sell.location}\nProp Type: ${sell.propertyType}\nSize: ${sell.size || 'N/A'}\nFacing: ${sell.facing || 'N/A'}\nAge: ${sell.age || 'N/A'}\nExpected Price: ₹${sell.expectedPrice || 0}\nAdditional: ${sell.additionalInformation || 'None'}`;
    }

    navigator.clipboard.writeText(detailsStr);
    alert('Lead details copied to clipboard!');
  };

  // Export Table Data Helper (CSV / Excel format)
  const handleExportLeads = (format) => {
    if (leads.length === 0) {
      alert('No leads available to export.');
      return;
    }

    // Build header array
    const headersArray = ['Lead ID', 'Date', 'Type', 'Name', 'Phone', 'Email', 'Location', 'Property Type', 'Budget / Price', 'Status'];
    
    // Map leads to rows
    const rowsArray = leads.map(l => {
      const date = new Date(l.createdAt).toLocaleDateString();
      const type = l.type.toUpperCase();
      const name = l.personalInfo.name;
      const phone = l.personalInfo.phone;
      const email = l.personalInfo.email || '';
      const location = l.type === 'buy' ? (l.buyDetails?.preferredLocation || '') : (l.sellDetails?.location || '');
      const propType = l.type === 'buy' ? (l.buyDetails?.propertyType || '') : (l.sellDetails?.propertyType || '');
      const price = l.type === 'buy' 
        ? `₹${l.buyDetails?.minBudget || 0} - ₹${l.buyDetails?.maxBudget || 0}`
        : `₹${l.sellDetails?.expectedPrice || 0}`;
      const status = l.status.toUpperCase();

      return [
        l._id || l.id,
        date,
        type,
        name,
        phone,
        email,
        location,
        propType,
        price,
        status
      ];
    });

    if (format === 'csv' || format === 'excel') {
      // Escape strings and assemble CSV content
      const csvContent = [
        headersArray.join(','),
        ...rowsArray.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `MRV_Leads_Export_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'pdf') {
      // Direct print trigger will work best for a complete responsive visual representation
      window.print();
    }
  };

  // ----------------------------------------------------
  // CRUD FOR LOCATIONS
  // ----------------------------------------------------

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!locName.trim()) return;

    try {
      const body = { name: locName.trim(), isHidden: locIsHidden, order: Number(locOrder) };
      
      if (supabaseClient.isEnabled) {
        if (locEditId) {
          await supabaseClient.updateLocation(locEditId, body);
        } else {
          await supabaseClient.createLocation(body);
        }
      } else {
        if (locEditId) {
          await fetch(`${apiBaseUrl}/api/locations/${locEditId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
          });
        } else {
          await fetch(`${apiBaseUrl}/api/locations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });
        }
      }

      setLocName('');
      setLocIsHidden(false);
      setLocOrder(0);
      setLocEditId(null);
      fetchLocations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditLocationClick = (loc) => {
    setLocEditId(loc._id || loc.id);
    setLocName(loc.name);
    setLocIsHidden(loc.isHidden);
    setLocOrder(loc.order || 0);
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Delete this location? It will instantly update client dropdown selection lists.')) return;
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.deleteLocation(id);
      } else {
        await fetch(`${apiBaseUrl}/api/locations/${id}`, {
          method: 'DELETE',
          headers
        });
      }
      fetchLocations();
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // CRUD FOR PROPERTY TYPES
  // ----------------------------------------------------

  const handleSaveProperty = async (e) => {
    e.preventDefault();
    if (!propName.trim()) return;

    try {
      const body = { name: propName.trim(), isEnabled: propIsEnabled };
      
      if (supabaseClient.isEnabled) {
        if (propEditId) {
          await supabaseClient.updatePropertyType(propEditId, body);
        } else {
          await supabaseClient.createPropertyType(body);
        }
      } else {
        if (propEditId) {
          await fetch(`${apiBaseUrl}/api/properties/${propEditId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
          });
        } else {
          await fetch(`${apiBaseUrl}/api/properties`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });
        }
      }

      setPropName('');
      setPropIsEnabled(true);
      setPropEditId(null);
      fetchProperties();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditPropertyClick = (pt) => {
    setPropEditId(pt._id || pt.id);
    setPropName(pt.name);
    setPropIsEnabled(pt.isEnabled);
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm('Delete this property type?')) return;
    try {
      if (supabaseClient.isEnabled) {
        await supabaseClient.deletePropertyType(id);
      } else {
        await fetch(`${apiBaseUrl}/api/properties/${id}`, {
          method: 'DELETE',
          headers
        });
      }
      fetchProperties();
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // CRUD FOR ADMINISTRATORS (USER SETTINGS)
  // ----------------------------------------------------

  const fetchAdminUsers = async () => {
    try {
      if (supabaseClient.isEnabled) {
        // Prepared stub space for Supabase auth profiles mapping
        setAdminUsers([]);
      } else {
        const res = await fetch(`${apiBaseUrl}/api/auth/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAdminUsers(Array.isArray(data) ? data : []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');

    if (!adminUsername.trim() || !adminEmail.trim()) {
      setAdminError('Username and email are required');
      return;
    }

    if (!adminEditId && !adminPassword) {
      setAdminError('Password is required for new accounts');
      return;
    }

    try {
      const body = {
        username: adminUsername.trim(),
        email: adminEmail.trim(),
        role: adminRole,
        isDisabled: adminIsDisabled
      };
      if (adminPassword) {
        body.password = adminPassword;
      }

      let res;
      if (adminEditId) {
        res = await fetch(`${apiBaseUrl}/api/auth/users/${adminEditId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${apiBaseUrl}/api/auth/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed');
      }

      setAdminSuccess(adminEditId ? 'Account updated successfully!' : 'New administrator created!');
      setAdminUsername('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminRole('admin');
      setAdminIsDisabled(false);
      setAdminEditId(null);
      fetchAdminUsers();
    } catch (err) {
      setAdminError(err.message || 'Error occurred.');
    }
  };

  const handleEditAdminClick = (u) => {
    setAdminEditId(u._id || u.id);
    setAdminUsername(u.username);
    setAdminEmail(u.email);
    setAdminPassword('');
    setAdminRole(u.role || 'admin');
    setAdminIsDisabled(u.isDisabled || false);
    setAdminError('');
    setAdminSuccess('');
  };

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this admin user?')) return;
    setAdminError('');
    setAdminSuccess('');

    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/users/${id}`, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Deletion failed');
      }

      setAdminSuccess('Admin account removed successfully.');
      fetchAdminUsers();
    } catch (err) {
      setAdminError(err.message || 'Error occurred.');
    }
  };

  const fetchCurrentUser = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          setCurrentUser(user);
          setProfileUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
          setProfileEmail(user.email || '');
        }
      } else {
        const res = await fetch(`${apiBaseUrl}/api/auth/me`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data);
          setProfileUsername(data.username);
          setProfileEmail(data.email);
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileEmail.trim()) {
      setProfileError('Email is required');
      return;
    }

    try {
      if (supabaseClient.isEnabled) {
        const updates = { email: profileEmail.trim() };
        if (profilePassword) {
          updates.password = profilePassword;
        }
        if (profileUsername.trim()) {
          updates.data = { username: profileUsername.trim() };
        }

        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw new Error(error.message);

        setProfileSuccess('Profile updated successfully!');
        setProfilePassword('');
        fetchCurrentUser();
      } else {
        const body = {
          username: profileUsername.trim(),
          email: profileEmail.trim()
        };
        if (profilePassword) {
          body.password = profilePassword;
        }

        const res = await fetch(`${apiBaseUrl}/api/auth/users/${currentUser.id || currentUser._id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Update failed');
        }

        setProfileSuccess('Profile updated successfully!');
        setProfilePassword('');
        fetchCurrentUser();
      }
    } catch (err) {
      setProfileError(err.message || 'Error occurred.');
    }
  };

  if (selectedLead) {
    const getImageUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `${apiBaseUrl}${url}`;
    };

    const clientInitials = selectedLead.personalInfo.name
      ? selectedLead.personalInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'C';

    return (
      <div className="lead-detail-page" style={{ 
        width: '100%', 
        minHeight: '100vh', 
        background: 'var(--color-black-bg)', 
        color: 'var(--color-white)',
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* STICKY HEADER */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--color-black-card)',
          borderBottom: '1px solid var(--color-border)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }} 
              onClick={() => { setSelectedLead(null); setIsEditingLead(false); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              <span>Back</span>
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-gold-dark)',
                color: 'var(--color-black-pure)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '1rem',
                flexShrink: 0
              }}>
                {clientInitials}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-white)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isEditingLead ? 'Edit Lead Details' : selectedLead.personalInfo.name}
                  </h2>
                  
                  {!isEditingLead ? (
                    <div className="crm-actions-row">
                      <a href={`tel:${selectedLead.personalInfo.phone}`} className="crm-action-btn" title="Call Client">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </a>
                      <a 
                        href={`https://wa.me/91${selectedLead.personalInfo.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(selectedLead.personalInfo.name)},%20this%20is%20Mahesh%20Realty%20Verse.%20We%20received%20your%20property%20request%20and%20wanted%20to%20follow%20up.`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="crm-action-btn"
                        title="WhatsApp Client"
                        style={{ color: '#25D366' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                      </a>
                      <button onClick={handleCopyLeadDetails} className="crm-action-btn" title="Copy Details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button onClick={handlePrintLead} className="crm-action-btn" title="Print Details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button onClick={startEditingLead} className="crm-action-btn" title="Edit Lead">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                      </button>
                      <button onClick={() => { if(confirm("Are you sure you want to delete this lead?")) { handleDeleteLead(selectedLead._id || selectedLead.id); setSelectedLead(null); } }} className="crm-action-btn btn-danger-outline" title="Delete Lead">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-primary" style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={handleSaveLeadEdits}>
                        Save
                      </button>
                      <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setIsEditingLead(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-new" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>ID: {(selectedLead._id || selectedLead.id).substring(0, 8)}</span>
                  <span className={`badge badge-${selectedLead.status}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{selectedLead.status.toUpperCase()}</span>
                  <span className="badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', background: selectedLead.type === 'buy' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: selectedLead.type === 'buy' ? '#60a5fa' : '#34d399', border: `1px solid ${selectedLead.type === 'buy' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                    {selectedLead.type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Status:</span>
              <select
                value={selectedLead.status}
                onChange={(e) => handleUpdateStatus(selectedLead._id || selectedLead.id, e.target.value)}
                className="form-control"
                style={{ width: 'auto', padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.8rem', backgroundPosition: 'right 0.4rem center' }}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="negotiation">Negotiation</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
        </div>

        {/* SINGLE COLUMN CONTENT - SCROLLS NATURALLY */}
        <div style={{ 
          flex: 1, 
          padding: '1.25rem', 
          maxWidth: '900px', 
          width: '100%', 
          margin: '0 auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem' 
        }}>
          
          {/* 1. PERSONAL DETAILS CARD */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
              Personal Details
            </h3>
            
            {isEditingLead ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Full Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={editLeadName} 
                    onChange={(e) => setEditLeadName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Mobile Number</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    value={editLeadPhone} 
                    onChange={(e) => setEditLeadPhone(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Email Address</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={editLeadEmail} 
                    onChange={(e) => setEditLeadEmail(e.target.value)} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Full Name</span>
                  <strong style={{ fontSize: '1rem' }}>{selectedLead.personalInfo.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Phone Number</span>
                  <strong style={{ fontSize: '1rem' }}>{selectedLead.personalInfo.phone}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Email Address</span>
                  <strong style={{ fontSize: '1rem' }}>{selectedLead.personalInfo.email || 'Not Provided'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Date Received</span>
                  <strong style={{ fontSize: '1rem' }}>{new Date(selectedLead.createdAt).toLocaleString()}</strong>
                </div>
              </div>
            )}
          </div>

          {/* 2. PROPERTY DETAILS CARD */}
          {((selectedLead.type === 'buy' && selectedLead.buyDetails) || (selectedLead.type === 'sell' && selectedLead.sellDetails)) && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
                Property Details
              </h3>
              
              {selectedLead.type === 'buy' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Preferred Location</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.buyDetails.preferredLocation}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Property Type</span>
                    <strong style={{ fontSize: '1rem' }}>
                      {selectedLead.buyDetails.propertyType === 'Others' ? `Others (${selectedLead.buyDetails.otherPropertyType})` : selectedLead.buyDetails.propertyType}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>BHK Requirement</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.buyDetails.bhk}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Location</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.sellDetails.location}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Property Type</span>
                    <strong style={{ fontSize: '1rem' }}>
                      {selectedLead.sellDetails.propertyType === 'Others' ? `Others (${selectedLead.sellDetails.otherPropertyType})` : selectedLead.sellDetails.propertyType}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Construction Type</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.sellDetails.constructionType || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Size</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.sellDetails.size || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Facing Direction</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.sellDetails.facing || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Property Age</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.sellDetails.age || 'N/A'}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. BUDGET CARD */}
          {((selectedLead.type === 'buy' && selectedLead.buyDetails) || (selectedLead.type === 'sell' && selectedLead.sellDetails)) && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
                Budget & Readiness
              </h3>
              
              {selectedLead.type === 'buy' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Min Budget</span>
                    <strong style={{ fontSize: '1rem' }}>₹{selectedLead.buyDetails.minBudget?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Max Budget</span>
                    <strong style={{ fontSize: '1rem' }}>₹{selectedLead.buyDetails.maxBudget?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Loan Required</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.buyDetails.loanRequired}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Readiness to Move</span>
                    <strong style={{ fontSize: '1rem' }}>{selectedLead.buyDetails.readyToMove}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>Expected Selling Price</span>
                    <strong style={{ fontSize: '1rem' }}>₹{selectedLead.sellDetails.expectedPrice?.toLocaleString()}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. ADDITIONAL NOTES CARD */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
              Additional Notes
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
              {selectedLead.type === 'buy' 
                ? (selectedLead.buyDetails.additionalRequirements || 'No additional requirements specified.') 
                : (selectedLead.sellDetails.additionalInformation || 'No additional information specified.')}
            </p>
          </div>

          {/* 5. UPLOADED IMAGES CARD */}
          {selectedLead.type === 'sell' && selectedLead.sellDetails?.images && selectedLead.sellDetails.images.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
                Uploaded Images ({selectedLead.sellDetails.images.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {selectedLead.sellDetails.images.map((imgUrl, index) => (
                  <a key={index} href={getImageUrl(imgUrl)} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)', height: '110px' }}>
                    <img 
                      src={getImageUrl(imgUrl)} 
                      alt={`Property ${index + 1}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 6. FOLLOW-UP HISTORY & SCHEDULE */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(197,168,128,0.1)', paddingBottom: '0.4rem' }}>
              Follow-up Action Log
            </h3>
            
            {followups.length > 0 ? (
              <div className="timeline" style={{ marginBottom: '1.5rem' }}>
                {followups.map(item => (
                  <div key={item._id || item.id} className="timeline-item" style={{ paddingLeft: '1.5rem', position: 'relative', marginBottom: '1rem' }}>
                    <div className="timeline-dot" style={{ left: 0, top: '4px' }}></div>
                    <div className="timeline-content">
                      <div className="timeline-date" style={{ color: 'var(--color-gold)', fontSize: '0.75rem' }}>{new Date(item.date).toLocaleString()}</div>
                      <div className="timeline-notes" style={{ fontSize: '0.85rem', marginTop: '0.1rem', color: 'var(--color-text-secondary)' }}>{item.notes}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>No followup actions logged yet.</p>
            )}

            <h4 style={{ color: 'var(--color-gold)', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Schedule Next Follow-up
            </h4>
            <form onSubmit={handleAddFollowup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Next Action / Followup Date</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={newFollowupDate}
                  onChange={(e) => setNewFollowupDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Reminder Note / Progress Description</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="E.g. Scheduled site visit for Saturday 11am."
                  value={newFollowupNotes}
                  onChange={(e) => setNewFollowupNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                Schedule Note
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      
      {/* MOBILE HEADER BAR */}
      <div className="mobile-admin-header">
        <div className="admin-logo-section">
          <div style={{ width: '34px', height: '34px' }}>
            <img src={logo} className="mrv-logo" style={{ animation: 'none' }} alt="MRV Logo" />
          </div>
          <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-logo)', fontWeight: '700', letterSpacing: '0.05em' }} className="text-gold">MRV Admin</span>
        </div>
        <button 
          className="mobile-nav-toggle btn-secondary" 
          style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* SIDE NAVIGATION */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-logo-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: '42px', height: '42px' }}>
            <img src={logo} className="mrv-logo" style={{ animation: 'none' }} alt="MRV Logo" />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-logo)', fontWeight: '800', letterSpacing: '0.05em', margin: 0 }} className="text-gold">MRV Admin</h2>
        </div>

        <nav className="admin-menu" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.4rem' }}>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
          >
            Dashboard
          </button>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'buy_leads' ? 'active' : ''}`}
            onClick={() => { setActiveTab('buy_leads'); setSidebarOpen(false); }}
          >
            Buy Leads
          </button>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'sell_leads' ? 'active' : ''}`}
            onClick={() => { setActiveTab('sell_leads'); setSidebarOpen(false); }}
          >
            Sell Leads
          </button>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => { setActiveTab('locations'); setSidebarOpen(false); }}
          >
            Locations
          </button>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => { setActiveTab('properties'); setSidebarOpen(false); }}
          >
            Property Types
          </button>

          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
          >
            Settings
          </button>
          <button 
            className={`admin-menu-item btn-secondary ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => { setActiveTab('export'); setSidebarOpen(false); }}
          >
            Export Data
          </button>
        </nav>

        <div style={{ marginTop: 'auto', width: '100%', paddingTop: '1.5rem', borderTop: '1px solid rgba(197, 168, 128, 0.1)' }}>
          <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="admin-content">
        
        {/* HEADER & NOTIFICATION SYSTEM */}
        <header className="admin-header">
          <div>
            <h1 style={{ fontSize: '1.8rem', textAlign: 'left' }}>Control Panel</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Welcome to Mahesh Realty Verse Admin Management System</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', alignSelf: 'flex-end' }}>
            
            {/* Real-time Notification Bell */}
            <div className="notification-bell-container" ref={notifDropdownRef}>
              <button 
                className="btn btn-secondary"
                style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-gold-bright)' }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </button>
              {unreadNotifications > 0 && (
                <span className="notification-badge">{unreadNotifications}</span>
              )}

              {/* Notification drop panel */}
              {notifOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <span>Recent Alerts</span>
                    <span className="notification-clear-all" onClick={handleMarkAllNotificationsRead}>
                      Mark all read
                    </span>
                  </div>
                  
                  <div className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div 
                          key={n._id || n.id}
                          className={`notification-item ${!n.read ? 'unread' : ''}`}
                          onClick={() => handleMarkNotificationRead(n._id || n.id)}
                        >
                          <p className="notification-item-text">{n.message}</p>
                          <p className="notification-item-time">{new Date(n.createdAt).toLocaleTimeString()}</p>
                        </div>
                      ))
                    ) : (
                      <div className="notification-panel-empty">No alerts received yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button className="btn btn-secondary" onClick={fetchInitialData}>
              Refresh
            </button>
          </div>
        </header>

        {/* METRICS METERS ROW */}
        {analytics && analytics.summary && (
          <div className="admin-metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Total Leads</div>
              <div className="metric-value">{analytics.summary.totalLeads}</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Today's Leads</div>
              <div className="metric-value text-gold">{analytics.summary.todayLeads}</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Pending Timeline</div>
              <div className="metric-value">{analytics.summary.pendingFollowups}</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Closed / Deals</div>
              <div className="metric-value" style={{ color: 'var(--color-success)' }}>
                {analytics.summary.closedDeals}
              </div>
              <div className="metric-trend" style={{ color: 'var(--color-success)' }}>
                Conversion Rate: {analytics.summary.conversionRate}%
              </div>
            </div>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Retrieving secure ledger...</p>
          </div>
        ) : (
          <>
            
            {/* VIEW TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                
                {/* Metric Overview Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                  <div className="metric-card" style={{ borderLeft: '3px solid var(--color-gold)' }}>
                    <div className="metric-label">Total Leads Base</div>
                    <div className="metric-value">{leads.length}</div>
                    <div className="metric-trend">Total customer submissions</div>
                  </div>
                  <div className="metric-card" style={{ borderLeft: '3px solid var(--color-gold-bright)' }}>
                    <div className="metric-label">Buy Leads</div>
                    <div className="metric-value text-gold">{leads.filter(l => l.type === 'buy').length}</div>
                    <div className="metric-trend">Active buyer requirements</div>
                  </div>
                  <div className="metric-card" style={{ borderLeft: '3px solid var(--color-white)' }}>
                    <div className="metric-label">Sell Listings</div>
                    <div className="metric-value">{leads.filter(l => l.type === 'sell').length}</div>
                    <div className="metric-trend">Verified seller properties</div>
                  </div>
                  <div className="metric-card" style={{ borderLeft: '3px solid var(--color-success)' }}>
                    <div className="metric-label">Deals Closed</div>
                    <div className="metric-value" style={{ color: 'var(--color-success)' }}>
                      {analytics?.summary?.closedDeals || 0}
                    </div>
                    <div className="metric-trend">Conversion: {analytics?.summary?.conversionRate || 0}%</div>
                  </div>
                </div>

                {/* Dashboard Widgets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                  
                  {/* Market Spread & Locations Widget */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', textAlign: 'left' }}>Market Request Spread</h3>
                    {analytics ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                          <span>Buy Requests: {analytics.summary.buyRequests}</span>
                          <span>Sell Requests: {analytics.summary.sellRequests}</span>
                        </div>
                        <div className="ratio-bar" style={{ marginBottom: '1.5rem' }}>
                          <div 
                            className="ratio-bar-buy" 
                            style={{ width: `${analytics.summary.totalLeads > 0 ? (analytics.summary.buyRequests / analytics.summary.totalLeads) * 100 : 50}%` }}
                          >
                            {analytics.summary.totalLeads > 0 ? Math.round((analytics.summary.buyRequests / analytics.summary.totalLeads) * 100) : 50}%
                          </div>
                          <div 
                            className="ratio-bar-sell" 
                            style={{ width: `${analytics.summary.totalLeads > 0 ? (analytics.summary.sellRequests / analytics.summary.totalLeads) * 100 : 50}%` }}
                          >
                            {analytics.summary.totalLeads > 0 ? Math.round((analytics.summary.sellRequests / analytics.summary.totalLeads) * 100) : 50}%
                          </div>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading market details...</p>
                    )}

                    <h4 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '1rem', textAlign: 'left', color: 'var(--color-gold-bright)' }}>Top Service Locations</h4>
                    <div className="bar-chart-container" style={{ gap: '0.75rem' }}>
                      {analytics?.topLocations?.slice(0, 3).map((loc, idx) => {
                        const maxCount = analytics.topLocations[0]?.count || 1;
                        const percentage = Math.round((loc.count / maxCount) * 100);
                        return (
                          <div key={idx} className="bar-chart-row">
                            <div className="bar-chart-label-container" style={{ fontSize: '0.75rem' }}>
                              <span>{loc.name}</span>
                              <span>{loc.count} leads</span>
                            </div>
                            <div className="bar-chart-track" style={{ height: '8px' }}>
                              <div className="bar-chart-fill" style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Submissions Widget */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.2rem', textAlign: 'left' }}>Recent Inflow</h3>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} 
                        onClick={() => setActiveTab('buy_leads')}
                      >
                        Browse All
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {leads.slice(0, 4).map(lead => (
                        <div 
                          key={lead._id || lead.id} 
                          className="card" 
                          style={{ padding: '1rem', cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => handleOpenLead(lead)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lead.personalInfo.name}</span>
                            <span className={`badge badge-${lead.status}`} style={{ fontSize: '0.65rem' }}>
                              {lead.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                            <span>Phone: {lead.personalInfo.phone}</span>
                            <span style={{ color: lead.type === 'buy' ? 'var(--color-gold-bright)' : '#ffffff', fontWeight: 'bold' }}>
                              {lead.type.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {leads.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>No leads registered yet.</p>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* VIEW TAB: BUY LEADS & SELL LEADS */}
            {(activeTab === 'buy_leads' || activeTab === 'sell_leads') && (
              <div className="glass-panel" style={{ padding: '1.5rem', animation: 'fadeIn var(--transition-fast)' }}>
                
                {/* Search & Advanced Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ fontSize: '1.4rem', textAlign: 'left', margin: 0 }}>
                    {activeTab === 'buy_leads' ? 'Buy Property Requests' : 'Sell Property Listings'}
                  </h2>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setAddType(activeTab === 'buy_leads' ? 'buy' : 'sell');
                      setShowAddLeadModal(true);
                    }}
                  >
                    Add Lead Manually
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Search Name/Phone</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type to search..."
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Status Filter</label>
                    <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="interested">Interested</option>
                      <option value="site_visit">Site Visit</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="closed">Closed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Location Filter</label>
                    <select className="form-control" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
                      <option value="">All Locations</option>
                      {locations.map(l => (
                        <option key={l._id || l.id} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Property Type</label>
                    <select className="form-control" value={filterPropType} onChange={(e) => setFilterPropType(e.target.value)}>
                      <option value="">All Types</option>
                      {properties.map(p => (
                        <option key={p._id || p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Inflow Period</label>
                    <select className="form-control" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
                      <option value="">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last_7_days">Last 7 Days</option>
                      <option value="last_30_days">Last 30 Days</option>
                    </select>
                  </div>
                </div>

                {/* Leads Grid Table */}
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Lead ID</th>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Location</th>
                        <th>Prop Type</th>
                        <th>Budget / Ask</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length > 0 ? (
                        leads.map(lead => {
                          const date = new Date(lead.createdAt).toLocaleDateString();
                          const location = lead.type === 'buy' ? lead.buyDetails?.preferredLocation : lead.sellDetails?.location;
                          const propType = lead.type === 'buy' ? lead.buyDetails?.propertyType : lead.sellDetails?.propertyType;
                          
                          let price = 'N/A';
                          if (lead.type === 'buy' && lead.buyDetails) {
                            price = `₹${lead.buyDetails.minBudget?.toLocaleString()} - ₹${lead.buyDetails.maxBudget?.toLocaleString()}`;
                          } else if (lead.type === 'sell' && lead.sellDetails) {
                            price = `₹${lead.sellDetails.expectedPrice?.toLocaleString()}`;
                          }

                          return (
                            <tr key={lead._id || lead.id}>
                              <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                                {(lead._id || lead.id).substring(0, 8)}
                              </td>
                              <td>{date}</td>
                              <td style={{ fontWeight: 600 }}>{lead.personalInfo.name}</td>
                              <td>{lead.personalInfo.phone}</td>
                              <td>{location || 'Other'}</td>
                              <td>{propType || 'Other'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{price}</td>
                              <td>
                                <span className={`badge badge-${lead.status}`}>
                                  {lead.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                    onClick={() => handleOpenLead(lead)}
                                  >
                                    View
                                  </button>
                                  <select 
                                    className="form-control"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto', background: '#000', margin: 0 }}
                                    value={lead.status}
                                    onChange={(e) => handleUpdateStatus(lead._id || lead.id, e.target.value)}
                                  >
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="interested">Interested</option>
                                    <option value="site_visit">Site Visit</option>
                                    <option value="negotiation">Negotiation</option>
                                    <option value="closed">Closed</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                            No lead profiles recorded matching these criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* VIEW TAB: LOCATIONS CONFIG CRUD */}
            {activeTab === 'locations' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                
                {/* Form Editor Left */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                    {locEditId ? 'Edit Location Property' : 'Add Serviceable Location'}
                  </h3>

                  <form onSubmit={handleSaveLocation} style={{ textAlign: 'left' }}>
                    <div className="form-group">
                      <label className="form-label">Location Name</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="E.g. Madhapur, Gachibowli"
                        value={locName}
                        onChange={(e) => setLocName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Sort Order (Weight)</label>
                        <input 
                          type="number" 
                          className="form-control"
                          value={locOrder}
                          onChange={(e) => setLocOrder(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Visibility State</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
                          <input 
                            type="checkbox"
                            checked={locIsHidden}
                            onChange={(e) => setLocIsHidden(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-gold)' }}
                          />
                          <span style={{ fontSize: '0.85rem' }}>Hide from dropdown options</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                        {locEditId ? 'Update Location' : 'Create Location'}
                      </button>
                      {locEditId && (
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                          onClick={() => {
                            setLocEditId(null);
                            setLocName('');
                            setLocIsHidden(false);
                            setLocOrder(0);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Location listings */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>Serviceable Locations List</h3>
                  
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Weight</th>
                          <th>Location Name</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locations.map(loc => (
                          <tr key={loc._id || loc.id}>
                            <td>{loc.order}</td>
                            <td style={{ fontWeight: 600 }}>{loc.name}</td>
                            <td>
                              <span className={loc.isHidden ? 'text-error' : 'text-success'} style={{ fontWeight: 600 }}>
                                {loc.isHidden ? 'Hidden' : 'Active'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleEditLocationClick(loc)}>
                                  Edit
                                </button>
                                <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleDeleteLocation(loc._id || loc.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW TAB: PROPERTY TYPE CONFIG CRUD */}
            {activeTab === 'properties' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                
                {/* Form Editor Left */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                    {propEditId ? 'Edit Property Type' : 'Add Property Type'}
                  </h3>

                  <form onSubmit={handleSaveProperty} style={{ textAlign: 'left' }}>
                    <div className="form-group">
                      <label className="form-label">Property Type Name</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="E.g. Villa, Studio, Commercial Office"
                        value={propName}
                        onChange={(e) => setPropName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Status State</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
                        <input 
                          type="checkbox"
                          checked={propIsEnabled}
                          onChange={(e) => setPropIsEnabled(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--color-gold)' }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>Enable for customer dropdown selection</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                        {propEditId ? 'Update Type' : 'Create Type'}
                      </button>
                      {propEditId && (
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                          onClick={() => {
                            setPropEditId(null);
                            setPropName('');
                            setPropIsEnabled(true);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Property Type Listings table */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>Configured Property Types</h3>
                  
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Property Category</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {properties.map(pt => (
                          <tr key={pt._id || pt.id}>
                            <td style={{ fontWeight: 600 }}>{pt.name}</td>
                            <td>
                              <span className={pt.isEnabled ? 'text-success' : 'text-error'} style={{ fontWeight: 600 }}>
                                {pt.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleEditPropertyClick(pt)}>
                                  Edit
                                </button>
                                <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleDeleteProperty(pt._id || pt.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}



            {/* VIEW TAB: SETTINGS CONFIG */}
            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                {/* Account Settings */}
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'left' }}>
                  <h2 className="text-gold" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Profile & Security Settings</h2>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                    Update your administrative username, email address, and account password.
                  </p>

                  {profileError && (
                    <div className="text-error" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                      Error: {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="text-success" style={{ marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      {profileSuccess}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '500px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Username</label>
                      <input 
                        type="text"
                        className="form-control"
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Email Address</label>
                      <input 
                        type="email"
                        className="form-control"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Password <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(Leave blank to keep current)</span>
                      </label>
                      <input 
                        type="password"
                        className="form-control"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                        placeholder="Enter new password (optional)"
                      />
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}>
                        Update Account
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW TAB: EXPORT DATA HUB */}
            {activeTab === 'export' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--color-gold-bright)', fontSize: '2.5rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gold">Tabular CSV Format</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Export all current leads into a plain text comma-separated values document. Ideal for importing into arbitrary spreadsheet applications.
                  </p>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 'auto', padding: '0.6rem' }} onClick={() => handleExportLeads('csv')}>
                    Export CSV Document
                  </button>
                </div>

                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--color-gold-bright)', fontSize: '2.5rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                      <line x1="15" y1="3" x2="15" y2="21"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="15" x2="21" y2="15"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gold">Excel Spreadsheet</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Export complete lead directories formatted in Excel XLS format. Contains detailed contact and requirement columns.
                  </p>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 'auto', padding: '0.6rem' }} onClick={() => handleExportLeads('excel')}>
                    Export XLS Spreadsheet
                  </button>
                </div>

                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--color-gold-bright)', fontSize: '2.5rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gold">Printable PDF Ledger</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Trigger system print dialog to save the leads registry as a formatted PDF layout. Auto-hides dashboards and sidebars.
                  </p>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 'auto', padding: '0.6rem' }} onClick={() => handleExportLeads('pdf')}>
                    Print Ledger Layout
                  </button>
                </div>
              </div>
            )}

            {/* VIEW TAB: ANALYTICS PANEL */}
            {activeTab === 'analytics' && analytics && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem', animation: 'fadeIn var(--transition-fast)' }}>
                
                {/* Buy vs Sell breakdown */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', textAlign: 'left' }}>Market Request Spread (Buy vs Sell)</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                    <span>BUY Requests: {analytics.summary.buyRequests}</span>
                    <span>SELL Requests: {analytics.summary.sellRequests}</span>
                  </div>
                  <div className="ratio-bar">
                    <div 
                      className="ratio-bar-buy" 
                      style={{ width: `${analytics.summary.totalLeads > 0 ? (analytics.summary.buyRequests / analytics.summary.totalLeads) * 100 : 50}%` }}
                    >
                      {analytics.summary.totalLeads > 0 ? Math.round((analytics.summary.buyRequests / analytics.summary.totalLeads) * 100) : 50}%
                    </div>
                    <div 
                      className="ratio-bar-sell" 
                      style={{ width: `${analytics.summary.totalLeads > 0 ? (analytics.summary.sellRequests / analytics.summary.totalLeads) * 100 : 50}%` }}
                    >
                      {analytics.summary.totalLeads > 0 ? Math.round((analytics.summary.sellRequests / analytics.summary.totalLeads) * 100) : 50}%
                    </div>
                  </div>
                </div>

                {/* Top locations custom bar chart */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>Lead Inflow by Location</h3>
                  <div className="bar-chart-container">
                    {analytics.topLocations && analytics.topLocations.slice(0, 6).map((loc, idx) => {
                      const maxCount = analytics.topLocations[0]?.count || 1;
                      const percentage = Math.round((loc.count / maxCount) * 100);
                      return (
                        <div key={idx} className="bar-chart-row">
                          <div className="bar-chart-label-container">
                            <span style={{ fontWeight: 600 }}>{loc.name}</span>
                            <span>{loc.count} leads</span>
                          </div>
                          <div className="bar-chart-track">
                            <div className="bar-chart-fill" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly Volume Trends */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>Lead Flow Trends (Monthly)</h3>
                  <div className="bar-chart-container">
                    {analytics.monthlyTrends && analytics.monthlyTrends.map((trend, idx) => {
                      const maxTotal = Math.max(...analytics.monthlyTrends.map(t => t.total), 1);
                      const percentage = Math.round((trend.total / maxTotal) * 100);
                      return (
                        <div key={idx} className="bar-chart-row">
                          <div className="bar-chart-label-container">
                            <span style={{ fontWeight: 600 }}>{trend.name}</span>
                            <span>{trend.total} leads ({trend.buy} Buy / {trend.sell} Sell)</span>
                          </div>
                          <div className="bar-chart-track">
                            <div className="bar-chart-fill" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* VIEW TAB: PROFILE DETAIL */}
            {activeTab === 'profile' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', animation: 'fadeIn var(--transition-fast)' }}>
                <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-black-pure)' }}>
                      M
                    </div>
                    <div>
                      <h2 className="text-gold" style={{ fontSize: '1.4rem', margin: 0 }}>Mahesh Administrator</h2>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>Role: System Owner</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Security Level</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.2rem' }}>Level 1 Root access</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Session Metadata</span>
                      <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>IP: 127.0.0.1 (Localhost)</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Terminal Environment</span>
                      <div style={{ fontSize: '0.95rem', marginTop: '0.2rem' }}>Antigravity AI Client Session</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* MANUAL ADD LEAD DIALOG / MODAL */}
      {showAddLeadModal && (
        <div className="modal-overlay" onClick={() => setShowAddLeadModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            
            <div className="modal-header">
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Add Property Inquiry</h2>
              <button className="modal-close" onClick={() => setShowAddLeadModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ textAlign: 'left' }}>
              {addError && (
                <div style={{ background: 'var(--color-error-glow)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '0.8rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                  {addError}
                </div>
              )}

              <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <div className="form-group">
                  <label className="form-label">Inquiry Profile Type</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="addType" 
                        value="buy"
                        checked={addType === 'buy'}
                        onChange={() => setAddType('buy')}
                        style={{ accentColor: 'var(--color-gold-bright)' }}
                      /> Buy Requirement
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="addType" 
                        value="sell"
                        checked={addType === 'sell'}
                        onChange={() => setAddType('sell')}
                        style={{ accentColor: 'var(--color-gold-bright)' }}
                      /> Sell Listing
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Enter name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input 
                      type="tel"
                      className="form-control"
                      placeholder="10-digit number"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email"
                      className="form-control"
                      placeholder="Optional"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Location *</label>
                    <select 
                      className="form-control" 
                      value={addLocation} 
                      onChange={(e) => setAddLocation(e.target.value)} 
                      required
                    >
                      <option value="">-- Select Location --</option>
                      {locations.map(l => (
                        <option key={l._id || l.id} value={l.name}>{l.name}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Property Type</label>
                    <select 
                      className="form-control" 
                      value={addPropType} 
                      onChange={(e) => setAddPropType(e.target.value)}
                    >
                      <option value="">-- Select Category --</option>
                      {properties.map(p => (
                        <option key={p._id || p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {addType === 'buy' ? 'Max Budget Target (INR)' : 'Expected Selling Price (INR)'}
                  </label>
                  <input 
                    type="number"
                    className="form-control"
                    placeholder="E.g. 7500000"
                    value={addBudget}
                    onChange={(e) => setAddBudget(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Requirements / Additional Details</label>
                  <textarea
                    className="form-control"
                    placeholder="E.g. East facing corner plot, commercial office spaces"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddLeadModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                    {actionLoading ? 'Creating...' : 'Submit Lead'}
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
