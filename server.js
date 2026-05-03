/**
 * @fileoverview Main orchestrator for VoteSmart Hub
 * @description Initializes the Express server, applies middleware, and sets up routes.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const path = require('path');
require('dotenv').config();

const { rateLimiter, errorHandler } = require('./middleware/securityAndError');
const electionRoutes = require('./routes/electionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: '*' })); // Strict origin policy should be applied in prod
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(xss());
app.use(rateLimiter);

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/v1/election', electionRoutes);

// Centralized Error Handling
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app; // Export for testing
