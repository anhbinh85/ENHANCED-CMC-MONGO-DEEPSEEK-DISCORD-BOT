// // commands/cmcHandler.js
// const { get_encoding } = require('tiktoken');
// const cmc = require('../services/coinMarketCap');
// const aiHelper = require('../services/aiHelper');
// const chartGenerator = require('../services/chartGenerator');
// const { AttachmentBuilder } = require('discord.js');
// const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts');

// // --- Configuration ---
// const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
// const MAX_SYMBOLS_PER_QUERY = 10;

// // --- Helper Functions (extractSymbols, constructCmcAnalysisPrompt) ---
// function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) { /* ... same ... */ }
// function extractSlugs(query, max = 1) { /* ... same ... */ }
// const constructCmcAnalysisPrompt = (cmcData, query) => {
//     // Add internal check for safety
//     if (!cmcData || typeof cmcData !== 'object') {
//         console.warn("[constructCmcAnalysisPrompt] Invalid cmcData received:", cmcData);
//         return `You are an AI assistant. The user asked "${query}" but there was an error retrieving structured data. Please inform the user.`;
//     }
//     let prompt = `You are an AI assistant acting as a crypto market analyst.\nUser's question: "${query}"\n\nUse the following data from CoinMarketCap:\n`;
//     try { // Add try-catch around stringify just in case
//         for (const key in cmcData) { if (cmcData[key]) { let dataToDisplay = cmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT); note=` (Showing first ${AI_SUMMARIZE_LIMIT})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `Object with ${Object.keys(dataToDisplay).length} keys (truncated)`; note=` (Truncated)`;} prompt += `\n${key.replace(/_/g,' ').toUpperCase()}${note}:\n`; prompt += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } }
//         prompt += "\nAnalysis Task: Based *only* on the provided CoinMarketCap data answer the user's query concisely. Identify trends if asked and possible. IMPORTANT: Conclude with '(Disclaimer: This is AI-generated analysis, NOT financial advice.)'";
//     } catch (stringifyError) {
//         console.error("[constructCmcAnalysisPrompt] Error during JSON.stringify:", stringifyError);
//         prompt = `You are an AI assistant. The user asked "${query}". There was an error formatting the retrieved market data. Please inform the user an internal formatting error occurred.`;
//     }
//     return prompt;
// };


// // --- Main Handler ---
// async function handleCmcCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

//     console.log(`[CMCHandler] Query: "${userQuery}"`);
//     let thinkingMessage = null;
//     let fullResponseText = ""; // Declare here
//     let chartImageBuffer = null; // Declare here

//     try { // Outer try block
//         thinkingMessage = await message.reply("🤔 Planning request...");

//         // --- Step 1: AI Call #1 - Query Planning ---
//         console.log("[CMCHandler] Calling AI Planner...");
//         const currentDate = new Date().toISOString().split('T')[0];
//         const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
//             .replace('{{CURRENT_DATE}}', currentDate)
//             .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

//         const plannerResponse = await aiHelper(plannerPrompt);
//         let plan;
//         try {
//             const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//             plan = JSON.parse(cleanedJsonResponse);
//             console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
//             if (!plan || !Array.isArray(plan.calls)) { throw new Error("AI Planner returned invalid plan structure."); }
//         } catch (parseError) { /* ... handle parse error ... */ throw parseError; }

//         // --- Step 2: Execute CMC API Calls ---
//         await thinkingMessage.edit("📊 Fetching market data...");
//         let fetchedCmcData = {};
//         let chartSymbol = plan.chart_request?.symbol || null;
//         let chartData = null;
//         let requiresPaidPlan = false;

//         for (const callInstruction of plan.calls) {
//             // ... (same logic for iterating calls, checking function, handling paid plan flag) ...
//             const functionName = callInstruction.function; const params = callInstruction.params || {}; let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1); console.log(`[CMCHandler] Executing planned call: ${functionName}(${JSON.stringify(params)})`);
//             if (['getOhlcvHistorical', 'getQuotesHistorical', /* ... other paid ones */ ].includes(functionName)) { requiresPaidPlan = true; }
//             if (typeof cmc[functionName] === 'function') {
//                 try { let result = await cmc[functionName](params); fetchedCmcData[dataKey] = result; console.log(`[CMCHandler] SUCCESS calling ${functionName}`); if (plan.chart_request?.data_source_key === dataKey) { chartData = result?.quotes || result; if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) { console.warn("Fetched data for chart empty/invalid."); plan.chart_request = null;} } }
//                 catch (cmcError) { throw cmcError; } // Re-throw CMC errors to outer catch
//             } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); }
//         }

