import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = localStorage.getItem('redirectAfterLogin') || '/';
      localStorage.removeItem('redirectAfterLogin');
      navigate(redirectPath);
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;

    if (isLoginMode) {
      result = await login(username, password);
    } else {
      // Registration mode
      if (password !== password2) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      result = await register({
        username,
        email,
        password,
        password2,
        first_name: firstName,
        last_name: lastName,
      });
    }

    if (result.success) {
      // Redirect to stored path or home
      const redirectPath = localStorage.getItem('redirectAfterLogin') || '/';
      localStorage.removeItem('redirectAfterLogin');
      navigate(redirectPath);
    } else {
      // Handle error messages from backend
      if (typeof result.error === 'object') {
        // Multiple field errors
        const errorMessages = Object.entries(result.error)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        setError(errorMessages);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    // Clear form fields when switching modes
    setUsername('');
    setPassword('');
    setPassword2('');
    setEmail('');
    setFirstName('');
    setLastName('');
  };

  return (
    <div className="login-container theme-dark">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Welcome to SANBox</h1>
          <p className="login-subtitle">Enterprise Storage Scripting Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          {!isLoginMode && (
            <>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-row">
                <div className="form-group form-group-half">
                  <label htmlFor="firstName" className="form-label">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    className="login-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    disabled={loading}
                  />
                </div>

                <div className="form-group form-group-half">
                  <label htmlFor="lastName" className="form-label">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    className="login-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="password2" className="form-label">
                Confirm Password
              </label>
              <input
                type="password"
                id="password2"
                className="login-input"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? (isLoginMode ? 'Signing in...' : 'Creating account...')
              : (isLoginMode ? 'Sign In' : 'Create Account')}
          </button>

          <div className="login-toggle">
            <button
              type="button"
              className="login-toggle-button"
              onClick={toggleMode}
              disabled={loading}
            >
              {isLoginMode
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">
            Evolving Solutions © 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
