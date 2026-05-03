/**
 * @fileoverview AI Service using Google Gemini
 * @description Handles interaction with the Gemini API to provide interactive election information.
 */

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { logToBigQuery, logTelemetry } = require('./cloudIntegration');

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');

// Define typed response schema for strict JSON output
const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        timeline: {
            type: SchemaType.ARRAY,
            description: "Interactive Electoral Journey Map steps (Registration -> Verification -> Polling Day).",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    step: { type: SchemaType.STRING },
                    title: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    date: { type: SchemaType.STRING }
                },
                required: ["step", "title", "description", "date"]
            }
        },
        answer: {
            type: SchemaType.STRING,
            description: "Direct answer to the user's query."
        },
        quiz: {
            type: SchemaType.OBJECT,
            description: "Gamified Knowledge Check based on the current topic.",
            properties: {
                question: { type: SchemaType.STRING },
                options: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                answer: { type: SchemaType.STRING }
            },
            required: ["question", "options", "answer"]
        }
    },
    required: ["timeline", "answer"]
};

/**
 * @description Processes an election query and returns structured JSON from Gemini.
 * @param {string} query - The user's message.
 * @param {Object} context - User context (language, state, age).
 * @returns {Promise<Object>} The structured JSON response from Gemini.
 */
const processElectionQuery = async (query, context = {}) => {
  try {
    logTelemetry('election-assistant', `Processing query: ${query.substring(0, 50)}...`);
    await logToBigQuery(query, context);

    // Mock response if no API key is set for immediate testing
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
       return {
           timeline: [
               { step: "1", title: "Registration", description: "Register to vote online or locally.", date: "TBD" },
               { step: "2", title: "Verification", description: "Check your voter status.", date: "TBD" },
               { step: "3", title: "Polling Day", description: "Cast your vote.", date: "Election Day" }
           ],
           answer: "This is a mock response. Please provide a GEMINI_API_KEY in the .env file.",
           quiz: {
               question: "What is the minimum voting age in most democracies?",
               options: ["16", "18", "21", "25"],
               answer: "18"
           }
       };
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    const systemInstruction = `
      You are an expert Election Process Assistant. Create an assistant that helps users understand the election process, timelines, and steps in an interactive and easy-to-follow way.
      You MUST breakdown the "election process, timelines, and steps" into interactive JSON chunks that strictly adhere to the schema.
      Include a "Quick Quiz" in your response to test the user's electoral knowledge.
      Context: State=${context.state || 'Generic'}, Age=${context.age || 'Unknown'}, Language=${context.language || 'English'}.
      Respond entirely in the requested language.
    `;

    const prompt = `${systemInstruction}\n\nUser Query: ${query}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);

  } catch (error) {
    logTelemetry('election-assistant-error', error.message);
    throw error;
  }
};

module.exports = {
  processElectionQuery
};
