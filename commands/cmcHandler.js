// // commands/cmcHandler.js
// const { get_encoding } = require('tiktoken');
// // Ensure paths are correct based on your project structure
// const cmc = require('../services/coinMarketCap');
// const aiHelper = require('../services/aiHelper');
// const chartGenerator = require('../services/chartGenerator');
// const { AttachmentBuilder } = require('discord.js');
// const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts'); // Make sure prompts.js exists in root

// // --- Configuration ---
// const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
// const MAX_SYMBOLS_PER_QUERY = 10;

// // --- Helper Functions ---
// // Ensure these are correctly defined as provided previously
// function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) {
//     const potentialSymbols = query.toUpperCase().match(/\b([A-Z]{2,6})\b/g) || [];
//     const commonWords = new Set(['A', 'AN', 'AND', 'THE', 'FOR', 'INFO', 'PRICE', 'QUOTE', 'VS', 'OR', 'TREND', 'MARKET', 'GLOBAL', 'DATA', 'DEX', 'CHART']);
//     const symbols = potentialSymbols.filter(s => !commonWords.has(s));
//     if (symbols.length === 0) return null;
//     return [...new Set(symbols)].slice(0, max);
// }
// function extractSlugs(query, max = 1) {
//      const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
//      const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart']);
//      const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
//      if(slugs.length === 0) return null;
//      return [...new Set(slugs)].slice(0, max);
// }
// const constructCmcAnalysisPrompt = (cmcData, query) => {
//     if (!cmcData || typeof cmcData !== 'object') {
//         console.warn("[constructCmcAnalysisPrompt] Invalid cmcData received:", cmcData);
//         return `You are an AI assistant. The user asked "${query}" but there was an error retrieving structured data. Please inform the user.`;
//     }
//     let prompt = `You are an AI assistant acting as a crypto market analyst.\nUser's question: "${query}"\n\nUse the following data from CoinMarketCap:\n`;
//     try {
//         for (const key in cmcData) { if (cmcData[key]) { let dataToDisplay = cmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT); note=` (Showing first ${AI_SUMMARIZE_LIMIT})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `Object with ${Object.keys(dataToDisplay).length} keys (truncated)`; note=` (Truncated)`;} prompt += `\n${key.replace(/_/g,' ').toUpperCase()}${note}:\n`; prompt += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } }
//         prompt += "\nAnalysis Task: Based *only* on the provided CoinMarketCap data answer the user's query **concisely (under 500 tokens)**. Identify trends if asked and possible. IMPORTANT: Conclude with '(Disclaimer: This is AI-generated analysis, NOT financial advice.)'";
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
//     let fullResponseText = ""; // Declared high level
//     let chartImageBuffer = null;

//     try { // Outer try block
//         thinkingMessage = await message.reply("🤔 Planning request...");

//         // --- Step 1: AI Call #1 - Query Planning ---
//         console.log("[CMCHandler] Calling AI Planner/Classifier...");
//         const currentDate = new Date().toISOString().split('T')[0];
//         const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
//             .replace('{{CURRENT_DATE}}', currentDate)
//             .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

//         const plannerResponse = await aiHelper(plannerPrompt); // Non-streaming

//         let plan;
//         try {
//             const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//             plan = JSON.parse(cleanedJsonResponse);
//             console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
//             if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan structure (missing 'query_type')."); }
//             if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
//         } catch (parseError) { throw parseError; }

//         // --- Step 2: Route based on Classification ---
//         if (plan.query_type === "GENERAL_KNOWLEDGE") {
//             console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
//             await thinkingMessage.edit("💡 Answering general question...");
//             const directAnswerPrompt = `You are a helpful crypto assistant. Answer the query accurately and concisely:\n\n"${userQuery}"`;
//             const stream = await aiHelper.getAIStream(directAnswerPrompt);
//             // (Stream processing logic - updates outer fullResponseText)
//             let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI returned empty response for general query.";

//         } else if (plan.query_type === "CMC_DATA_NEEDED") {
//             console.log("[CMCHandler] Query classified as CMC Data Needed.");

