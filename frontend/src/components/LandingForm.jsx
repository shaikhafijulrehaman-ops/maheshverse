import React, { useState, useEffect, useRef } from 'react';
import logo from '../assets/logo.png';
import { supabaseClient } from '../utils/supabaseClient';

export default function LandingForm({ apiBaseUrl }) {
  const [leadType, setLeadType] = useState(null); // 'buy' or 'sell'
  const [locations, setLocations] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  
  // Form general state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Buy Form state
  const [buyLocation, setBuyLocation] = useState('');
  const [buyLocationSearch, setBuyLocationSearch] = useState('');
  const [buyLocationOpen, setBuyLocationOpen] = useState(false);
  const [buyPropertyType, setBuyPropertyType] = useState('Plot');
  const [buyOtherPropertyType, setBuyOtherPropertyType] = useState('');
  const [buyBhk, setBuyBhk] = useState('2 BHK');
  const [buyMinBudget, setBuyMinBudget] = useState('');
  const [buyMaxBudget, setBuyMaxBudget] = useState('');
  const [buyLoan, setBuyLoan] = useState('No');
  const [buyReady, setBuyReady] = useState("Doesn't Matter");
  const [buyRequirements, setBuyRequirements] = useState('');

  // Sell Form state
  const [sellLocation, setSellLocation] = useState('');
  const [sellLocationSearch, setSellLocationSearch] = useState('');
  const [sellLocationOpen, setSellLocationOpen] = useState(false);
  const [sellPropertyType, setSellPropertyType] = useState('Plot');
  const [sellOtherPropertyType, setSellOtherPropertyType] = useState('');
  const [sellConstructionType, setSellConstructionType] = useState('');
  const [sellSize, setSellSize] = useState('');
  const [sellFacing, setSellFacing] = useState('East');
  const [sellAge, setSellAge] = useState('New');
  const [sellExpectedPrice, setSellExpectedPrice] = useState('');
  const [sellAdditionalInfo, setSellAdditionalInfo] = useState('');
  const [sellImages, setSellImages] = useState([]); // Array of File objects
  const [sellPreviews, setSellPreviews] = useState([]); // Array of { id, url }
  
  // UI States
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState('idle'); // 'idle' | 'loading' | 'flip' | 'success'
  const [serverErrorMsg, setServerErrorMsg] = useState('');

  const dropdownRefBuy = useRef(null);
  const dropdownRefSell = useRef(null);

  // Fetch Locations & Properties from Admin dynamically
  useEffect(() => {
    fetchLocationsAndProperties();
  }, []);

  const fetchLocationsAndProperties = async () => {
    try {
      if (supabaseClient.isEnabled) {
        const locs = await supabaseClient.getLocations();
        setLocations(locs.filter(l => !l.isHidden));

        const props = await supabaseClient.getPropertyTypes();
        setPropertyTypes(props.filter(p => p.isEnabled));
      } else {
        const locRes = await fetch(`${apiBaseUrl}/api/locations`);
        const locData = await locRes.json();
        setLocations(locData);

        const propRes = await fetch(`${apiBaseUrl}/api/properties`);
        const propData = await propRes.json();
        setPropertyTypes(propData);
      }
    } catch (err) {
      console.error('Error fetching dropdowns:', err);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRefBuy.current && !dropdownRefBuy.current.contains(e.target)) {
        setBuyLocationOpen(false);
      }
      if (dropdownRefSell.current && !dropdownRefSell.current.contains(e.target)) {
        setSellLocationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle Image uploads and previews
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Enforce max 10 images limit
    if (sellImages.length + files.length > 10) {
      alert('You can upload a maximum of 10 images.');
      return;
    }

    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      alert('Only image files are allowed.');
    }

    const newImages = [...sellImages, ...validFiles];
    setSellImages(newImages);

    // Generate previews
    const newPreviews = validFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file: file,
      url: URL.createObjectURL(file)
    }));
    setSellPreviews([...sellPreviews, ...newPreviews]);
  };

  const removeImage = (idToRemove) => {
    const previewToRemove = sellPreviews.find(p => p.id === idToRemove);
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
    }
    setSellPreviews(sellPreviews.filter(p => p.id !== idToRemove));
    setSellImages(sellImages.filter((_, idx) => sellPreviews[idx].id !== idToRemove));
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      sellPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []);

  // Form Validation
  const validateForm = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = 'Full name is required';
    
    // Mobile Validation
    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phone.trim()) {
      tempErrors.phone = 'Mobile number is required';
    } else if (!phoneRegex.test(cleanPhone)) {
      tempErrors.phone = 'Please enter a valid 10-digit Indian mobile number';
    }

    // Email Validation (optional)
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        tempErrors.email = 'Please enter a valid email address';
      }
    }

    if (leadType === 'buy') {
      if (!buyLocation) tempErrors.buyLocation = 'Please select a preferred location';
      if (!buyPropertyType) tempErrors.buyPropertyType = 'Please select a property type';
      
      const min = Number(buyMinBudget);
      const max = Number(buyMaxBudget);
      if (buyMinBudget && isNaN(min)) tempErrors.buyMinBudget = 'Must be a number';
      if (buyMaxBudget && isNaN(max)) tempErrors.buyMaxBudget = 'Must be a number';
      if (min && max && min > max) {
        tempErrors.buyMinBudget = 'Min budget cannot exceed max budget';
      }
    }

    if (leadType === 'sell') {
      if (!sellLocation) tempErrors.sellLocation = 'Please select your property location';
      if (!sellPropertyType) tempErrors.sellPropertyType = 'Please select a property type';
      if (sellExpectedPrice && isNaN(Number(sellExpectedPrice))) {
        tempErrors.sellExpectedPrice = 'Price must be a number';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Submit Lead Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerErrorMsg('');
    setSubmissionPhase('loading'); // Show blur and spinner

    const formData = new FormData();
    formData.append('type', leadType);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('email', email);

    if (leadType === 'buy') {
      formData.append('preferredLocation', buyLocation);
      formData.append('propertyType', buyPropertyType);
      formData.append('otherPropertyType', buyOtherPropertyType);
      formData.append('bhk', buyBhk);
      formData.append('minBudget', buyMinBudget);
      formData.append('maxBudget', buyMaxBudget);
      formData.append('loanRequired', buyLoan);
      formData.append('readyToMove', buyReady);
      formData.append('additionalRequirements', buyRequirements);
    } else {
      formData.append('location', sellLocation);
      formData.append('propertyType', sellPropertyType);
      formData.append('otherPropertyType', sellOtherPropertyType);
      formData.append('constructionType', sellConstructionType);
      formData.append('size', sellSize);
      formData.append('facing', sellFacing);
      formData.append('age', sellAge);
      formData.append('expectedPrice', sellExpectedPrice);
      formData.append('additionalInformation', sellAdditionalInfo);
      
      // Append files
      sellImages.forEach(file => {
        formData.append('images', file);
      });
    }

    try {
      if (supabaseClient.isEnabled) {
        // 1. Verify 2-hour deduplication
        const isDuplicate = await supabaseClient.checkDuplicateLead(phone, leadType);
        if (isDuplicate) {
          throw new Error('A request from this mobile number is already in progress. Our team will contact you within 24 hours.');
        }

        // 2. Upload images if "sell"
        let uploadedImages = [];
        if (leadType === 'sell' && sellImages.length > 0) {
          for (const file of sellImages) {
            const url = await supabaseClient.uploadImage(file);
            uploadedImages.push(url);
          }
        }

        // 3. Construct Lead Payload
        const leadPayload = {
          type: leadType,
          status: 'new',
          personalInfo: { name, phone, email },
          buyDetails: leadType === 'buy' ? {
            preferredLocation: buyLocation,
            propertyType: buyPropertyType,
            otherPropertyType: buyOtherPropertyType,
            bhk: buyBhk,
            minBudget: buyMinBudget,
            maxBudget: buyMaxBudget,
            loanRequired: buyLoan,
            readyToMove: buyReady,
            additionalRequirements: buyRequirements
          } : null,
          sellDetails: leadType === 'sell' ? {
            location: sellLocation,
            propertyType: sellPropertyType,
            otherPropertyType: sellOtherPropertyType,
            constructionType: sellConstructionType,
            size: sellSize,
            facing: sellFacing,
            age: sellAge,
            expectedPrice: sellExpectedPrice,
            images: uploadedImages,
            additionalInformation: sellAdditionalInfo
          } : null
        };

        // 4. Submit Lead
        await supabaseClient.createLead(leadPayload);
        
        // 5. Create notification
        await supabaseClient.createNotification(
          `New ${leadType.toUpperCase()} lead: ${name} (${phone}) - ${leadType === 'buy' ? buyLocation : sellLocation}`,
          'info'
        );

      } else {
        const response = await fetch(`${apiBaseUrl}/api/leads`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Submission failed');
        }
      }

      // Success Phase Flow
      setTimeout(() => {
        setSubmissionPhase('flip');
        
        setTimeout(() => {
          setSubmissionPhase('success');

          // Auto redirect/reset after 4 seconds
          setTimeout(() => {
            resetForm();
          }, 4000);

        }, 3000); // Wait for 3D flip animation (2 cycles of flip3d is 3s)
      }, 1500);

    } catch (err) {
      console.error(err);
      setServerErrorMsg(err.message || 'An error occurred during submission.');
      setSubmissionPhase('idle');
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    // Reset all states
    setLeadType(null);
    setName('');
    setPhone('');
    setEmail('');
    
    setBuyLocation('');
    setBuyPropertyType('Plot');
    setBuyOtherPropertyType('');
    setBuyMinBudget('');
    setBuyMaxBudget('');
    setBuyRequirements('');
    
    setSellLocation('');
    setSellPropertyType('Plot');
    setSellOtherPropertyType('');
    setSellConstructionType('');
    setSellSize('');
    setSellExpectedPrice('');
    setSellAdditionalInfo('');
    setSellImages([]);
    sellPreviews.forEach(p => URL.revokeObjectURL(p.url));
    setSellPreviews([]);
    
    setErrors({});
    setIsSubmitting(false);
    setSubmissionPhase('idle');
  };

  // Filter locations for searchable dropdown
  const filteredBuyLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(buyLocationSearch.toLowerCase())
  );

  const filteredSellLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(sellLocationSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem 0' }}>
      
      {/* Dynamic Submit success screen overlay */}
      <div className={`submission-overlay ${submissionPhase !== 'idle' ? 'active' : ''}`}>
        <div className="overlay-content">
          
          {submissionPhase === 'loading' && (
            <>
              <div className="spinner"></div>
              <h3 style={{ fontFamily: 'var(--font-primary)', letterSpacing: '0.05em' }}>Validating Details...</h3>
            </>
          )}

          {submissionPhase === 'flip' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <div style={{ width: '120px', height: '120px' }}>
                <img 
                  src={logo} 
                  className="animating-logo logo-flip-3d" 
                  alt="MRV Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} 
                />
              </div>
              <h3 style={{ fontFamily: 'var(--font-primary)', letterSpacing: '0.1em' }} className="text-gold">Processing Requirements</h3>
            </div>
          )}

          {submissionPhase === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
              <div className="success-badge">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: 'auto' }}>
                  <polyline points="20 6 9 17 4 12" className="success-checkmark-svg" />
                </svg>
              </div>
              <div className="glowing-text">Submission Successful</div>
              <p className="success-message" style={{ margin: 0, fontWeight: 500 }}>Thank you for submitting your details.</p>
              <p className="success-sub" style={{ margin: 0 }}>Our team will contact you soon.</p>
            </div>
          )}

        </div>
      </div>

      {/* Main UI */}
      <div className="glass-panel" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        
        {/* Branding header */}
        <div className="branding-header">
          <div className="logo-container">
            <img 
              src={logo} 
              alt="MRV Logo" 
              className="mrv-logo"
            />
          </div>
          <h1 className="text-gold branding-title">Find Your Perfect Property</h1>
          <p className="subtitle branding-subtitle">Our team will contact you within 24 hours.</p>
        </div>

        {/* Step 1: Selector Cards */}
        {leadType === null ? (
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', fontFamily: 'var(--font-primary)', fontWeight: '600' }}>
              What are you looking for?
            </h3>
            
            <div className="selector-cards-container">
              <div 
                className="selector-card"
                onClick={() => setLeadType('buy')}
              >
                <div className="selector-card-icons-row">
                  {/* Luxury house icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M3 10l9-7 9 7v11H3V10z"/>
                    <path d="M9 21v-6h6v6M12 3v4"/>
                  </svg>
                  {/* Building icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="1"/>
                    <path d="M9 6h2m-2 4h2m-2 4h2m-2 4h2M13 6h2m-2 4h2m-2 4h2m-2 4h2"/>
                  </svg>
                  {/* Key icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="15.5" r="3.5"/>
                    <path d="M10 13l9-9m2 2l-2-2m-3 3l-1.5-1.5M17 6l-1.5-1.5"/>
                  </svg>
                  {/* Property search icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 11.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8l6-4.5 3 2.25"/>
                    <circle cx="16.5" cy="7.5" r="3.5"/>
                    <path d="M19 10l3 3"/>
                  </svg>
                </div>
                <div className="selector-card-title">Buy Property</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Explore luxury properties to invest or live</p>
              </div>

              <div 
                className="selector-card"
                onClick={() => setLeadType('sell')}
              >
                <div className="selector-card-icons-row">
                  {/* Property listing icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
                    <path d="M9 7h6M9 11h6M9 15h4"/>
                  </svg>
                  {/* Home with sale tag */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10l9-7 9 7v11H3V10z"/>
                    <path d="M9 14h6v7H9v-7z"/>
                    <rect x="11" y="6" width="2" height="4" rx="0.5" transform="rotate(45 12 8)"/>
                  </svg>
                  {/* Commercial building icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V7l7-3 7 3v14M9 9h2m-2 4h2m-2 4h2M13 9h2m-2 4h2m-2 4h2"/>
                  </svg>
                  {/* Real estate selling icon */}
                  <svg class="premium-gold-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M19 8l-3 3 3 3m2-3h-5"/>
                  </svg>
                </div>
                <div className="selector-card-title">Sell Property</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>List your premium property for verified buyers</p>
              </div>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Select an option to begin custom consultation.
            </p>
          </div>
        ) : (
          
          /* Form Content with smooth transitions */
          <form onSubmit={handleSubmit} style={{ animation: 'fadeIn 0.4s ease-in-out' }}>
            
            {/* Form Toggle Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 2 of 2
                </span>
                <h3 style={{ fontSize: '1.4rem' }}>
                  {leadType === 'buy' ? 'Preferred Purchase Profile' : 'Property Listing Profile'}
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                onClick={resetForm}
              >
                Back
              </button>
            </div>

            {serverErrorMsg && (
              <div style={{ 
                background: 'var(--color-error-glow)', 
                border: '1px solid var(--color-error)', 
                color: '#fca5a5', 
                padding: '0.8rem', 
                borderRadius: 'var(--border-radius-sm)', 
                marginBottom: '1.5rem', 
                fontSize: '0.9rem',
                textAlign: 'left'
              }}>
                Error: {serverErrorMsg}
              </div>
            )}

            {/* SECTION: PERSONAL INFORMATION */}
            <div style={{ marginBottom: '2.5rem', textAlign: 'left' }}>
              <h4 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold-bright)', marginBottom: '1.25rem', borderLeft: '2px solid var(--color-gold)', paddingLeft: '8px' }}>
                Personal Information
              </h4>
              
              <div className="form-group">
                <label className="form-label">Full Name <span>*</span></label>
                <input 
                  type="text" 
                  className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                />
                {errors.name && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.name}</span>}
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Mobile Number <span>*</span></label>
                  <input 
                    type="tel" 
                    className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-Digit Mobile Number"
                  />
                  {errors.phone && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.phone}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Optional)</label>
                  <input 
                    type="email" 
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  {errors.email && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.email}</span>}
                </div>
              </div>
            </div>

            {/* SECTION: BUY PROPERTY FORM DETAILS */}
            {leadType === 'buy' && (
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold-bright)', marginBottom: '1.25rem', borderLeft: '2px solid var(--color-gold)', paddingLeft: '8px' }}>
                  Property Requirements
                </h4>

                {/* Preferred Location - Dynamic Searchable Dropdown */}
                <div className="form-group">
                  <label className="form-label">Preferred Location <span>*</span></label>
                  <div className="custom-select-container" ref={dropdownRefBuy}>
                    <div 
                      className="form-control custom-select-header"
                      onClick={() => setBuyLocationOpen(!buyLocationOpen)}
                    >
                      <span style={{ color: buyLocation ? 'var(--color-white)' : 'var(--color-text-muted)' }}>
                        {buyLocation || 'Search & Select Location'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform var(--transition-fast)', transform: buyLocationOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                    {buyLocationOpen && (
                      <div className="custom-select-dropdown">
                        <div className="custom-select-search">
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            placeholder="Type to filter..."
                            value={buyLocationSearch}
                            onChange={(e) => setBuyLocationSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        {filteredBuyLocations.length > 0 ? (
                          filteredBuyLocations.map(loc => (
                            <div 
                              key={loc._id || loc.id} 
                              className={`custom-select-option ${buyLocation === loc.name ? 'selected' : ''}`}
                              onClick={() => {
                                setBuyLocation(loc.name);
                                setBuyLocationOpen(false);
                                setBuyLocationSearch('');
                              }}
                            >
                              {loc.name}
                            </div>
                          ))
                        ) : (
                          <div 
                            className="custom-select-option"
                            onClick={() => {
                              setBuyLocation('Other');
                              setBuyLocationOpen(false);
                              setBuyLocationSearch('');
                            }}
                          >
                            Other (Add manual note below)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.buyLocation && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.buyLocation}</span>}
                </div>

                {/* Property Type Dropdown */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Property Type <span>*</span></label>
                    <select 
                      className="form-control"
                      value={buyPropertyType}
                      onChange={(e) => setBuyPropertyType(e.target.value)}
                    >
                      {propertyTypes.map(pt => (
                        <option key={pt._id || pt.id} value={pt.name} style={{ background: '#000' }}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {buyPropertyType === 'Others' && (
                    <div className="form-group" style={{ animation: 'slideDown var(--transition-fast)' }}>
                      <label className="form-label">Specify Property Type <span>*</span></label>
                      <input 
                        type="text"
                        className="form-control"
                        placeholder="E.g. Penthouse, Studio"
                        value={buyOtherPropertyType}
                        onChange={(e) => setBuyOtherPropertyType(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {/* BHK Requirement */}
                  <div className="form-group">
                    <label className="form-label">BHK Requirement</label>
                    <select 
                      className="form-control"
                      value={buyBhk}
                      onChange={(e) => setBuyBhk(e.target.value)}
                    >
                      <option value="1 BHK" style={{ background: '#000' }}>1 BHK</option>
                      <option value="2 BHK" style={{ background: '#000' }}>2 BHK</option>
                      <option value="3 BHK" style={{ background: '#000' }}>3 BHK</option>
                      <option value="4 BHK+" style={{ background: '#000' }}>4 BHK+</option>
                      <option value="Not Applicable" style={{ background: '#000' }}>Not Applicable</option>
                    </select>
                  </div>
                </div>

                {/* Budget Fields */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Minimum Budget (INR)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gold)' }}>₹</span>
                      <input 
                        type="number" 
                        className={`form-control ${errors.buyMinBudget ? 'is-invalid' : ''}`}
                        style={{ paddingLeft: '28px' }}
                        value={buyMinBudget}
                        onChange={(e) => setBuyMinBudget(e.target.value)}
                        placeholder="E.g. 50,000,00"
                      />
                    </div>
                    {errors.buyMinBudget && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.buyMinBudget}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maximum Budget (INR)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gold)' }}>₹</span>
                      <input 
                        type="number" 
                        className="form-control"
                        style={{ paddingLeft: '28px' }}
                        value={buyMaxBudget}
                        onChange={(e) => setBuyMaxBudget(e.target.value)}
                        placeholder="E.g. 100,000,00"
                      />
                    </div>
                  </div>
                </div>

                {/* Loan & Timeline Grid */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Loan Required?</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="loanRequired" 
                          value="Yes"
                          checked={buyLoan === 'Yes'}
                          onChange={() => setBuyLoan('Yes')}
                          style={{ accentColor: 'var(--color-gold-bright)' }}
                        /> Yes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="loanRequired" 
                          value="No"
                          checked={buyLoan === 'No'}
                          onChange={() => setBuyLoan('No')}
                          style={{ accentColor: 'var(--color-gold-bright)' }}
                        /> No
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ready To Move?</label>
                    <select 
                      className="form-control"
                      value={buyReady}
                      onChange={(e) => setBuyReady(e.target.value)}
                    >
                      <option value="Ready" style={{ background: '#000' }}>Ready</option>
                      <option value="Under Construction" style={{ background: '#000' }}>Under Construction</option>
                      <option value="Doesn't Matter" style={{ background: '#000' }}>Doesn't Matter</option>
                    </select>
                  </div>
                </div>

                {/* Additional Requirements */}
                <div className="form-group">
                  <label className="form-label">Additional Requirements</label>
                  <textarea 
                    className="form-control"
                    value={buyRequirements}
                    onChange={(e) => setBuyRequirements(e.target.value)}
                    placeholder="Examples: East facing, Gated Community, Near Metro Station, Corner Plot..."
                  ></textarea>
                </div>
              </div>
            )}

            {/* SECTION: SELL PROPERTY FORM DETAILS */}
            {leadType === 'sell' && (
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold-bright)', marginBottom: '1.25rem', borderLeft: '2px solid var(--color-gold)', paddingLeft: '8px' }}>
                  Property Listing Details
                </h4>

                {/* Searchable dropdown for sell location */}
                <div className="form-group">
                  <label className="form-label">Property Location <span>*</span></label>
                  <div className="custom-select-container" ref={dropdownRefSell}>
                    <div 
                      className="form-control custom-select-header"
                      onClick={() => setSellLocationOpen(!sellLocationOpen)}
                    >
                      <span style={{ color: sellLocation ? 'var(--color-white)' : 'var(--color-text-muted)' }}>
                        {sellLocation || 'Search & Select Location'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform var(--transition-fast)', transform: sellLocationOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                    {sellLocationOpen && (
                      <div className="custom-select-dropdown">
                        <div className="custom-select-search">
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            placeholder="Type to filter..."
                            value={sellLocationSearch}
                            onChange={(e) => setSellLocationSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        {filteredSellLocations.length > 0 ? (
                          filteredSellLocations.map(loc => (
                            <div 
                              key={loc._id || loc.id} 
                              className={`custom-select-option ${sellLocation === loc.name ? 'selected' : ''}`}
                              onClick={() => {
                                setSellLocation(loc.name);
                                setSellLocationOpen(false);
                                setSellLocationSearch('');
                              }}
                            >
                              {loc.name}
                            </div>
                          ))
                        ) : (
                          <div 
                            className="custom-select-option"
                            onClick={() => {
                              setSellLocation('Other');
                              setSellLocationOpen(false);
                              setSellLocationSearch('');
                            }}
                          >
                            Other (Add manual details below)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.sellLocation && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.sellLocation}</span>}
                </div>

                {/* Property type dropdown */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Property Type <span>*</span></label>
                    <select 
                      className="form-control"
                      value={sellPropertyType}
                      onChange={(e) => setSellPropertyType(e.target.value)}
                    >
                      {propertyTypes.map(pt => (
                        <option key={pt._id || pt.id} value={pt.name} style={{ background: '#000' }}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {sellPropertyType === 'Others' && (
                    <div className="form-group" style={{ animation: 'slideDown var(--transition-fast)' }}>
                      <label className="form-label">Specify Property Type <span>*</span></label>
                      <input 
                        type="text"
                        className="form-control"
                        placeholder="E.g. Commercial space, Penthouse"
                        value={sellOtherPropertyType}
                        onChange={(e) => setSellOtherPropertyType(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {/* Construction Type */}
                  <div className="form-group">
                    <label className="form-label">Construction Type</label>
                    <select 
                      className="form-control"
                      value={sellConstructionType}
                      onChange={(e) => setSellConstructionType(e.target.value)}
                    >
                      <option value="" style={{ background: '#000' }}>-- Select Construction --</option>
                      <option value="Plot" style={{ background: '#000' }}>Plot</option>
                      <option value="Independent House" style={{ background: '#000' }}>Independent House</option>
                      <option value="Duplex" style={{ background: '#000' }}>Duplex</option>
                      <option value="Apartment" style={{ background: '#000' }}>Apartment</option>
                      <option value="1 BHK" style={{ background: '#000' }}>1 BHK</option>
                      <option value="2 BHK" style={{ background: '#000' }}>2 BHK</option>
                      <option value="3 BHK" style={{ background: '#000' }}>3 BHK</option>
                      <option value="4 BHK+" style={{ background: '#000' }}>4 BHK+</option>
                      <option value="Commercial Building" style={{ background: '#000' }}>Commercial Building</option>
                    </select>
                  </div>
                </div>

                {/* Property size and Facing */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Property Size</label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="E.g. 1200 Sq.ft or 150 Sq.Yards"
                      value={sellSize}
                      onChange={(e) => setSellSize(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Facing</label>
                    <select 
                      className="form-control"
                      value={sellFacing}
                      onChange={(e) => setSellFacing(e.target.value)}
                    >
                      <option value="East" style={{ background: '#000' }}>East</option>
                      <option value="West" style={{ background: '#000' }}>West</option>
                      <option value="North" style={{ background: '#000' }}>North</option>
                      <option value="South" style={{ background: '#000' }}>South</option>
                      <option value="North-East" style={{ background: '#000' }}>North-East</option>
                      <option value="North-West" style={{ background: '#000' }}>North-West</option>
                      <option value="South-East" style={{ background: '#000' }}>South-East</option>
                      <option value="South-West" style={{ background: '#000' }}>South-West</option>
                    </select>
                  </div>
                </div>

                {/* Property age and Expected selling price */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Property Age</label>
                    <select 
                      className="form-control"
                      value={sellAge}
                      onChange={(e) => setSellAge(e.target.value)}
                    >
                      <option value="New" style={{ background: '#000' }}>New</option>
                      <option value="1-5 Years" style={{ background: '#000' }}>1-5 Years</option>
                      <option value="5-10 Years" style={{ background: '#000' }}>5-10 Years</option>
                      <option value="10+ Years" style={{ background: '#000' }}>10+ Years</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expected Price (INR)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gold)' }}>₹</span>
                      <input 
                        type="number" 
                        className={`form-control ${errors.sellExpectedPrice ? 'is-invalid' : ''}`}
                        style={{ paddingLeft: '28px' }}
                        placeholder="Price in INR"
                        value={sellExpectedPrice}
                        onChange={(e) => setSellExpectedPrice(e.target.value)}
                      />
                    </div>
                    {errors.sellExpectedPrice && <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{errors.sellExpectedPrice}</span>}
                  </div>
                </div>

                {/* Image Uploads */}
                <div className="form-group">
                  <label className="form-label">Upload Property Images (Max 10)</label>
                  <input 
                    type="file" 
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="form-control"
                    style={{ padding: '0.5rem' }}
                  />
                  
                  {/* Image previews list */}
                  {sellPreviews.length > 0 && (
                    <div className="image-previews-container">
                      {sellPreviews.map(preview => (
                        <div key={preview.id} className="image-preview-wrapper">
                          <img src={preview.url} className="image-preview-img" alt="Property Preview" />
                          <button 
                            type="button" 
                            className="image-preview-remove"
                            onClick={() => removeImage(preview.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Information */}
                <div className="form-group">
                  <label className="form-label">Additional Information</label>
                  <textarea 
                    className="form-control"
                    value={sellAdditionalInfo}
                    onChange={(e) => setSellAdditionalInfo(e.target.value)}
                    placeholder="Describe extra specs: gated township, near high street, high rental yield, immediate registration..."
                  ></textarea>
                </div>
              </div>
            )}

            {/* Form Action Submitter */}
            <div style={{ marginTop: '2.5rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', letterSpacing: '0.1em' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting Inquiry...' : 'Submit Property Requirements'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
