import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { supabase, supabaseClient } from '../utils/supabaseClient';

export default function AdminLogin({ onLoginSuccess, onCancel, apiBaseUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 = request code, 2 = enter code & reset

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (supabaseClient.isEnabled) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username.trim(),
          password
        });
        
        if (error) {
          throw new Error(error.message || 'Invalid email or password.');
        }

        setSuccessMsg('Authentication successful. Directing to CRM...');
        
        setTimeout(() => {
          onLoginSuccess(data.session.access_token, data.user);
        }, 1000);
      } else {
        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Login failed. Invalid credentials.');
        }

        setSuccessMsg('Authentication successful. Directing to CRM...');
        
        setTimeout(() => {
          onLoginSuccess(data.token, data.user);
        }, 1000);
      }

    } catch (err) {
      setErrorMsg(err.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    if (!forgotUsername) {
      setErrorMsg('Please specify your username.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not initiate reset.');
      }

      setSuccessMsg(`Simulated Email Alert! Reset Code: ${data.simulatedCode}`);
      setForgotStep(2);

    } catch (err) {
      setErrorMsg(err.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotUsername || !recoveryCode || !newPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername.trim(),
          code: recoveryCode.trim(),
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }

      setSuccessMsg(data.message || 'Password updated successfully!');
      
      setTimeout(() => {
        setIsForgotMode(false);
        setForgotStep(1);
        setUsername(forgotUsername);
        setPassword('');
        setErrorMsg('');
        setSuccessMsg('');
      }, 2000);

    } catch (err) {
      setErrorMsg(err.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '6rem auto 0 auto', padding: '0 1rem' }}>
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
        
        {/* Branding header */}
        <div className="branding-header" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logo} className="mrv-logo" style={{ width: '100%', height: '100%', objectFit: 'contain', animation: 'none' }} alt="MRV Logo" />
          </div>
          <h2 className="text-gold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-logo)', margin: 0 }}>MRV CRM Access</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Authorized Personnel Gateway
          </p>
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'var(--color-error-glow)', 
            border: '1px solid var(--color-error)', 
            color: '#fca5a5', 
            padding: '0.65rem', 
            borderRadius: 'var(--border-radius-sm)', 
            marginBottom: '1.25rem', 
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            Error: {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.12)', 
            border: '1px solid var(--color-success)', 
            color: '#a7f3d0', 
            padding: '0.65rem', 
            borderRadius: 'var(--border-radius-sm)', 
            marginBottom: '1.25rem', 
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            Success: {successMsg}
          </div>
        )}

        {/* LOGIN FORM MODE */}
        {!isForgotMode ? (
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div className="form-group">
              <label className="form-label">Username / Email</label>
              <input 
                type="text" 
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter email / username"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {/* Forgot password trigger */}
            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <button 
                type="button" 
                style={{ background: 'transparent', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={() => {
                  setIsForgotMode(true);
                  setForgotStep(1);
                  setForgotUsername(username);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          
          /* PASSWORD RECOVERY FORM MODE */
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-white)' }}>
              Password Reset Utility
            </h3>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestRecovery}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  Enter your admin username to request a simulated recovery reset code.
                </p>
                
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="E.g. admin"
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setIsForgotMode(false)}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    Get Reset Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  Enter code <strong>MRV-RESET-999</strong> and your new password below.
                </p>

                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Enter reset code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    className="form-control"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setForgotStep(1)}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    Reset Password
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
