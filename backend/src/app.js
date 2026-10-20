import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import sosRoutes from './routes/sos.routes.js';
import resourceRoutes from './routes/resource.routes.js';
import adminRoutes from './routes/admin.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import routingRoutes from './routes/routing.routes.js';
import ambulanceRoutes from './routes/ambulance.routes.js';
import publicRoutes from './routes/public.routes.js';
import { globalApiRateLimiter } from './middlewares/rateLimiter.middleware.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Global API rate limiter (120 req/min per IP, skips /health)
app.use(globalApiRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', chatbotRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/public', publicRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'RakshaSetu API is running' }));

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`);
  res.status(statusCode).json({ success: false, message: err.message || 'Internal Server Error', errors: err.errors || [] });
});

export default app;
