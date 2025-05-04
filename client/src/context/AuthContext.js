import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import apiService from '../api/apiService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  // User state might just be a boolean or hold minimal info like GUID if fetched
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(0); // Track when auth was last checked
  const [retryCount, setRetryCount] = useState(0); // Track retry attempts

  // Function to check authentication status using the new /status endpoint
  const checkAuthStatus = useCallback(async (forceCheck = false) => {
    // Only check if we haven't checked recently (within 2 seconds) unless forced
    const now = Date.now();
    if (!forceCheck && now - lastChecked < 2000) {
      console.log('Auth check skipped - checked recently');
      return; // Skip checking if checked recently and not forced
    }
    
    setLoading(true);
    try {
      console.log('Checking auth status, force=', forceCheck);
      
      // Use the new /api/auth/status endpoint
      const response = await apiService.get('/api/auth/status', {
        // 確保發送 credentials
        withCredentials: true,
        headers: {
          // 添加一個緩存破壞參數，以確保不會從緩存中獲取
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('Auth status response:', response.data);
      setIsAuthenticated(response.data.isAuthenticated);
      setLastChecked(now); // Update last checked timestamp
      setRetryCount(0); // Reset retry counter on successful check
      
      // If authenticated, fetch minimal user data
      if (response.data.isAuthenticated) {
        try {
          const userResponse = await apiService.get('/api/auth/user');
          setUser({
            displayName: 'Yahoo Fantasy User',
            yahooId: 'Yahoo User',
            isAuthenticated: true
          });
        } catch (userError) {
          console.error('Error fetching user details:', userError);
          // Still set a minimal user object so the dashboard can render
          setUser({ displayName: 'Yahoo User', isAuthenticated: true });
        }
      } else {
        // 如果在驗證頁面且不是強制檢查，嘗試重試幾次（伺服器可能需要時間保存會話）
        const isAuthSuccessPage = window.location.pathname.includes('/auth-success');
        if (isAuthSuccessPage && !forceCheck && retryCount < 3) {
          console.log(`Auth check failed on auth-success page. Retry attempt ${retryCount + 1}/3 in 1.5 seconds`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => checkAuthStatus(true), 1500); // 重試，強制檢查
        }
        
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error.response ? error.response.data : error.message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [lastChecked, retryCount]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Logout function
  const logout = async () => {
    try {
      // Call the backend logout endpoint
      await apiService.get('/api/auth/logout');
      setIsAuthenticated(false);
      setUser(null);
      // Redirect to login page after logout - handled by frontend routing
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error.response ? error.response.data : error.message);
      // Still attempt to clear local state and redirect
      setIsAuthenticated(false);
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
