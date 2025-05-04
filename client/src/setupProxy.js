const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 代理 API 請求到後端服務器
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL,
      changeOrigin: true,
      secure: process.env.NODE_ENV === 'production',
      // 允許從 Railway 後端接收請求
      onProxyRes: function(proxyRes, req, res) {
        // 打印代理響應狀態，有助於調試
        console.log(`Proxy response: ${req.method} ${req.url} => ${proxyRes.statusCode}`);
      }
    })
  );
};