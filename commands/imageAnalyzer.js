// // commands/imageAnalyzer.js
// const openaiHelper = require('../services/openaiHelper'); // Using OpenAI for images

// // --- UPDATED Default Prompt ---
// const DEFAULT_ANALYSIS_PROMPT = `Analyze the attached cryptocurrency price chart image. Identify key patterns (like trends, support/resistance levels, common chart patterns if visible). Provide a **concise summary, keeping the response well under 2000 characters (aim for ~450 tokens maximum)**, based ONLY on the visual information in the chart.`;

// async function handleImageAnalysisCommand(message, userTextQuery, imageUrl) {
//     console.log(`[ImageAnalyzer] Query: "${userTextQuery || '(No text query)'}", Image: ${imageUrl}`);
//     let thinkingMessage = null;
//     let fullResponseText = "";

//     try {
//         thinkingMessage = await message.reply("🖼️ Analyzing image with OpenAI Vision...");

//         let textPrompt = userTextQuery || DEFAULT_ANALYSIS_PROMPT;
//         // Append length constraint if user provided custom query and didn't mention conciseness
//         if (userTextQuery && !textPrompt.toLowerCase().includes("concise") && !textPrompt.toLowerCase().includes("token") && !textPrompt.toLowerCase().includes("short") && !textPrompt.toLowerCase().includes("brief")) {
//             textPrompt += "\n\n**Please keep your analysis concise (under 450 tokens / 2000 characters).**";
//         }

//         // Call the OpenAI vision stream function
//         const stream = await openaiHelper.getVisionAnalysisStream(textPrompt, imageUrl);

//         // --- Standard Streaming Logic ---
//         // (Updates outer fullResponseText - same as other handlers)
//         let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";

//         // Final message edit
//         if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
//         await thinkingMessage.edit({ content: fullResponseText });

//     } catch (error) { /* ... Error handling ... */
//         console.error("[ImageAnalyzer] OpenAI Vision processing error:", error); const errorMsg = `Sorry, error analyzing image with OpenAI: ${error.message}`; if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg }); } catch (e) { await message.reply(errorMsg); } } else { await message.reply(errorMsg); }
//      }
// }

// module.exports = { handleImageAnalysisCommand };

// commands/imageAnalyzer.js
const openaiHelper = require('../services/openaiHelper'); // Use OpenAI helper for vision
const { AttachmentBuilder } = require('discord.js'); // Already required if you use charts elsewhere, but good practice

// --- STRONGER Default Prompt ---
// Focus on brevity, key observations, and explicitly limit output style.
const DEFAULT_ANALYSIS_PROMPT = `Analyze the attached crypto chart ONLY based on visual data.
REQUIRED: Provide a very brief summary (2-3 key bullet points MAX).
STRICTLY limit response to under 400 tokens (~1800 characters).
DO NOT provide conversational text or explicit trading advice (long/short). Focus on objective patterns visible.`;

async function handleImageAnalysisCommand(message, userTextQuery, imageUrl) {

    console.log(`[ImageAnalyzer] Query: "${userTextQuery || '(No text query)'}", Image: ${imageUrl}`);
    let thinkingMessage = null;
    let fullResponseText = ""; // Keep declared high level

    try {
        thinkingMessage = await message.reply("🖼️ Analyzing image with CV...");

        // --- Construct Final Text Prompt with Strict Constraints ---
        let textPrompt = "";
        if (userTextQuery) {
            // If user provides text, combine it with strict instructions
            textPrompt = `User Query: "${userTextQuery}"\n\nImage Analysis Task: Analyze the attached crypto chart based ONLY on visual data described in the user query. REQUIRED: Answer concisely and **strictly limit your entire response to under 400 tokens / 1800 characters.** Focus on objective visual patterns relevant to the query. **DO NOT give direct buy/sell or long/short recommendations.**`;
        } else {
            // Use the default prompt if no user text provided
            textPrompt = DEFAULT_ANALYSIS_PROMPT;
        }
        console.log("[ImageAnalyzer] Final Text Prompt to Vision Model:", textPrompt);
        // --- End Prompt Construction ---


        // Call the OpenAI vision stream function from openaiHelper
        const stream = await openaiHelper.getVisionAnalysisStream(textPrompt, imageUrl);

        // --- Standard Streaming Logic (updates outer fullResponseText) ---
        let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100;
        for await (const chunk of stream) {
             const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
             // Check if edit needed (same throttling logic)
             if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) {
                 fullResponseText += accumulatedChunk; accumulatedChunk = "";
                 // Truncation check remains as a final safety net for Discord limit
                 if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(Discord limit reached)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
                 try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); }
             }
        }
        fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";
        // --- End Standard Streaming Logic ---

        // Final message edit (remove ellipsis)
        if (fullResponseText.endsWith("...")) { // Clean up ellipsis if stream finished before truncation
            fullResponseText = fullResponseText.slice(0, -3);
        }
        if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000); // Final hard limit

        // Add disclaimer if financial-like analysis occurred
         if(fullResponseText.match(/trend|support|resistance|pattern|bullish|bearish|long|short/i)) {
            if (!fullResponseText.toLowerCase().includes("not financial advice")) {
                fullResponseText += "\n\n*(Disclaimer: AI analysis based on visual data, NOT financial advice.)*";
            }
         }
         if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 1970) + "..."; // Trim again if disclaimer added too much


        await thinkingMessage.edit({ content: fullResponseText });

    } catch (error) { // Catch errors from getVisionAnalysisStream
        console.error("[ImageAnalyzer] OpenAI Vision processing error:", error);
        const errorMsg = `Sorry, error analyzing image with OpenAI: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
     }
}

module.exports = { handleImageAnalysisCommand };