//             if (plan.calls.length === 0) {
//                  console.warn("[CMCHandler] AI Planner requested CMC data but provided no calls.");
//                  fullResponseText = "I understood you need market data, but couldn't determine which specific data to fetch. Can you be more specific?";
//             } else {
//                 await thinkingMessage.edit("📊 Fetching market data...");
//                 let fetchedCmcData = {};
//                 let chartSymbol = plan.chart_request?.symbol || null;
//                 let chartData = null;
//                 let requiresPaidPlan = false;

//                 for (const callInstruction of plan.calls) {
//                     const functionName = callInstruction.function; const params = callInstruction.params || {}; let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1); console.log(`[CMCHandler] Executing planned call: ${functionName}(${JSON.stringify(params)})`);
//                     if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest'].includes(functionName)) { requiresPaidPlan = true; } // Check only known paid ones for now
//                     if (typeof cmc[functionName] === 'function') { try { let result = await cmc[functionName](params); fetchedCmcData[dataKey] = result; console.log(`[CMCHandler] SUCCESS calling ${functionName}`); if (plan.chart_request?.data_source_key === dataKey) { chartData = result?.quotes || result; if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) { console.warn("Fetched chart data empty/invalid."); plan.chart_request = null;} } } catch (cmcError) { throw cmcError; } } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); }
//                 } // End CMC call loop

//                 // --- ADDED DEBUG LOG ---
//                 console.log("[CMCHandler] Fetched CMC Data:", JSON.stringify(fetchedCmcData, null, 2));

//                 // --- Step 3b: Generate Chart ---
//                 if (plan.chart_request && chartData) { /* ... try generate chart ... */
//                     await thinkingMessage.edit("🎨 Generating chart..."); if (!chartGenerator || typeof chartGenerator.generatePriceVolumeChart !== 'function') { console.error("[CMCHandler] Chart Generator error."); } else { try { console.log(`[CMCHandler] Generating chart: ${chartSymbol}`); chartImageBuffer = await chartGenerator.generatePriceVolumeChart(chartSymbol, chartData); if (!chartImageBuffer) console.warn("[CMCHandler] Chart generation failed."); } catch (chartError) { console.error("[CMCHandler] Chart generation error:", chartError); /* Optionally add note later */ } }
//                 }

//                 // --- Step 4b: Final AI Analysis or Direct Formatting ---
//                 if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
//                     await thinkingMessage.edit("🤖 Synthesizing analysis...");

//                     const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
//                     // --- ADDED DEBUG LOG ---
//                     console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));

//                     // --- Token Estimation with Validation ---
//                     let encoding;
//                     try {
//                          // --- ADDED VALIDATION ---
//                          if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0) {
//                              // Log the data that led to the invalid prompt
//                              console.error("[CMCHandler] Invalid analysisPrompt generated. Fetched data was:", JSON.stringify(fetchedCmcData, null, 2));
//                              throw new Error('Constructed analysis prompt is invalid or empty.');
//                          }
//                          // --- END VALIDATION ---

//                          encoding = get_encoding(TOKENIZER_ENCODING);
//                          let estimatedTokens = encoding.encode(analysisPrompt).length;
//                          console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`);
//                          if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) {
//                              console.warn(`[CMCHandler] Analysis prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`);
//                              // Prepend note instead of replacing response
//                              fullResponseText = `(Note: Fetched data too large (${estimatedTokens} tokens) for full AI analysis. Summary might be incomplete.)\n\n`;
//                          }
//                          encoding.free();
//                     } catch (tokenError) {
//                          console.error("[CMCHandler] Analysis Token estimation error:", tokenError);
//                          console.error("[CMCHandler] Prompt causing token error (first 100 chars):", typeof analysisPrompt === 'string' ? analysisPrompt.substring(0,100) : analysisPrompt);
//                          if(encoding) encoding.free();
//                          throw new Error("Error estimating analysis tokens."); // Throw to outer catch
//                     }

