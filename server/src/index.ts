import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import { db } from './db/index.js';
import { loadUser } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import groupsRoutes from './routes/groups.js';
import projectsRoutes from './routes/projects.js';
import documentsRoutes from './routes/documents.js';
import credentialsRoutes from './routes/credentials.js';
import filesRoutes from './routes/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Load user data for authenticated requests
app.use(loadUser);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/files', filesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (config.nodeEnv === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message
  });
});

// Initialize database and start server
async function start() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Storage type: ${config.storageType}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