//         // --- ADD DEBUG LOG FOR FETCHED DATA ---
//         console.log("[CMCHandler] Fetched CMC Data:", JSON.stringify(fetchedCmcData, null, 2));

//         // --- Step 3: Generate Chart ---
//         if (plan.chart_request && chartData) { /* ... try generate chart ... */ }

//         // --- Step 4: Final AI Analysis or Direct Formatting ---
//         if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
//             await thinkingMessage.edit("🤖 Synthesizing analysis...");

//             // --- Construct and Log Analysis Prompt ---
//             const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
//             console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200)); // Log beginning

//             // --- Token Estimation with Validation ---
//             let encoding;
//             try {
//                  // --- ADD VALIDATION BEFORE ENCODING ---
//                  if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0) {
//                      throw new Error('Constructed analysis prompt is invalid or empty.');
//                  }
//                  // --- END VALIDATION ---

//                  encoding = get_encoding(TOKENIZER_ENCODING);
//                  let estimatedTokens = encoding.encode(analysisPrompt).length; // Pass the validated prompt
//                  console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`);
//                  if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) {
//                      console.warn(`[CMCHandler] Analysis prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`);
//                      fullResponseText = `(Note: Fetched data too large (${estimatedTokens} tokens) for full AI analysis. Summary might be incomplete.)\n\n`;
//                  }
//                  encoding.free();
//             } catch (tokenError) {
//                  console.error("[CMCHandler] Analysis Token estimation error:", tokenError);
//                  // Log the prompt that caused the error if possible
//                  console.error("[CMCHandler] Prompt causing token error (first 100 chars):", typeof analysisPrompt === 'string' ? analysisPrompt.substring(0,100) : analysisPrompt);
//                  if(encoding) encoding.free();
//                  throw new Error("Error estimating analysis tokens."); // Throw to outer catch
//             }
//             // --- End Token Estimation ---


//             // AI Call #2 - Streaming (only proceed if token check didn't add error text already)
//             if (fullResponseText.length === 0) { // Check if error note was already added
//                 const stream = await aiHelper.getAIStream(analysisPrompt); // Use the validated prompt
//                 // (Standard stream processing logic...)
//                  let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";
//             }

//         } else if (Object.keys(fetchedCmcData).length > 0) { /* ... Format raw data directly ... */
//              console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Here is the data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let dataToDisplay = fetchedCmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT*2) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Show ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `{${Object.keys(dataToDisplay).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;
//         } else { fullResponseText = "Sorry, I couldn't retrieve any relevant data."; }

//         // --- Final Discord Message Update ---
//         // (Final formatting and editing logic - same as before, uses fullResponseText)
//          if (fullResponseText.length === 0) fullResponseText = "No information found or generated."; if (plan.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; } if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000); const finalReplyOptions = { content: fullResponseText }; if (chartImageBuffer) { const attachment = new AttachmentBuilder(chartImageBuffer, { name: `${chartSymbol || 'chart'}.png` }); finalReplyOptions.files = [attachment]; } await thinkingMessage.edit(finalReplyOptions);

//     } catch (error) { // Catch top-level errors
//         console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
//         const errorMsg = `Sorry, encountered an error: ${error.message}`;
//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, files: [] }); } catch (e) { await message.reply(errorMsg); } }
//         else { await message.reply(errorMsg); }
//     } // End Outer Try/Catch
// } // End handleCmcCommand

// module.exports = { handleCmcCommand };

// commands/cmcHandler.js
const { get_encoding } = require('tiktoken');
// Ensure paths are correct based on your project structure
const cmc = require('../services/coinMarketCap');
const aiHelper = require('../services/aiHelper');
const chartGenerator = require('../services/chartGenerator');
const { AttachmentBuilder } = require('discord.js');
const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts'); // Make sure prompts.js exists in root

// --- Configuration ---
const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
const MAX_SYMBOLS_PER_QUERY = 10;