//                     // AI Call #2 - Streaming (only proceed if no error note added by token check)
//                     // Let's always attempt the call for now, the AI might handle the note.
//                     // if (fullResponseText.length === 0) {
//                        const stream = await aiHelper.getAIStream(analysisPrompt); // Use the potentially large prompt
//                        // (Standard stream processing logic - APPENDS to existing fullResponseText)
//                        let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0 && !analysisPrompt.includes("truncated")) fullResponseText = "AI analysis returned empty response."; // Avoid overwriting truncation note
//                    // }

//                 } else if (Object.keys(fetchedCmcData).length > 0) {
//                     // Format raw data directly
//                     // (Direct formatting logic - same as previous)
//                      console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let dataToDisplay = fetchedCmcData[key]; let note=''; if (Array.isArray(dataToDisplay) && dataToDisplay.length > AI_SUMMARIZE_LIMIT*2) { dataToDisplay = dataToDisplay.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Show ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof dataToDisplay === 'object' && dataToDisplay !== null && Object.keys(dataToDisplay).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ dataToDisplay = `{${Object.keys(dataToDisplay).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(dataToDisplay, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;

//                 } else {
//                      // Case where CMC calls were planned but returned no data or failed silently?
//                      fullResponseText = "Sorry, I couldn't retrieve any relevant market data for your query.";
//                 }
//             } // End of CMC_DATA_NEEDED block

//         } else {
//             // AI Planner returned unknown query type
//             throw new Error(`AI Planner returned unknown query_type: ${plan.query_type}`);
//         }

//         // --- Final Discord Message Update ---
//         if (fullResponseText.length === 0) fullResponseText = "Sorry, I couldn't generate a response.";
//         if (plan?.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }
//         if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
//         const finalReplyOptions = { content: fullResponseText };
//         if (chartImageBuffer) { const attachment = new AttachmentBuilder(chartImageBuffer, { name: `${chartSymbol || 'chart'}.png` }); finalReplyOptions.files = [attachment]; }
//         await thinkingMessage.edit(finalReplyOptions);


//     } catch (error) { // Catch top-level errors
//         console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
//         // Log the plan if available when error occurs
//         if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan));
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
const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts'); // Assuming prompts.js is in root

// --- Configuration ---
const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
const MAX_SYMBOLS_PER_QUERY = 10;

// --- Helper Functions ---
function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) {
    const potentialSymbols = query.toUpperCase().match(/\b([A-Z]{2,6})\b/g) || [];
    const commonWords = new Set(['A', 'AN', 'AND', 'THE', 'FOR', 'INFO', 'PRICE', 'QUOTE', 'VS', 'OR', 'TREND', 'MARKET', 'GLOBAL', 'DATA', 'DEX', 'CHART', 'ON']);
    const symbols = potentialSymbols.filter(s => !commonWords.has(s));
    if (symbols.length === 0) return null;
    return [...new Set(symbols)].slice(0, max);
}
function extractSlugs(query, max = 1) {
     const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
     const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart', 'on']);
     const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
     if(slugs.length === 0) return null;
     return [...new Set(slugs)].slice(0, max);
}
// Helper to build the final analysis prompt
const constructCmcAnalysisPrompt = (cmcData, query) => {
    if (!cmcData || typeof cmcData !== 'object') {
        console.warn("[constructCmcAnalysisPrompt] Invalid cmcData:", cmcData);
        return `You are an AI assistant. User asked "${query}". Error retrieving structured data. Inform user.`;
    }
    let prompt = `You are an AI assistant crypto analyst.\nUser question: "${query}"\n\nUse this CMC data:\n`;
    try {
        for (const key in cmcData) { if (cmcData[key]) { let data = cmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT) { data = data.slice(0, AI_SUMMARIZE_LIMIT); note=` (Top ${AI_SUMMARIZE_LIMIT})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ data = `{${Object.keys(data).length} keys}`; note=` (Truncated)`;} prompt += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`; } }
        prompt += "\nAnalysis Task: Based *only* on provided data, answer user query. **Be concise (<450 tokens / ~1800 chars).** Summarize key points. If asked for price, state price clearly. IMPORTANT: Conclude with '(Disclaimer: NOT financial advice.)'";
    } catch (stringifyError) {
        console.error("[constructCmcAnalysisPrompt] Stringify Error:", stringifyError);
        prompt = `User asked "${query}". Error formatting market data. Inform user.`;
    }
    return prompt;
};


