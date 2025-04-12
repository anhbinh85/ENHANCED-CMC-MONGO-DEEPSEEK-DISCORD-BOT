// // actions/aiHelper.js
// require('dotenv').config();
// const OpenAI = require('openai');

// const API_KEY = process.env.DEEPSEEK_API_KEY;
// const MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
// const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

// let aiClient;
// if (!API_KEY) { console.error(`WARNING: DEEPSEEK_API_KEY is not set.`); }
// else {
//     console.log(`Initializing AI client for model ${MODEL_NAME} at ${BASE_URL}`);
//     aiClient = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
// }

// async function getAIStream(prompt) { /* ... same stream logic as before ... */
//     if (!aiClient) throw new Error("AI provider API key is not configured.");
//     console.log(`Requesting STREAM from AI (model: ${MODEL_NAME})...`);
//     try {
//         const stream = await aiClient.chat.completions.create({
//             model: MODEL_NAME, messages: [{ role: 'user', content: prompt }], stream: true, max_tokens: 500,
//         });
//         return stream;
//     } catch (error) {
//         console.error(`AI API Error (Initial Stream Request to ${BASE_URL}):`, error?.message || error);
//         let errorMessage = `Failed to initiate stream with AI provider. ${error?.message || 'Unknown error'}`;
//         if (error?.status === 402) { errorMessage = "Error: Insufficient balance/credits on AI provider account."; } // Specific check for 402
//         else if (error?.status === 401) { errorMessage = "Error: Invalid API Key provided for AI service."; }
//         else if (error?.code === 'context_length_exceeded') { errorMessage = `Error: ${error.message}`; }
//         throw new Error(errorMessage);
//     }
// }
// async function getAIResponse(prompt) { /* ... same non-streaming logic as before ... */
//      console.warn("Calling Non-Streaming aiHelper..."); try { const stream = await getAIStream(prompt); let fullText = ''; for await (const chunk of stream) { fullText += chunk.choices[0]?.delta?.content || ''; } return fullText; } catch (error) { return `Error generating AI response: ${error.message}`; }
// };
// module.exports = getAIResponse;
// module.exports.getAIStream = getAIStream;

// services/aiHelper.js
require('dotenv').config();
const OpenAI = require('openai'); // Used for DeepSeek compatibility
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- Configuration ---
const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek'; // Default to deepseek

// DeepSeek Config
const DS_API_KEY = process.env.DEEPSEEK_API_KEY;
const DS_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat'; // Kept original env var name for backward compat
const DS_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

// Gemini Config
const GE_API_KEY = process.env.GEMINI_API_KEY;
const GE_MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash-latest'; // Using 1.5 flash as requested

// --- Initialize Clients ---
let deepseekClient;
let geminiClient;
let geminiModel;

if (AI_PROVIDER === 'deepseek') {
    if (!DS_API_KEY) {
        console.warn("AI_PROVIDER is 'deepseek' but DEEPSEEK_API_KEY is not set.");
    } else {
        console.log(`Initializing DeepSeek client for model ${DS_MODEL_NAME} at ${DS_BASE_URL}`);
        try {
             deepseekClient = new OpenAI({ apiKey: DS_API_KEY, baseURL: DS_BASE_URL });
             console.log("DeepSeek client initialized.");
        } catch (e) {
            console.error("Failed to initialize DeepSeek client:", e);
        }
    }
} else if (AI_PROVIDER === 'gemini') {
    if (!GE_API_KEY) {
        console.warn("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is not set.");
    } else {
        console.log(`Initializing Gemini client for model ${GE_MODEL_NAME}`);
        try {
            geminiClient = new GoogleGenerativeAI(GE_API_KEY);
            geminiModel = geminiClient.getGenerativeModel({
                model: GE_MODEL_NAME,
                 // Block minimal harm categories - adjust as needed
                 safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                 ],
                generationConfig: {
                    // Adjust temperature and max tokens as needed
                    temperature: 0.7, // Example value
                    maxOutputTokens: 1500, // Example value, align with DS?
                }
            });
            console.log("Gemini client and model initialized.");
        } catch (e) {
            console.error("Failed to initialize Gemini client:", e);
        }
    }
} else {
    console.error(`Unsupported AI_PROVIDER configured: ${AI_PROVIDER}. Must be 'deepseek' or 'gemini'.`);
}

// --- Internal Stream Functions ---