// --- Helper Functions ---
// Ensure these are correctly defined as provided previously
function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) {
    const potentialSymbols = query.toUpperCase().match(/\b([A-Z]{2,6})\b/g) || [];
    const commonWords = new Set(['A', 'AN', 'AND', 'THE', 'FOR', 'INFO', 'PRICE', 'QUOTE', 'VS', 'OR', 'TREND', 'MARKET', 'GLOBAL', 'DATA', 'DEX', 'CHART']);
    const symbols = potentialSymbols.filter(s => !commonWords.has(s));
    if (symbols.length === 0) return null;
    return [...new Set(symbols)].slice(0, max);
}
function extractSlugs(query, max = 1) {
     const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
     const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart']);
     const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
     if(slugs.length === 0) return null;
     return [...new Set(slugs)].slice(0, max);
}
const constructCmcAnalysisPrompt = (cmcData, query) => {
    if (!cmcData || typeof cmcData !== 'object') {
        console.warn("[constructCmcAnalysisPrompt] Invalid cmcData received:", cmcData);
        return `You are an AI assistant. The user asked "${query}" but there was an error retrieving structured data. Please inform the user.`;
    }
    let prompt = `You are an AI assistant acting as a crypto market analyst.\nUser's question: "${query}"\n\nUse the following data from CoinMarketCap:\n`;
    try {
        for (const key in cmcData) { if (cmcData[key]) { let dataToDisplay = cmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT); note=` (Showing first ${AI_SUMMARIZE_LIMIT})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `Object with ${Object.keys(dataToDisplay).length} keys (truncated)`; note=` (Truncated)`;} prompt += `\n${key.replace(/_/g,' ').toUpperCase()}${note}:\n`; prompt += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } }
        prompt += "\nAnalysis Task: Based *only* on the provided CoinMarketCap data answer the user's query **concisely (under 500 tokens)**. Identify trends if asked and possible. IMPORTANT: Conclude with '(Disclaimer: This is AI-generated analysis, NOT financial advice.)'";
    } catch (stringifyError) {
        console.error("[constructCmcAnalysisPrompt] Error during JSON.stringify:", stringifyError);
        prompt = `You are an AI assistant. The user asked "${query}". There was an error formatting the retrieved market data. Please inform the user an internal formatting error occurred.`;
    }
    return prompt;
};


// --- Main Handler ---
async function handleCmcCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

    console.log(`[CMCHandler] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = ""; // Declared high level
    let chartImageBuffer = null;

    try { // Outer try block
        thinkingMessage = await message.reply("🤔 Planning request...");

        // --- Step 1: AI Call #1 - Query Planning ---
        console.log("[CMCHandler] Calling AI Planner/Classifier...");
        const currentDate = new Date().toISOString().split('T')[0];
        const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
            .replace('{{CURRENT_DATE}}', currentDate)
            .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

        const plannerResponse = await aiHelper(plannerPrompt); // Non-streaming

        let plan;
        try {
            const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            plan = JSON.parse(cleanedJsonResponse);
            console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
            if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan structure (missing 'query_type')."); }
            if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
        } catch (parseError) { throw parseError; }

        // --- Step 2: Route based on Classification ---
        if (plan.query_type === "GENERAL_KNOWLEDGE") {
            console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
            await thinkingMessage.edit("💡 Answering general question...");
            const directAnswerPrompt = `You are a helpful crypto assistant. Answer the query accurately and concisely:\n\n"${userQuery}"`;
            const stream = await aiHelper.getAIStream(directAnswerPrompt);
            // (Stream processing logic - updates outer fullResponseText)
            let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI returned empty response for general query.";

        } else if (plan.query_type === "CMC_DATA_NEEDED") {
            console.log("[CMCHandler] Query classified as CMC Data Needed.");

            if (plan.calls.length === 0) {
                 console.warn("[CMCHandler] AI Planner requested CMC data but provided no calls.");
                 fullResponseText = "I understood you need market data, but couldn't determine which specific data to fetch. Can you be more specific?";
            } else {
                await thinkingMessage.edit("📊 Fetching market data...");
                let fetchedCmcData = {};
                let chartSymbol = plan.chart_request?.symbol || null;
                let chartData = null;
                let requiresPaidPlan = false;

                for (const callInstruction of plan.calls) {
                    const functionName = callInstruction.function; const params = callInstruction.params || {}; let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1); console.log(`[CMCHandler] Executing planned call: ${functionName}(${JSON.stringify(params)})`);
                    if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest'].includes(functionName)) { requiresPaidPlan = true; } // Check only known paid ones for now
                    if (typeof cmc[functionName] === 'function') { try { let result = await cmc[functionName](params); fetchedCmcData[dataKey] = result; console.log(`[CMCHandler] SUCCESS calling ${functionName}`); if (plan.chart_request?.data_source_key === dataKey) { chartData = result?.quotes || result; if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) { console.warn("Fetched chart data empty/invalid."); plan.chart_request = null;} } } catch (cmcError) { throw cmcError; } } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); }
                } // End CMC call loop

                // --- ADDED DEBUG LOG ---
                console.log("[CMCHandler] Fetched CMC Data:", JSON.stringify(fetchedCmcData, null, 2));

                // --- Step 3b: Generate Chart ---
                if (plan.chart_request && chartData) { /* ... try generate chart ... */
                    await thinkingMessage.edit("🎨 Generating chart..."); if (!chartGenerator || typeof chartGenerator.generatePriceVolumeChart !== 'function') { console.error("[CMCHandler] Chart Generator error."); } else { try { console.log(`[CMCHandler] Generating chart: ${chartSymbol}`); chartImageBuffer = await chartGenerator.generatePriceVolumeChart(chartSymbol, chartData); if (!chartImageBuffer) console.warn("[CMCHandler] Chart generation failed."); } catch (chartError) { console.error("[CMCHandler] Chart generation error:", chartError); /* Optionally add note later */ } }
                }

                // --- Step 4b: Final AI Analysis or Direct Formatting ---
                if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
                    await thinkingMessage.edit("🤖 Synthesizing analysis...");

                    const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
                    // --- ADDED DEBUG LOG ---
                    console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));

                    // --- Token Estimation with Validation ---
                    let encoding;
                    try {
                         // --- ADDED VALIDATION ---
                         if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0) {
                             // Log the data that led to the invalid prompt
                             console.error("[CMCHandler] Invalid analysisPrompt generated. Fetched data was:", JSON.stringify(fetchedCmcData, null, 2));
                             throw new Error('Constructed analysis prompt is invalid or empty.');
                         }
                         // --- END VALIDATION ---

                         encoding = get_encoding(TOKENIZER_ENCODING);
                         let estimatedTokens = encoding.encode(analysisPrompt).length;
                         console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`);
                         if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) {
                             console.warn(`[CMCHandler] Analysis prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`);
                             // Prepend note instead of replacing response
                             fullResponseText = `(Note: Fetched data too large (${estimatedTokens} tokens) for full AI analysis. Summary might be incomplete.)\n\n`;
                         }
                         encoding.free();
                    } catch (tokenError) {
                         console.error("[CMCHandler] Analysis Token estimation error:", tokenError);
                         console.error("[CMCHandler] Prompt causing token error (first 100 chars):", typeof analysisPrompt === 'string' ? analysisPrompt.substring(0,100) : analysisPrompt);
                         if(encoding) encoding.free();
                         throw new Error("Error estimating analysis tokens."); // Throw to outer catch
                    }

                    // AI Call #2 - Streaming (only proceed if no error note added by token check)
                    // Let's always attempt the call for now, the AI might handle the note.
                    // if (fullResponseText.length === 0) {
                       const stream = await aiHelper.getAIStream(analysisPrompt); // Use the potentially large prompt
                       // (Standard stream processing logic - APPENDS to existing fullResponseText)
                       let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0 && !analysisPrompt.includes("truncated")) fullResponseText = "AI analysis returned empty response."; // Avoid overwriting truncation note
                   // }

                } else if (Object.keys(fetchedCmcData).length > 0) {
                    // Format raw data directly
                    // (Direct formatting logic - same as previous)
                     console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let dataToDisplay = fetchedCmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT*2) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Show ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `{${Object.keys(dataToDisplay).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;

                } else {
                     // Case where CMC calls were planned but returned no data or failed silently?
                     fullResponseText = "Sorry, I couldn't retrieve any relevant market data for your query.";
                }
            } // End of CMC_DATA_NEEDED block

        } else {
            // AI Planner returned unknown query type
            throw new Error(`AI Planner returned unknown query_type: ${plan.query_type}`);
        }

        // --- Final Discord Message Update ---
        if (fullResponseText.length === 0) fullResponseText = "Sorry, I couldn't generate a response.";
        if (plan?.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }
        if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
        const finalReplyOptions = { content: fullResponseText };
        if (chartImageBuffer) { const attachment = new AttachmentBuilder(chartImageBuffer, { name: `${chartSymbol || 'chart'}.png` }); finalReplyOptions.files = [attachment]; }
        await thinkingMessage.edit(finalReplyOptions);


    } catch (error) { // Catch top-level errors
        console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
        // Log the plan if available when error occurs
        if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan));
        const errorMsg = `Sorry, encountered an error: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, files: [] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
    } // End Outer Try/Catch
} // End handleCmcCommand

module.exports = { handleCmcCommand };