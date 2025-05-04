import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../api/apiService';
import './AuthSuccessPage.css';

function AuthSuccessPage() {
  const navigate = useNavigate();
  const { checkAuthStatus, isAuthenticated, loading } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [message, setMessage] = useState('正在驗證您的身份...');
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState({});

  // 初次加載時獲取調試信息
  useEffect(() => {
    // 檢查是否有調試 cookie
    const hasDebugCookie = document.cookie.includes('auth_debug=true');
    
    // 獲取各種狀態信息
    setDebugInfo({
      cookies: document.cookie,
      hasDebugCookie,
      url: window.location.href,
      time: new Date().toISOString(),
    });
  }, []);

  // 嘗試驗證
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        // 首先直接調用 status API 以檢查會話狀態
        const statusResponse = await apiService.get('/api/auth/status', { 
          withCredentials: true,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        
        console.log('Auth status direct check:', statusResponse.data);
        
        if (statusResponse.data.isAuthenticated) {
          // 如果直接檢查顯示已認證，通過 context 重新驗證
          await checkAuthStatus(true);
          setCheckingStatus(false);
        } else {
          // 如果未認證且重試次數小於最大值，則等待並重試
          if (retryCount < 3) {
            const nextRetry = retryCount + 1;
            setMessage(`認證檢查中，重試 ${nextRetry}/3...`);
            setRetryCount(nextRetry);
            // 增加重試延遲時間
            setTimeout(() => checkAuthStatus(true), 1500 + (nextRetry * 500));
          } else {
            setMessage('無法驗證您的身份。');
            setCheckingStatus(false);
          }
        }
      } catch (error) {
        console.error('Error verifying authentication status:', error);
        setMessage('驗證身份時發生錯誤。');
        setCheckingStatus(false);
      }
    };

    verifyAuth();
  }, [checkAuthStatus, retryCount]);

  // 處理認證後的導航
  useEffect(() => {
    // 僅在完成驗證檢查後處理
    if (!checkingStatus && !loading) {
      if (isAuthenticated) {
        setMessage('認證成功！正在重定向到儀表板...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setMessage('認證失敗。正在重定向到登錄頁面...');
        setTimeout(() => navigate('/login'), 2000);
      }
    }
  }, [isAuthenticated, loading, navigate, checkingStatus]);

  return (
    <div className="auth-success-container">
      <div className="auth-success-card">
        <img 
          src="https://images.seeklogo.com/logo-png/25/1/mlb-logo-png_seeklogo-250501.png" 
          alt="MLB Logo" 
          className="auth-success-logo"
        />
        <h1>Yahoo Fantasy Baseball</h1>
        <div className="auth-success-message">{message}</div>
        {isAuthenticated && !loading && !checkingStatus && (
          <div className="auth-success-info">
            ✅ 成功認證
          </div>
        )}
        
        {/* 添加調試信息區域 */}
        <div className="auth-success-debug">
          <details>
            <summary>調試信息</summary>
            <pre>{JSON.stringify({
              isAuthenticated,
              loading,
              checkingStatus,
              retryCount,
              ...debugInfo
            }, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}

export default AuthSuccessPage;