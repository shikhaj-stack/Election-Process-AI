/**
 * @fileoverview AI Service using Google Gemini
 * @description Handles interaction with the Gemini API to provide interactive election information.
 */

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { logToBigQuery, logTelemetry } = require('./cloudIntegration');

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');

// Define typed response schema for strict JSON output, extended for new features
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
        action_items: {
            type: SchemaType.ARRAY,
            description: "1 or 2 highly urgent, specific action items the user needs to take right now based on their state and experience.",
            items: { type: SchemaType.STRING }
        },
        answer: {
            type: SchemaType.STRING,
            description: "Direct answer to the user's query, tailored to their Voting Experience and Top Issue."
        },
        quiz: {
            type: SchemaType.OBJECT,
            description: "Gamified Knowledge Check based on the current topic or their Top Issue.",
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
    required: ["timeline", "answer", "action_items"]
};

/**
 * @description Processes an election query and returns structured JSON from Gemini.
 * @param {string} query - The user's message.
 * @param {Object} context - User context (language, state, age, experience, issue).
 * @returns {Promise<Object>} The structured JSON response from Gemini.
 */
const processElectionQuery = async (query, context = {}) => {
  try {
    logTelemetry('election-assistant', `Processing query: ${query.substring(0, 50)}...`);
    await logToBigQuery(query, context);

    // Mock response if no API key is set for immediate testing
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key' || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
       return {
           timeline: [
               { step: "1", title: "Registration", description: "Register to vote online or locally.", date: "Oct 15" },
               { step: "2", title: "Verification", description: "Check your voter status.", date: "Oct 30" },
               { step: "3", title: "Polling Day", description: "Cast your vote.", date: "Nov 5" }
           ],
           action_items: [
               "Verify your voter registration status today."
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
      You are an expert, highly encouraging Election Process Assistant. 
      Your goal is to guide the user clearly and solve the problem of voter confusion.
      
      User Profile Context:
      - State: ${context.state || 'Unknown'}
      - Age: ${context.age || 'Unknown'}
      - Voting Experience: ${context.experience || 'Unknown'}
      - Top Issue of Interest: ${context.issue || 'General'}
      - Language: ${context.language || 'English'}
      
      Instructions:
      1. Tailor your 'answer' strictly to their State rules, their Experience (e.g., be more explanatory for First-Time voters), and relate it to their Top Issue if appropriate.
      2. Breakdown the "election process, timelines, and steps" into interactive JSON 'timeline' chunks. Provide real dates if known for their state.
      3. Provide 1 or 2 'action_items' that are the most urgent things they need to do right now (e.g., "Find your local polling station at [state gov link]").
      4. Include a "Quick Quiz" in your response to test their knowledge on the topic.
      5. Respond entirely in their requested Language.
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