// --- Main Handler ---
async function handleCmcCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

    console.log(`[CMCHandler] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = "";
    let chartImageBuffer = null;
    let plan = {}; // Define plan structure for error logging

    try { // Outer try block
        thinkingMessage = await message.reply("🤔 Planning request...");

        // --- Step 1: AI Call #1 - Query Planning ---
        console.log("[CMCHandler] Calling AI Planner/Classifier...");
        const currentDate = new Date().toISOString().split('T')[0];
        const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
            .replace('{{CURRENT_DATE}}', currentDate)
            .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

        const plannerResponse = await aiHelper(plannerPrompt); // Non-streaming

        try {
            const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            plan = JSON.parse(cleanedJsonResponse); // Assign to outer scope plan
            console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
            if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan (missing 'query_type')."); }
            if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
        } catch (parseError) { console.error("PLAN PARSE ERROR:", parseError); throw new Error("AI Planner response was not valid JSON."); } // Rethrow


        // --- Step 2: Route based on Classification ---
        if (plan.query_type === "GENERAL_KNOWLEDGE") {
            console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
            await thinkingMessage.edit("💡 Answering general question...");
            const directAnswerPrompt = `You are a helpful crypto assistant. Answer the user query accurately. **Be concise: Keep the response well under 2000 characters (aim for ~450 tokens max).**\n\nUser Query: "${userQuery}"`;
            const stream = await aiHelper.getAIStream(directAnswerPrompt);
            // (Standard stream processing logic - updates outer fullResponseText)
            let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI returned empty response for general query.";

        } else if (plan.query_type === "CMC_DATA_NEEDED") {
            console.log("[CMCHandler] Query classified as CMC Data Needed.");

            if (plan.calls.length === 0) {
                 console.warn("[CMCHandler] AI Planner requested CMC data but provided no calls.");
                 fullResponseText = "I understood you need market data, but couldn't determine which specific data to fetch. Can you be more specific?";
                 // Skip direct to final edit below
            } else {
                await thinkingMessage.edit("📊 Fetching market data...");
                let fetchedCmcData = {};
                let chartSymbol = plan.chart_request?.symbol || null;
                let chartData = null;
                let requiresPaidPlan = false; // Reset flag for this request

                for (const callInstruction of plan.calls) {
                    const functionName = callInstruction.function;
                    let params = callInstruction.params || {}; // Start with AI suggested params
                    let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);
                    console.log(`[CMCHandler] Executing planned call: ${functionName}(${JSON.stringify(params)})`);

                    // Check for functions known to require paid plan
                    if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest', 'getPricePerformanceStats', 'getOhlcvLatest', 'getDexPairsOhlcvHistorical'].includes(functionName)) {
                        requiresPaidPlan = true; console.log(`[CMCHandler] Note: ${functionName} likely requires paid plan.`);
                    }

                    // --- Add network context IF REQUIRED by function ---
                    if (['getDexPairsQuotesLatest', 'getDexPairsOhlcvLatest', 'getDexPairsOhlcvHistorical', 'getDexPairsTradesLatest'].includes(functionName)) {
                        if (!params.network_slug && !params.network_id) {
                             console.log(`[CMCHandler] Network missing from AI plan for ${functionName}. Parsing query: "${userQuery}"`);
                             const networkMatch = userQuery.match(/on\s+([a-zA-Z]+)/i);
                             if (networkMatch && networkMatch[1]) {
                                 const networkSlug = networkMatch[1].toLowerCase();
                                 const slugMap = {'eth':'ethereum', 'poly':'polygon', 'matic':'polygon', 'bsc':'bsc', 'bnb':'bsc', 'avax': 'avalanche', 'sol': 'solana'}; // Expand map
                                 params.network_slug = slugMap[networkSlug] || networkSlug;
                                 console.log(`[CMCHandler] Added parsed network_slug: ${params.network_slug}`);
                             } else {
                                  console.warn(`[CMCHandler] Could not determine network for ${functionName}. CMC API call might fail or use default.`);
                                  // Consider throwing an error here if network is mandatory for the API endpoint
                                  // throw new Error(`Please specify network (e.g., 'on ethereum') for ${functionName}.`);
                             }
                         }
                    } // --- END Network Parameter Handling ---


                    if (typeof cmc[functionName] === 'function') {
                        try {
                            let result = await cmc[functionName](params); // Pass the potentially modified params
                            fetchedCmcData[dataKey] = result;
                            console.log(`[CMCHandler] SUCCESS calling ${functionName}`);
                            if (plan.chart_request?.data_source_key === dataKey) {
                                chartData = result?.quotes || result; // Adapt as needed
                                if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) {
                                    console.warn("Fetched chart data empty/invalid."); plan.chart_request = null;
                                }
                            }
                        } catch (cmcError) { throw cmcError; } // Rethrow CMC errors
                    } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); } // Throw if function doesn't exist
                } // End CMC call loop

                console.log("[CMCHandler] Fetched CMC Data Keys:", Object.keys(fetchedCmcData));

                // --- Safeguard ---
                if (!plan.needs_analysis && (fetchedCmcData.latest_quotes || fetchedCmcData.historical_data || fetchedCmcData.global_metrics || fetchedCmcData.market_pairs)) {
                    console.log("[CMCHandler] Safeguard: Forcing 'needs_analysis' to TRUE for common data types.");
                    plan.needs_analysis = true;
                }

                // --- Step 3b: Generate Chart ---
                if (plan.chart_request && chartData) { /* ... try generate chart ... */ }

                // --- Step 4b: Final AI Analysis or Direct Formatting ---
                if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
                    await thinkingMessage.edit("🤖 Synthesizing analysis...");
                    const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
                    console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));

                    // Token Estimation with Validation
                    let encoding; try { if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0) { throw new Error('Constructed analysis prompt is invalid.'); } encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(analysisPrompt).length; console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) { console.warn(`[CMCHandler] Analysis tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`); fullResponseText = `(Note: Data too large for full analysis.)\n\n`; } encoding.free(); } catch (tokenError) { console.error("[CMCHandler] Analysis Token error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating analysis tokens."); }

                    // AI Call #2 - Streaming
                    if (!fullResponseText.startsWith("(Note:")) {
                       const stream = await aiHelper.getAIStream(analysisPrompt);
                       // (Standard stream processing - updates outer fullResponseText)
                       let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";
                   }

                } else if (Object.keys(fetchedCmcData).length > 0) { // Format raw data directly
                     console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let data = fetchedCmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT*2) { data = data.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Top ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ data = `{${Object.keys(data).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;
                } else { fullResponseText = "Sorry, I couldn't retrieve relevant market data."; }
            } // End of CMC_DATA_NEEDED block with calls

        } else { throw new Error(`AI Planner unknown query_type: ${plan.query_type}`); }

        // --- Final Discord Message Update ---
        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response.";
        if (plan?.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }
        if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
        const finalReplyOptions = { content: fullResponseText };
        if (chartImageBuffer) { const attachment = new AttachmentBuilder(chartImageBuffer, { name: `${chartSymbol || 'chart'}.png` }); finalReplyOptions.files = [attachment]; }
        await thinkingMessage.edit(finalReplyOptions);


    } catch (error) { // Catch top-level errors
        console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
        if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan)); // Log plan on error
        const errorMsg = `Sorry, encountered an error: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, files: [] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
    } // End Outer Try/Catch
} // End handleCmcCommand

module.exports = { handleCmcCommand };