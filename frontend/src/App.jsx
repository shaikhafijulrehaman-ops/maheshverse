import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LandingForm from './components/LandingForm';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { supabase, supabaseClient } from './utils/supabaseClient';

const API_BASE_URL = 'http://localhost:5050';

function AppContent() {
  const [token, setToken] = useState(localStorage.getItem('mrv_admin_token') || null);
  const [user, setUser] = useState(null);
  const [isValidating, setIsValidating] = useState(!!token);
  const navigate = useNavigate();
  const location = useLocation();

  // Validate session token on mount/change
  useEffect(() => {
    if (supabaseClient.isEnabled) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setToken(session.access_token);
          localStorage.setItem('mrv_admin_token', session.access_token);
          setUser(session.user);
        } else {
          setToken(null);
          localStorage.removeItem('mrv_admin_token');
          setUser(null);
        }
        setIsValidating(false);
      });
      return () => subscription.unsubscribe();
    } else {
      if (token) {
        validateSession(token);
      } else {
        setIsValidating(false);
      }
    }
  }, [token]);

  const validateSession = async (currToken) => {
    try {
      if (supabaseClient.isEnabled) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          handleLogout();
        } else {
          setUser(session.user);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${currToken}`
          }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          handleLogout();
        }
      }
    } catch (err) {
      console.warn('Session verification failed:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleLoginSuccess = (newToken, loggedUser) => {
    localStorage.setItem('mrv_admin_token', newToken);
    setToken(newToken);
    setUser(loggedUser);
    navigate('/admin/dashboard');
  };

  const handleLogout = async () => {
    if (supabaseClient.isEnabled) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('mrv_admin_token');
    setToken(null);
    setUser(null);
    navigate('/admin/login');
  };

  if (isValidating) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-black-bg)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Check if we are in admin area
  const isAdminArea = location.pathname.startsWith('/admin');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingForm apiBaseUrl={API_BASE_URL} />} />
          
          <Route 
            path="/admin" 
            element={token ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} 
          />
          
          <Route 
            path="/admin/login" 
            element={
              token ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <AdminLogin 
                  apiBaseUrl={API_BASE_URL} 
                  onLoginSuccess={handleLoginSuccess}
                  onCancel={() => navigate('/')}
                />
              )
            } 
          />
          
          <Route 
            path="/admin/dashboard" 
            element={
              token ? (
                <AdminDashboard 
                  token={token} 
                  apiBaseUrl={API_BASE_URL} 
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/admin/login" replace />
              )
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* DISCRETE FOOTER */}
      {!isAdminArea && (
        <footer style={{ 
          padding: '2rem 1rem', 
          textAlign: 'center', 
          fontSize: '0.8rem', 
          color: 'var(--color-text-muted)',
          borderTop: '1px solid rgba(197, 168, 128, 0.05)',
          background: 'rgba(0,0,0,0.2)',
          marginTop: '4rem'
        }}>
          <p>© {new Date().getFullYear()} Mahesh Realty Verse (MRV). All Rights Reserved.</p>
        </footer>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
