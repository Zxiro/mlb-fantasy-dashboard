const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL,
      changeOrigin: true,
      secure: process.env.NODE_ENV === 'production',
      withCredentials: true,
      cookieDomainRewrite:'localhost',
      onProxyRes: function(proxyRes, req, res) {
        // 打印代理響應狀態，有助於調試
        console.log(`Proxy response: ${req.method} ${req.url} => ${proxyRes.statusCode}`);
      }
    })
  );
};