const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load env vars
dotenv.config();

const app = express();

app.use(cors({
  origin: "https://mlb-fantasy-dashboard.vercel.app",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['set-cookie']
}));

// 在生產環境中信任代理
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Sessions Middleware with enhanced configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mlb-fantasy-secret', // Use an environment variable for secret
    resave: false,
    saveUninitialized: false,
    name: 'mlb.fantasy.sid',
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Only use secure in production
      maxAge: 1000 * 60 * 60 * 24 * 7, // Session expires in 7 days
      sameSite: 'none', // Important: use 'none' not 'lax' to allow cross-domain cookies
      httpOnly: true // Prevent client-side JavaScript from accessing cookies
    }
  })
);

// Request inspection middleware
app.use((req, res, next) => {
  // Output Origin and Cookie fields for debugging cross-domain issues
  console.log('Request Origin:', req.get('Origin'));
  console.log('Request Cookies:', req.headers.cookie);
  console.log('Request Method:', req.method);
  
  // Add cross-domain cookie header (as backup, should be handled by cors middleware)
  res.header('Access-Control-Allow-Credentials', 'true');
  
  next();
});

// Init Middleware
app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true })); // For form data if needed
app.use(cookieParser()); // For parsing cookies

// Session debugging middleware
app.use((req, res, next) => {
  if (req.headers.cookie?.includes('auth_debug=true')) {
    console.log(`DEBUG: Session middleware - request path: ${req.path}`);
    console.log(`DEBUG: Session ID: ${req.sessionID}`);
    console.log(`DEBUG: Has session: ${!!req.session}`);
    console.log(`DEBUG: Has tokens: ${!!(req.session && req.session.yahooTokens)}`);
  }
  
  // Add response tracking
  const originalSend = res.send;
  res.send = function() {
    if (req.headers.cookie?.includes('auth_debug=true')) {
      console.log('DEBUG: Response sending - Session:', {
        id: req.sessionID,
        hasTokens: req.session && req.session.yahooTokens ? true : false,
        path: req.path
      });
    }
    return originalSend.apply(res, arguments);
  };
  
  next();
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));

// Add debug middleware for leagues route
app.use('/api/leagues', (req, res, next) => {
  console.log('DEBUG: Leagues route accessed:', {
    method: req.method,
    path: req.path,
    hasSession: !!req.session,
    hasYahooTokens: !!(req.session && req.session.yahooTokens),
  });
  next();
});

app.use('/api/leagues', require('./routes/leagues')); // Re-enabled leagues route
app.use('/api/teams', require('./routes/teams')); // Re-enabled teams route
// app.use('/api/reports', require('./routes/reports'));

// Add health check endpoint for Railway deployment
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve static assets in production ONLY if we're not in SERVER_ONLY mode
// SERVER_ONLY is set in railway.json for the backend-only deployment
if (process.env.NODE_ENV === 'production' && process.env.SERVER_ONLY !== 'true') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
} else {
  // For development or SERVER_ONLY mode, don't try to serve static files
  app.get('/', (req, res) => {
    if (process.env.SERVER_ONLY === 'true') {
      res.send('API Running (Server-Only Production Mode)');
    } else {
      res.send('API Running (Development Mode)');
    }
  });
}

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
