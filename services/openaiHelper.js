// // services/openaiHelper.js
// require('dotenv').config();
// const OpenAI = require('openai'); // Use official library

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// // Read the specific vision model name from .env
// const VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo'; // Default to gpt-4-turbo

// let openaiClient; // OpenAI specific client

// if (!OPENAI_API_KEY) {
//     console.warn("WARNING: OPENAI_API_KEY not set. OpenAI features (like image analysis) will be disabled.");
// } else {
//     console.log(`Initializing OpenAI client for vision model: ${VISION_MODEL_NAME}`);
//     openaiClient = new OpenAI({
//         apiKey: OPENAI_API_KEY,
//         // No baseURL needed, defaults to OpenAI official endpoint
//     });
// }

// /**
//  * Sends a text prompt and an image URL to the configured OpenAI vision model and returns a stream.
//  * @param {string} textPrompt - The text question about the image.
//  * @param {string} imageUrl - The URL of the image to analyze.
//  * @returns {Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>} - A promise resolving to the stream iterator.
//  * @throws {Error} If API key/model missing, model doesn't support vision, or API call fails.
//  */
// async function getVisionAnalysisStream(textPrompt, imageUrl) {
//     if (!openaiClient) { throw new Error("OpenAI API key is not configured."); }
//     if (!VISION_MODEL_NAME) { throw new Error("OPENAI_VISION_MODEL not configured in .env file."); } // Should default, but check anyway
//     if (!imageUrl) { throw new Error("Image URL is required for vision analysis."); }

//     console.log(`Requesting VISION STREAM from OpenAI (model: ${VISION_MODEL_NAME}) for image: ${imageUrl}`);

//     // Construct payload according to OpenAI's vision API structure
//     const requestPayload = {
//         model: VISION_MODEL_NAME,
//         messages: [
//             {
//                 role: 'user',
//                 content: [ // Array for multimodal input
//                     { type: 'text', text: textPrompt },
//                     {
//                         type: 'image_url',
//                         image_url: {
//                             url: imageUrl,
//                             // Optional detail parameter: 'low', 'high', 'auto' (default)
//                             // detail: "auto"
//                         },
//                     }
//                 ],
//             },
//         ],
//         stream: true,
//         max_tokens: 1000 // Set a reasonable max output for image analysis
//     };

//     try {
//         // console.log("[OpenAI Vision Helper] Sending Payload:", JSON.stringify(requestPayload)); // Debug log if needed
//         const stream = await openaiClient.chat.completions.create(requestPayload);
//         return stream;
//     } catch (error) {
//         console.error(`OpenAI Vision API Error (Initial Stream Request):`, error?.message || error);
//         let errorMessage = `Failed to initiate vision stream with OpenAI. ${error?.message || 'Unknown error'}`;
//          if (error.response) { // Check for response object for more details
//              console.error("OpenAI Error Details:", error.response.data);
//              if (error.response.status === 401) errorMessage = "Error: Invalid OpenAI API Key.";
//              if (error.response.status === 429) errorMessage = "Error: OpenAI rate limit hit or quota exceeded.";
//              if (error.response.data?.error?.code === 'invalid_image_url') errorMessage = "Error: The provided image URL is invalid or inaccessible to OpenAI.";
//              if (error.response.data?.error?.code === 'billing_not_active') errorMessage = "Error: OpenAI account billing is not active.";
//               if (error.response.data?.error?.message) errorMessage = `OpenAI Error: ${error.response.data.error.message}`; // Use OpenAI's message
//          } else if (error.code === 'insufficient_quota') { // Sometimes error structure differs
//               errorMessage = "Error: OpenAI quota exceeded.";
//          }
//         throw new Error(errorMessage);
//     }
// }

// // Optional: Add text stream/non-stream functions here if needed later
// // async function getOpenAIStream(prompt) { ... }
// // async function getOpenAIResponse(prompt) { ... }

// module.exports = {
//     getVisionAnalysisStream,
//     // getOpenAIStream, // Export if/when added
//     // getOpenAIResponse, // Export if/when added
// };

// services/openaiHelper.js
require('dotenv').config();
const OpenAI = require('openai'); // Use official library

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Read the specific vision model name from .env
const VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo'; // Default to gpt-4-turbo

let openaiClient; // OpenAI specific client

if (!OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY not set. OpenAI features (like image analysis) will be disabled.");
} else {
    console.log(`Initializing OpenAI client for vision model: ${VISION_MODEL_NAME}`);
    openaiClient = new OpenAI({
        apiKey: OPENAI_API_KEY,
    });
}

/**
 * Sends a text prompt and an image URL to the configured OpenAI vision model and returns a stream.
 * @param {string} textPrompt - The text question about the image.
 * @param {string} imageUrl - The URL of the image to analyze.
 * @returns {Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>} - A promise resolving to the stream iterator.
 * @throws {Error} If API key/model missing, model doesn't support vision, or API call fails. Includes '[OAI]' prefix.
 */
async function getVisionAnalysisStream(textPrompt, imageUrl) {
    if (!openaiClient) { throw new Error("[OAI] OpenAI API key is not configured."); } // Added prefix
    if (!VISION_MODEL_NAME) { throw new Error("[OAI] OPENAI_VISION_MODEL not configured in .env file."); } // Added prefix
    if (!imageUrl) { throw new Error("[OAI] Image URL is required for vision analysis."); } // Added prefix

    console.log(`Requesting VISION STREAM from OpenAI (model: ${VISION_MODEL_NAME}) for image: ${imageUrl}`);
    const requestPayload = {
        model: VISION_MODEL_NAME,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: textPrompt },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ],
            },
        ],
        stream: true,
        max_tokens: 1000 // Set a reasonable max output for image analysis
    };

    try {
        const stream = await openaiClient.chat.completions.create(requestPayload);
        return stream;
    } catch (error) {
        console.error(`[OAI] Vision API Error (Initial Stream Request):`, error?.message || error);
        let errorMessage = `Failed vision stream. ${error?.message || 'Unknown error'}`;
        let statusCode = 'Unknown'; // Default status code

         if (error.response) { // Check for OpenAI's structured error response
             console.error("[OAI] Error Details:", error.response.data);
             statusCode = error.response.status || statusCode;
             const errorCode = error.response.data?.error?.code;
             const errorMsgFromAPI = error.response.data?.error?.message;

             if (statusCode === 401) errorMessage = "Invalid API Key.";
             else if (statusCode === 429) errorMessage = "Rate limit hit or quota exceeded.";
             else if (errorCode === 'invalid_image_url') errorMessage = "The provided image URL is invalid or inaccessible.";
             else if (errorCode === 'billing_not_active') errorMessage = "Account billing is not active.";
             else if (errorMsgFromAPI) errorMessage = errorMsgFromAPI; // Use OpenAI's message if available
             else errorMessage = `API returned status ${statusCode}.`;

         } else if (error.code === 'insufficient_quota') { // Sometimes error structure differs
              errorMessage = "Quota exceeded.";
              statusCode = 'Quota Exceeded';
         }
         // Throw error with prefix
        throw new Error(`[OAI] Error (${statusCode}): ${errorMessage}`);
    }
}


module.exports = {
    getVisionAnalysisStream,
};