async function* _deepseekStream(prompt) {
    if (!deepseekClient) throw new Error("[DS] DeepSeek API Key/Client not configured.");
    console.log(`Requesting STREAM from DeepSeek (model: ${DS_MODEL_NAME})...`);
    try {
        const stream = await deepseekClient.chat.completions.create({
            model: DS_MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            max_tokens: 1500, // Consistent max_tokens
        });
        // Yield in the expected format
        for await (const chunk of stream) {
             yield chunk; // DeepSeek client already returns OpenAI-compatible chunks
        }
    } catch (error) {
        console.error(`[DS] API Error (Stream Request to ${DS_BASE_URL}):`, error?.message || error);
        let errorMessage = `Failed stream with DS provider. ${error?.message || 'Unknown error'}`;
        if (error?.status === 402) { errorMessage = "[DS] Error: Insufficient balance/credits."; }
        else if (error?.status === 401) { errorMessage = "[DS] Error: Invalid API Key."; }
        else if (error?.code === 'context_length_exceeded') { errorMessage = `[DS] Error: ${error.message}`; }
        else { errorMessage = `[DS] Error: ${error.message || errorMessage}`; } // Include original message if possible
        throw new Error(errorMessage);
    }
}

async function* _geminiStream(prompt) {
    if (!geminiModel) throw new Error("[GE] Gemini API Key/Client/Model not configured.");
    console.log(`Requesting STREAM from Gemini (model: ${GE_MODEL_NAME})...`);
    try {
        const result = await geminiModel.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // **CORRECTION:** Removed the 'tools' parameter which caused the error.
            // Grounding is typically off by default unless a grounding tool is specified.
        });

        // Adapt Gemini stream to OpenAI-like format
        for await (const chunk of result.stream) {
            // Check if the chunk contains a valid text part
             const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                yield {
                    choices: [{
                        delta: { content: text },
                        finish_reason: null, // Will be set in the final chunk if applicable
                    }],
                };
            }
             // Check for finish reason in the chunk
             const finishReason = chunk.candidates?.[0]?.finishReason;
             if (finishReason && finishReason !== "FINISH_REASON_UNSPECIFIED" && finishReason !== "NOT_SET") {
                 console.log(`[GE] Stream finished with reason: ${finishReason}`);
                 yield { choices: [{ delta: {}, finish_reason: finishReason }] };
             }
             // Additionally, check for safety ratings if needed
             const safetyRatings = chunk.candidates?.[0]?.safetyRatings;
             if (safetyRatings?.some(rating => rating.blocked)) {
                  console.warn(`[GE] Stream potentially blocked due to safety settings.`, safetyRatings);
                  // You might want to throw an error or yield a specific message here
                  // For now, we'll let the stream potentially end early or without content
             }
        }
    } catch (error) {
        console.error(`[GE] API Error (Stream Request):`, error?.message || error);
        // Try to parse specific GoogleGenerativeAI errors
        let errorMessage = `Failed stream with GE provider. ${error?.message || 'Unknown error'}`;
        if (error?.message?.includes("API key not valid")) { errorMessage = "[GE] Error: Invalid API Key."; }
        else if (error?.message?.includes("quota")) { errorMessage = "[GE] Error: Quota exceeded."; }
        else if (error?.message?.includes("400 Bad Request")) { // Catch the previous error type more broadly
             errorMessage = `[GE] Error: Bad Request - Check model name, parameters, or API endpoint. (${error?.message})`;
        }
        // Add other checks based on Gemini documentation or observed errors
        throw new Error(errorMessage);
    }
}

// --- Unified Helper Functions ---

/**
 * Gets an AI response stream from the configured provider.
 * @param {string} prompt The user prompt.
 * @returns {AsyncGenerator<object>} An async generator yielding response chunks (OpenAI format).
 * @throws {Error} If the configured provider is unavailable or an API error occurs.
 */
async function* getAIStream(prompt) {
    console.log(`[AI Helper] Routing stream request to provider: ${AI_PROVIDER}`);
    if (AI_PROVIDER === 'deepseek') {
        yield* _deepseekStream(prompt);
    } else if (AI_PROVIDER === 'gemini') {
        yield* _geminiStream(prompt);
    } else {
        throw new Error(`[AI Helper] Unsupported AI_PROVIDER configured: ${AI_PROVIDER}.`);
    }
}

/**
 * Gets a complete AI response string from the configured provider (non-streaming).
 * @param {string} prompt The user prompt.
 * @returns {Promise<string>} The complete AI response string, or an error message string.
 */
async function getAIResponse(prompt) {
    console.warn(`[AI Helper] Calling Non-Streaming AI function for provider: ${AI_PROVIDER}...`);
    let fullText = '';
    try {
        const stream = getAIStream(prompt); // Use the unified stream function
        for await (const chunk of stream) {
            fullText += chunk.choices[0]?.delta?.content || '';
        }
        if (fullText.length === 0) {
             console.warn("[AI Helper] Non-streaming call returned empty response.");
             // Check if the last chunk had a finish reason other than 'STOP'?
             // For simplicity, just return a generic message.
             return "AI analysis returned an empty response.";
        }
        return fullText;
    } catch (error) {
         console.error(`[AI Helper] Error during non-streaming AI request (${AI_PROVIDER}): ${error.message}`);
         // Return the error message string which should already have the prefix
         return `Error generating AI response: ${error.message}`;
    }
}

module.exports = {
    getAIStream,
    getAIResponse
};


