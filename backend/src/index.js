import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import app from './app.js';
import { connectDB } from './db/index.js';
import { initializeSocket } from './socket/index.js';
import { startSOSWorker } from './workers/sosWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

const startServer = async () => {
  try {
    await connectDB();
    initializeSocket(httpServer);
    startSOSWorker();
    httpServer.listen(PORT, () => {
      console.log(`RakshaSetu server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
