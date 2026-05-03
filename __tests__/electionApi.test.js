/**
 * @fileoverview Jest test suite for the Election API
 * @description Tests coverage for HTTP 200, 400, and 429 using Supertest and Jest.
 */

const request = require('supertest');
const app = require('../server');

describe('Election API Endpoints', () => {
  // Test valid query (HTTP 200)
  it('should return 200 and structured data for a valid query', async () => {
    const res = await request(app)
      .post('/api/v1/election/query')
      .send({
        message: 'How do I register to vote?',
        context: { state: 'California', age: 30, language: 'English' }
      });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('timeline');
    expect(res.body.data).toHaveProperty('answer');
  });

  // Test missing parameters (HTTP 400)
  it('should return 400 if message parameter is missing', async () => {
    const res = await request(app)
      .post('/api/v1/election/query')
      .send({
        context: { state: 'California' }
      });
      
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error', 'Message parameter is required');
  });

  // Test real Gemini API call if key is present
  it('should call gemini if api key is provided', async () => {
      process.env.GEMINI_API_KEY = "test-key";
      
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      // Mock the generateContent method
      const mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            timeline: [{ step: "1", title: "Test", description: "Test", date: "TBD" }],
            answer: "Test answer",
            quiz: { question: "Q", options: ["A"], answer: "A" }
          })
        }
      });

      // Mock getGenerativeModel
      jest.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: mockGenerateContent
      });

      const res = await request(app)
      .post('/api/v1/election/query')
      .send({
        message: 'How do I register to vote?',
        context: { state: 'California', age: 30, language: 'English' }
      });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(mockGenerateContent).toHaveBeenCalled();
      
      // Restore the mock
      jest.restoreAllMocks();
      process.env.GEMINI_API_KEY = "mock-key"; // Restore
  });
  
  it('should catch error from Gemini API', async () => {
      process.env.GEMINI_API_KEY = "test-key";
      
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      // Mock the generateContent method to throw
      const mockGenerateContent = jest.fn().mockRejectedValue(new Error("Gemini Error"));

      // Mock getGenerativeModel
      jest.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: mockGenerateContent
      });

      const res = await request(app)
      .post('/api/v1/election/query')
      .send({
        message: 'How do I register to vote?',
        context: { state: 'California', age: 30, language: 'English' }
      });
      
      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toEqual("Gemini Error");
      
      // Restore the mock
      jest.restoreAllMocks();
      process.env.GEMINI_API_KEY = "mock-key"; // Restore
  });

  // Mock Rate Limiter (HTTP 429) Coverage 
  // In a real isolated environment, we would inject a 1-limit rate limiter into app for this specific test
  // We test the real route
  it('should return 429 when rate limit is exceeded (Simulated)', async () => {
    // Send 101 requests since max is 100
    for (let i = 0; i < 100; i++) {
        await request(app)
        .post('/api/v1/election/query')
        .send({ message: 'Spam' });
    }

    const res = await request(app)
      .post('/api/v1/election/query')
      .send({ message: 'Spam' });
      
    expect(res.statusCode).toEqual(429);
  });
});
