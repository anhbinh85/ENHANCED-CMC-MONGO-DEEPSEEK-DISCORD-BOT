// actions/aiHelper.js
require('dotenv').config();
const OpenAI = require('openai');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

let aiClient;
if (!API_KEY) { console.error(`WARNING: DEEPSEEK_API_KEY is not set.`); }
else {
    console.log(`Initializing AI client for model ${MODEL_NAME} at ${BASE_URL}`);
    aiClient = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
}

async function getAIStream(prompt) { /* ... same stream logic as before ... */
    if (!aiClient) throw new Error("AI provider API key is not configured.");
    console.log(`Requesting STREAM from AI (model: ${MODEL_NAME})...`);
    try {
        const stream = await aiClient.chat.completions.create({
            model: MODEL_NAME, messages: [{ role: 'user', content: prompt }], stream: true, max_tokens: 500,
        });
        return stream;
    } catch (error) {
        console.error(`AI API Error (Initial Stream Request to ${BASE_URL}):`, error?.message || error);
        let errorMessage = `Failed to initiate stream with AI provider. ${error?.message || 'Unknown error'}`;
        if (error?.status === 402) { errorMessage = "Error: Insufficient balance/credits on AI provider account."; } // Specific check for 402
        else if (error?.status === 401) { errorMessage = "Error: Invalid API Key provided for AI service."; }
        else if (error?.code === 'context_length_exceeded') { errorMessage = `Error: ${error.message}`; }
        throw new Error(errorMessage);
    }
}
async function getAIResponse(prompt) { /* ... same non-streaming logic as before ... */
     console.warn("Calling Non-Streaming aiHelper..."); try { const stream = await getAIStream(prompt); let fullText = ''; for await (const chunk of stream) { fullText += chunk.choices[0]?.delta?.content || ''; } return fullText; } catch (error) { return `Error generating AI response: ${error.message}`; }
};
module.exports = getAIResponse;
module.exports.getAIStream = getAIStream;

