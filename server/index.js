import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnection, initializeDatabase } from './config/database.js';
import cardRoutes from './routes/cards.js';
import authRoutes from './routes/auth.js';
import economyRoutes from './routes/economy.js';
import drawRoutes from './routes/draw.js';
import { UPLOADS_DIR } from './storage/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Locally-stored card images (S3 fallback driver)
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '365d', immutable: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/cards', cardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/draw', drawRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }
    
    // Initialize database tables
    await initializeDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start server if this file is run directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app; 