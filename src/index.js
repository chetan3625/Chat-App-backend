require('dotenv').config();

const cors = require('cors');
const express = require('express');
const http = require('http');
const path = require('path');

const connectDB = require('./config/db');
const setupSocket = require('./socket');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');

async function start() {
  await connectDB();

  const app = express();
  const server = http.createServer(app);

  setupSocket(server);

  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/messages', messageRoutes);

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
    });
  });

  const port = process.env.PORT || 4000;
  server.listen(port, () => {
    console.log(`Chetanu backend listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
