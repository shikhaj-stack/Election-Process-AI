/**
 * @fileoverview Election API routes
 * @description Defines the endpoints for the election assistant features.
 */

const express = require('express');
const { handleQuery } = require('../controllers/electionController');

const router = express.Router();

/**
 * @route POST /api/v1/election/query
 * @description Process user queries regarding the election process.
 * @access Public
 */
router.post('/query', handleQuery);

module.exports = router;
