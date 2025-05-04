const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/authMiddleware'); // Keep for now, will update later
const authController = require('../controllers/authController'); // Keep for now, might need updates
const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// @route   GET /api/auth/yahoo/callback
// @desc    Yahoo OAuth2 callback URL - Manual Handling
// @access  Public
router.get('/yahoo/callback', async (req, res) => {
  console.log('DEBUG: Received /api/auth/yahoo/callback request.');
  console.log('DEBUG: Request cookies:', req.headers.cookie);
  console.log('DEBUG: Session ID:', req.sessionID);
  const { code } = req.query;

  if (!code) {
    console.warn('WARN: No authorization code found in query.');
    return res.redirect((process.env.FRONTEND_URL) + '/login?error=no_code');
  }

  try {
    console.log('DEBUG: Attempting to exchange code for tokens...');
    const tokenData = await yahooApiService.getInitialAuthorization(code);

    if (tokenData && tokenData.access_token && tokenData.refresh_token) {
      console.log('DEBUG: Tokens received successfully. Storing in session.');
      
      // 確保會話對象存在
      if (!req.session) {
        console.error('ERROR: Session object does not exist!');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_session`);
      }
      
      // 清除會話中可能存在的過期值
      delete req.session.yahooTokens;
      
      // 創建一個新的 yahooTokens 對象
      const tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenTimestamp: Date.now()
      };
      
      // 存儲令牌到會話中
      req.session.yahooTokens = tokens;
      
      // 設置額外的用戶信息
      req.session.user = { yahooGuid: tokenData.xoauth_yahoo_guid || 'unknown' };
      
      console.log('DEBUG: Session ID before save:', req.sessionID);
      console.log('DEBUG: Session cookie:', req.headers.cookie);
      
      // 在重定向之前強制保存會話
      return new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('ERROR: Failed to save session:', err);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_save_error`);
          }
          
          console.log('DEBUG: Session saved successfully with tokens.');
          console.log('DEBUG: Session data after save:', {
            id: req.sessionID,
            hasTokens: !!req.session.yahooTokens,
            user: req.session.user
          });
          
          // Set cookie flags for better cross-site compatibility
          res.cookie('connect.sid', req.sessionID, {
            maxAge: req.session.cookie.maxAge,
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/'
          });
          
          // 設置一個特殊的 cookie 標記認證狀態 (非安全方法，僅用於調試)
          res.cookie('auth_debug', 'true', {
            maxAge: 60000, // 1分鐘
            httpOnly: false,
            secure: true,
            sameSite: 'none'
          });
          
          // 重定向到認證成功頁面
          res.redirect(`${process.env.FRONTEND_URL}/auth-success`);
          resolve();
        });
      });
    } else {
      console.error('ERROR: Invalid token data received from Yahoo.', tokenData);
      return res.redirect((process.env.FRONTEND_URL ) + '/login?error=token_exchange_failed');
    }
  } catch (error) {
    console.error('ERROR: Failed to exchange authorization code:', error.message);
    // 改進錯誤處理 - 提供更具體的錯誤類型
    let errorQuery = 'token_exchange_error';
    
    if (error.message.includes('invalid_grant')) {
      errorQuery = 'invalid_code';
    } else if (error.message.includes('Redirect URI')) {
      errorQuery = 'redirect_uri_mismatch';
      console.error('CRITICAL ERROR: Redirect URI mismatch detected. Please verify that your Yahoo Developer Console has "oob" configured as the redirect URI.');
    } else if (error.message.includes('client_id')) {
      errorQuery = 'invalid_client';
      console.error('CRITICAL ERROR: Client ID/Secret issue detected. Please verify your Yahoo API credentials.');
    }
    
    return res.redirect((process.env.FRONTEND_URL ) + `/login?error=${errorQuery}`);
  }
});

// @route   GET /api/auth/status
// @desc    Check user authentication status based on session tokens
// @access  Public (or Private depending on needs)
router.get('/status', (req, res) => {
  console.log('DEBUG: Received /api/auth/status request. Session', req.session);
  console.log('DEBUG: Session ID:', req.sessionID);
  console.log('DEBUG: Cookies:', req.headers.cookie);
  console.log('DEBUG: Session Cookie Settings:', req.session.cookie);
  
  if (req.session.yahooTokens && req.session.yahooTokens.accessToken) {
    console.log('DEBUG: Session has valid tokens. User is authenticated.');
    res.json({ isAuthenticated: true });
  } else {
    console.log('DEBUG: No valid tokens in session. User is NOT authenticated.');
    console.log('DEBUG: Full session object:', JSON.stringify(req.session));
    res.json({ isAuthenticated: false });
  }
});


// @route   GET /api/auth/user
// @desc    Get authenticated user data (placeholder - might need adjustment)
// @access  Private
router.get('/user', ensureAuth, authController.getUser);

// @route   GET /api/auth/logout
// @desc    Log user out by destroying the session
// @access  Private (or Public if called after session check)
router.get('/logout', (req, res, next) => { // ensureAuth might be removed if called from frontend after status check
  console.log('DEBUG: Received /api/auth/logout request.');
  if (req.session) {
    req.session.destroy((err) => { // Destroy session data
      if (err) {
        console.error('ERROR: Failed to destroy the session during logout:', err);
        return res.status(500).json({ message: 'Failed to logout' }); // Send error response
      }
      console.log('DEBUG: Session destroyed successfully.');
      res.clearCookie('connect.sid'); // Clear the session cookie
      // Send success response instead of redirect, let frontend handle navigation
      res.status(200).json({ message: 'Logged out successfully' });
      // Or redirect if preferred:
      // res.redirect(process.env.FRONTEND_URL);
    });
  } else {
    // No session exists, arguably already logged out
    res.status(200).json({ message: 'No active session' });
  }
});

module.exports = router;
