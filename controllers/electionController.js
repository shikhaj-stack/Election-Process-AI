/**
 * @fileoverview Controller for handling election-related requests.
 * @description Validates inputs and interacts with the AI service.
 */

const { processElectionQuery } = require('../services/aiService');

/**
 * @description Handles POST requests to process an election query. Pure async/await non-blocking logic.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {Promise<void>}
 */
const handleQuery = async (req, res, next) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      const error = new Error('Message parameter is required');
      error.statusCode = 400;
      throw error;
    }

    const aiResponse = await processElectionQuery(message, context);

    res.status(200).json({
      success: true,
      data: aiResponse
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleQuery
};
