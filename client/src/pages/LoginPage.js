import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LoginPage.css';

function LoginPage() {
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');
  const [yahooAuthUrl, setYahooAuthUrl] = useState('#'); // Store the URL in state
  const location = useLocation();
  const navigate = useNavigate();
  const processedUrlErrorCodeRef = useRef(null);
  const hasSetUrlRef = useRef(false); // Track if we've set the Yahoo URL already

  // Initialize Yahoo Auth URL on component mount
  useEffect(() => {
    if (!hasSetUrlRef.current) {
      const clientId = process.env.REACT_APP_YAHOO_CLIENT_ID;
      console.log('DEBUG: Yahoo Client ID:', clientId); // Debug log for client ID
      if (!clientId) {
        setError('Yahoo Client ID is not configured in the frontend environment.');
        setYahooAuthUrl('#');
      } else {
        // Using oob (out-of-band) as redirect URI to match server configuration
        const redirectUri = 'oob';
        const responseType = 'code';
        const scope = 'fspt-r';
        setYahooAuthUrl(`https://api.login.yahoo.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`);
      }
      hasSetUrlRef.current = true;
    }
  }, []); // Empty dependency array - run once on mount

  // Handle URL error parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const errorCode = queryParams.get('error');

    // Only process if there is an error code AND it's different from the one we just processed
    if (errorCode && errorCode !== processedUrlErrorCodeRef.current) {
      processedUrlErrorCodeRef.current = errorCode;

      let errorMessage = '發生未知的驗證錯誤。';
      switch (errorCode) {
        case 'no_code':
          errorMessage = '缺少驗證碼。';
          break;
        case 'token_exchange_failed':
        case 'token_exchange_error':
          errorMessage = '無法用 Yahoo 交換授權碼為令牌。';
          break;
        case 'invalid_code':
        case 'invalid_grant':
          errorMessage = '提供的授權碼無效或已過期。';
          break;
        case 'redirect_uri_mismatch':
          errorMessage = '重定向URI不匹配。請確保在 Yahoo 開發者控制台中設置了 "oob" 作為重定向 URI。';
          break;
        case 'invalid_client':
          errorMessage = 'Yahoo API 憑證無效。請檢查您的 Client ID 和 Secret。';
          break;
        default:
          errorMessage = `驗證失敗：${errorCode}`;
      }
      
      setError(errorMessage);
      
      // Use setTimeout to break the potential render cycle
      // This schedules the navigation for the next tick after the render completes
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 0);
    } else if (!errorCode) {
      processedUrlErrorCodeRef.current = null;
    }
  }, [location.search, navigate]);

  const handleManualLogin = () => {
    if (!authCode.trim()) {
      setError('Please paste the Yahoo authorization code first.');
      return;
    }
    setError('');
    processedUrlErrorCodeRef.current = null;
    const callbackUrl = `${process.env.REACT_APP_API_URL}/api/auth/yahoo/callback?code=${encodeURIComponent(authCode.trim())}`;
    console.log('DEBUG: Redirecting to callback URL:', callbackUrl); // Debug log for callback URL
    window.location.href = callbackUrl;
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img 
          src="https://images.seeklogo.com/logo-png/25/1/mlb-logo-png_seeklogo-250501.png" 
          alt="MLB Logo" 
          className="login-logo" 
        />
        <h1 className="login-title">Fantasy Baseball Dashboard</h1>
        <p className="login-subtitle">Track and analyze your Yahoo Fantasy Baseball leagues</p>
      </div>

      {error && <div className="error-message">Error: {error}</div>}
      
      <div className="login-instructions">
        <h3>Authentication Required</h3>
        <p>To access your fantasy baseball data, you need to authorize with Yahoo Fantasy Sports:</p>
        <ol className="login-instruction-steps">
          <li>
            <a href={yahooAuthUrl} target="_blank" rel="noopener noreferrer" className="auth-link">
              Click here to get your Yahoo Authorization Code
            </a>
            <span> (opens in a new tab)</span>
          </li>
          <li>Log in to Yahoo if prompted</li>
          <li>Grant access to the application</li>
          <li>Yahoo will display an authorization code - copy that code</li>
          <li>Paste the code into the field below and click "Sign In"</li>
        </ol>
      </div>

      <div className="login-form">
        <input
          type="text"
          value={authCode}
          onChange={(e) => setAuthCode(e.target.value)}
          placeholder="Paste Yahoo Authorization Code Here"
          className="login-input"
          aria-label="Yahoo Authorization Code"
        />
        <button 
          onClick={handleManualLogin} 
          className="login-button"
          disabled={!authCode.trim()}
        >
          Sign In
        </button>
      </div>

      <div className="login-footer">
        <p>MLB Fantasy Dashboard &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

export default LoginPage;
