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
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  const [serverErrorMsg, setServerErrorMsg] = useState('');
  const [supabaseConnected, setSupabaseConnected] = useState(true);

  const dropdownRefBuy = useRef(null);
  const dropdownRefSell = useRef(null);

  // Fetch Locations & Properties and check Supabase connection dynamically
  useEffect(() => {
    fetchLocationsAndProperties();
    checkSupabaseConnection();
  }, []);

  const checkSupabaseConnection = async () => {
    if (supabaseClient.isEnabled) {
      const connected = await supabaseClient.isSupabaseConnected();
      setSupabaseConnected(connected);
    } else {
      setSupabaseConnected(false);
    }
  };

  // Intercept browser back button on success screen overlay
  useEffect(() => {
    const handlePopState = (event) => {
      if (submissionPhase === 'success') {
        resetForm();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [submissionPhase]);

  const handleBackToHome = () => {
    if (window.history.state && window.history.state.phase === 'success') {
      window.history.back(); // Pops state and triggers popstate listener
    } else {
      resetForm();
    }
  };

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

  // Compression helper
  const compressImageFile = (file) => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const maxWidth = 1200;
          const maxHeight = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressed = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressed);
            },
            'image/jpeg',
            0.75
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  // Handle Image uploads and previews
  const handleImageChange = async (e) => {
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

    // Compress in background
    const compressedFiles = await Promise.all(
      validFiles.map(file => compressImageFile(file))
    );

    const newImages = [...sellImages, ...compressedFiles];
    setSellImages(newImages);

    // Generate previews
    const newPreviews = compressedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file: file,
      url: URL.createObjectURL(file)
    }));
    setSellPreviews([...sellPreviews, ...newPreviews]);
  };

  const removeImage = (idToRemove) => {
    const index = sellPreviews.findIndex(p => p.id === idToRemove);
    if (index === -1) return;

    URL.revokeObjectURL(sellPreviews[index].url);

    const newPreviews = [...sellPreviews];
    newPreviews.splice(index, 1);
    setSellPreviews(newPreviews);

    const newImages = [...sellImages];
    newImages.splice(index, 1);
    setSellImages(newImages);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      sellPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [sellPreviews]);

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
    if (isSubmitting || submissionPhase === 'success') return; // Prevent duplicate submissions

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
      let leadSubmitted = false;
      let uploadedImages = [];

      if (supabaseClient.isEnabled) {
        try {
          // 1. Verify 2-hour deduplication
          const isDuplicate = await supabaseClient.checkDuplicateLead(phone, leadType);
          if (isDuplicate) {
            throw new Error('A request from this mobile number is already in progress. Our team will contact you within 24 hours.');
          }

          // 2. Upload images if "sell"
          if (leadType === 'sell' && sellImages.length > 0) {
            for (const file of sellImages) {
              try {
                const url = await supabaseClient.uploadImage(file);
                uploadedImages.push(url);
              } catch (uploadErr) {
                console.warn("Supabase image upload failed, falling back to local backend upload:", uploadErr);
                const localFormData = new FormData();
                sellImages.forEach(img => {
                  localFormData.append('images', img);
                });
                try {
                  const uploadRes = await fetch(`${apiBaseUrl}/api/leads/upload-images`, {
                    method: 'POST',
                    body: localFormData
                  });
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    uploadedImages = uploadData.urls;
                  } else {
                    console.error("Local image upload fallback failed");
                  }
                } catch (localErr) {
                  console.error("Local image upload connection failed:", localErr);
                }
                break;
              }
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
          try {
            await supabaseClient.createNotification(
              `New ${leadType.toUpperCase()} lead: ${name} (${phone}) - ${leadType === 'buy' ? buyLocation : sellLocation}`,
              'info'
            );
          } catch (nErr) {
            console.warn("Silent notification creation fail:", nErr);
          }

          leadSubmitted = true;
        } catch (supabaseError) {
          console.warn("Supabase submission failed, silently falling back to local backend:", supabaseError);
          // If it's a deduplication check error, rethrow it to show the user-friendly message
          if (supabaseError.message && supabaseError.message.includes('already in progress')) {
            throw supabaseError;
          }
        }
      }

      // Fallback submission if Supabase failed or is not enabled
      if (!leadSubmitted) {
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
        setSubmissionPhase('success');
        setShowSuccessCheck(false);
        // Push state to browser history to catch browser Back button
        window.history.pushState({ phase: 'success' }, '');

        // Transition from flipping logo to checkmark after 2.2 seconds
        setTimeout(() => {
          setShowSuccessCheck(true);
        }, 2200);
      }, 1000);

    } catch (err) {
      console.error(err);
      // Map technical errors to user-friendly messages
      let friendlyMessage = 'An error occurred while saving your request. Please try again.';
      if (err.message && err.message.includes('already in progress')) {
        friendlyMessage = err.message;
      }
      setServerErrorMsg(friendlyMessage);
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
    setShowSuccessCheck(false);
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

      <style>{`
        @keyframes logoZoomIn {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.55); }
          70% { transform: scale(1.42); }
          100% { transform: scale(1.5); opacity: 1; }
        }
        @keyframes logoFlip3D {
          0% { transform: scale(1.5) rotateY(0deg); }
          100% { transform: scale(1.5) rotateY(360deg); }
        }
        @keyframes checkmarkDraw {
          0% { stroke-dashoffset: 56; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOutDown {
          0% { opacity: 1; transform: translateY(0) scale(1.5); }
          100% { opacity: 0; transform: translateY(30px) scale(0.8); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.3), 0 0 40px rgba(34,197,94,0.15); }
          50% { box-shadow: 0 0 35px rgba(34,197,94,0.6), 0 0 70px rgba(34,197,94,0.3); }
        }
        @keyframes checkCircleGrow {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes overlayFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Dynamic Submit success screen overlay */}
      <div className={`submission-overlay ${submissionPhase !== 'idle' ? 'active' : ''}`}>
        <div className="overlay-content">

          {submissionPhase === 'loading' && (
            <>
              <div className="spinner"></div>
              <h3 style={{ fontFamily: 'var(--font-primary)', letterSpacing: '0.05em' }}>Validating Details...</h3>
            </>
          )}

          {submissionPhase === 'success' && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(10, 8, 6, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              animation: 'overlayFadeIn 0.4s ease-out',
              padding: '2rem',
              boxSizing: 'border-box'
            }}>
              {!showSuccessCheck ? (
                /* Logo container with zoom + flip + fadeout */
                <div style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, rgba(191,163,107,0.12) 0%, transparent 70%)',
                  animation: 'logoZoomIn 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards, logoFlip3D 1s ease-in-out 0.8s forwards, fadeOutDown 0.5s ease-in 1.8s forwards',
                  perspective: '800px',
                }}>
                  <img
                    src={logo}
                    alt="MRV Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '50%',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '480px',
                  gap: '1.5rem',
                  animation: 'overlayFadeIn 0.4s ease-out'
                }}>
                  {/* Checkmark circle - perfectly centered inside this flex column */}
                  <div style={{
                    animation: 'checkCircleGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      border: '3px solid rgba(34,197,94,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'glowPulse 2s ease-in-out infinite',
                      background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
                    }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" fill="none" />
                        <polyline
                          points="7 13 10 16 17 9"
                          stroke="#22c55e"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          style={{
                            strokeDasharray: 56,
                            strokeDashoffset: 56,
                            animation: 'checkmarkDraw 0.6s ease-out 0.3s forwards',
                          }}
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Text contents */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{
                      color: 'var(--color-gold, #bfa36b)',
                      fontSize: '2rem',
                      fontFamily: 'var(--font-logo, serif)',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      opacity: 0,
                      animation: 'fadeInUp 0.7s ease-out 0.5s forwards',
                    }}>Submission Successful</div>
                    
                    <div style={{
                      color: '#ffffff',
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      opacity: 0,
                      animation: 'fadeInUp 0.7s ease-out 0.7s forwards',
                    }}>Thank you for choosing Mahesh Realty Verse.</div>
                    
                    <div style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '0.95rem',
                      fontWeight: 400,
                      opacity: 0,
                      animation: 'fadeInUp 0.7s ease-out 0.9s forwards',
                    }}>Our team will contact you shortly.</div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      width: 'auto',
                      padding: '0.6rem 2rem',
                      fontSize: '0.9rem',
                      borderColor: 'var(--color-gold)',
                      color: 'var(--color-gold)',
                      marginTop: '1.5rem',
                      opacity: 0,
                      animation: 'fadeInUp 0.7s ease-out 1.1s forwards',
                      borderRadius: 'var(--border-radius-sm)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={handleBackToHome}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-gold)';
                      e.currentTarget.style.color = '#000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--color-gold)';
                    }}
                  >
                    Back to Home
                  </button>
                </div>
              )}
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
                <div className="selector-card-icon-wrapper" style={{ marginBottom: '1.25rem', color: 'var(--color-gold)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Clean minimal Search Home icon */}
                  <svg className="premium-gold-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <circle cx="12" cy="13" r="2.5" />
                    <path d="m14 15 2.5 2.5" />
                  </svg>
                </div>
                <div className="selector-card-title">Buy Property</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Explore luxury properties to invest or live</p>
              </div>

              <div 
                className="selector-card"
                onClick={() => setLeadType('sell')}
              >
                <div className="selector-card-icon-wrapper" style={{ marginBottom: '1.25rem', color: 'var(--color-gold)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Clean minimal Listing Document icon */}
                  <svg className="premium-gold-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8m6 4H8m2 4H8" />
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
