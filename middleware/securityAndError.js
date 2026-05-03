/**
 * @fileoverview Security and error handling middleware
 * @description Centralized error handler and rate limiter to prevent DDoS attacks and ensure stability.
 */

const rateLimit = require('express-rate-limit');

/**
 * @description Rate limiting to prevent brute-force and DDoS attacks.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * @description Centralized error handler for the application catching 400, 429, and 500 errors gracefully.
 * @param {Error} err - The error object.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
};

module.exports = {
  rateLimiter,
  errorHandler
};
