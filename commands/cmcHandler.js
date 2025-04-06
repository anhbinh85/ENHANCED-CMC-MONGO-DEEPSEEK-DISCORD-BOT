// // commands/cmcHandler.js
// const { get_encoding } = require('tiktoken');
// // Ensure paths are correct based on your project structure
// const cmc = require('../services/coinMarketCap');
// const aiHelper = require('../services/aiHelper');
// const chartGenerator = require('../services/chartGenerator');
// const { AttachmentBuilder } = require('discord.js');
// const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts'); // Assuming prompts.js is in root

// // --- Configuration ---
// const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
// const MAX_SYMBOLS_PER_QUERY = 10;

// // --- Helper Functions ---
// function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) {
//     const potentialSymbols = query.toUpperCase().match(/\b([A-Z]{2,6})\b/g) || [];
//     const commonWords = new Set(['A', 'AN', 'AND', 'THE', 'FOR', 'INFO', 'PRICE', 'QUOTE', 'VS', 'OR', 'TREND', 'MARKET', 'GLOBAL', 'DATA', 'DEX', 'CHART', 'ON']);
//     const symbols = potentialSymbols.filter(s => !commonWords.has(s));
//     if (symbols.length === 0) return null;
//     return [...new Set(symbols)].slice(0, max);
// }
// function extractSlugs(query, max = 1) {
//      const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
//      const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart', 'on']);
//      const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
//      if(slugs.length === 0) return null;
//      return [...new Set(slugs)].slice(0, max);
// }
// // Helper to build the final analysis prompt
// const constructCmcAnalysisPrompt = (cmcData, query) => {
//     if (!cmcData || typeof cmcData !== 'object') {
//         console.warn("[constructCmcAnalysisPrompt] Invalid cmcData:", cmcData);
//         return `You are an AI assistant. User asked "${query}". Error retrieving structured data. Inform user.`;
//     }
//     let prompt = `You are an AI assistant crypto analyst.\nUser question: "${query}"\n\nUse this CMC data:\n`;
//     try {
//         for (const key in cmcData) { if (cmcData[key]) { let data = cmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT) { data = data.slice(0, AI_SUMMARIZE_LIMIT); note=` (Top ${AI_SUMMARIZE_LIMIT})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ data = `{${Object.keys(data).length} keys}`; note=` (Truncated)`;} prompt += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`; } }
//         prompt += "\nAnalysis Task: Based *only* on provided data, answer user query. **Be concise (<450 tokens / ~1800 chars).** Summarize key points. If asked for price, state price clearly. IMPORTANT: Conclude with '(Disclaimer: NOT financial advice.)'";
//     } catch (stringifyError) {
//         console.error("[constructCmcAnalysisPrompt] Stringify Error:", stringifyError);
//         prompt = `User asked "${query}". Error formatting market data. Inform user.`;
//     }
//     return prompt;
// };

// // --- **UPDATED** Helper Function to Process Date Placeholders (Handles Hours 'h' and Days 'd') ---
// function processDatePlaceholder(placeholder) {
//     // console.log(`[DEBUG] processDatePlaceholder called with: "${placeholder}"`); // Keep commented unless debugging needed
//     const now = new Date();
//     // Regex updated to match d, D, h, or H as unit
//     const match = placeholder.match(/{{CURRENT_DATE(?:_minus_(\d+)([dhDH]))?}}/i);

//     if (!match) {
//         // console.log(`[DEBUG] processDatePlaceholder: No match found, returning original.`);
//         return placeholder; // Return original if no match
//     }

//     let resultDate;
//     if (match[1] && match[2]) {
//         // Placeholder has offset (e.g., {{CURRENT_DATE_minus_90d}} or {{CURRENT_DATE_minus_1h}})
//         const valueToSubtract = parseInt(match[1], 10);
//         const unit = match[2].toLowerCase(); // Use lowercase unit for comparison
//         // console.log(`[DEBUG] processDatePlaceholder: Matched offset, value=${valueToSubtract}, unit=${unit}`);

//         if (!isNaN(valueToSubtract)) {
//             resultDate = new Date(now); // Start from current time
//             if (unit === 'd') {
//                 resultDate.setDate(resultDate.getDate() - valueToSubtract);
//                 // console.log(`[DEBUG] processDatePlaceholder: Subtracted ${valueToSubtract} days.`);
//             } else if (unit === 'h') {
//                 resultDate.setHours(resultDate.getHours() - valueToSubtract);
//                 // console.log(`[DEBUG] processDatePlaceholder: Subtracted ${valueToSubtract} hours.`);
//             } else {
//                  console.warn(`[CMCHandler] processDatePlaceholder: Unknown unit "${unit}" in placeholder "${placeholder}". Returning original.`);
//                  return placeholder; // Unknown unit
//             }
//             // console.log(`[DEBUG] processDatePlaceholder: Calculated target date: ${resultDate}`);
//         } else {
//              console.warn(`[CMCHandler] processDatePlaceholder: Invalid number "${match[1]}" for valueToSubtract in placeholder "${placeholder}". Returning original.`);
//              return placeholder; // Return original on NaN
//         }
//     } else {
//         // Placeholder is just {{CURRENT_DATE}}
//         // console.log(`[DEBUG] processDatePlaceholder: Matched CURRENT_DATE (no offset).`);
//         resultDate = now;
//     }

//     const isoString = resultDate.toISOString();
//     // console.log(`[DEBUG] processDatePlaceholder: Returning ISO string: ${isoString}`);
//     return isoString;
// }
// // --- End Updated Helper Function ---


// // --- Main Handler ---
// async function handleCmcCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

//     console.log(`[CMCHandler] Query: "${userQuery}"`);
//     let thinkingMessage = null;
//     let fullResponseText = "";
//     let chartImageBuffer = null; // Variable to hold the chart image data
//     let plan = {}; // Define plan structure for error logging

//     try { // Outer try block
//         thinkingMessage = await message.reply("🤔 Planning request...");

//         // --- Step 1: AI Call #1 - Query Planning ---
//         console.log("[CMCHandler] Calling AI Planner/Classifier...");
//         const currentDate = new Date().toISOString().split('T')[0];
//         const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
//             .replace('{{CURRENT_DATE}}', currentDate)
//             .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

//         const plannerResponse = await aiHelper(plannerPrompt); // Non-streaming

//         try {
//             const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//             plan = JSON.parse(cleanedJsonResponse);
//             console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
//             if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan (missing 'query_type')."); }
//             if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
//         } catch (parseError) { console.error("PLAN PARSE ERROR:", parseError); throw new Error("AI Planner response was not valid JSON."); }


//         // --- Step 2: Route based on Classification ---
//         if (plan.query_type === "GENERAL_KNOWLEDGE") {
//             console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
//             await thinkingMessage.edit("💡 Answering general question...");
//             const directAnswerPrompt = `You are a helpful crypto assistant. Answer the user query accurately. **Be concise: Keep the response well under 2000 characters (aim for ~450 tokens max).**\n\nUser Query: "${userQuery}"`;
//             const stream = await aiHelper.getAIStream(directAnswerPrompt);
//             // (Standard stream processing logic - updates outer fullResponseText)
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
//                     const functionName = callInstruction.function;
//                     let params = { ...(callInstruction.params || {}) }; // CLONE params
//                     let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);

//                     // --- **START: Date Placeholder Processing** ---
//                     const dateParamKeys = ['time_start', 'time_end', 'date'];
//                     for (const key of dateParamKeys) {
//                         if (params[key] && typeof params[key] === 'string' && params[key].includes('{{CURRENT_DATE')) {
//                             const originalValue = params[key];
//                             const processedValue = processDatePlaceholder(params[key]); // Call updated helper
//                             if (processedValue !== originalValue) {
//                                 params[key] = processedValue;
//                                 console.log(`[CMCHandler] [SUCCESS] Processed date placeholder for '${key}'. New value: ${params[key]}`);
//                             } else {
//                                 console.warn(`[CMCHandler] [FAILURE] Failed to process date placeholder for '${key}'. Value remains: ${originalValue}`);
//                                 throw new Error(`Invalid or unprocessable date placeholder format: ${originalValue}`);
//                             }
//                         }
//                     }
//                     // --- **END: Date Placeholder Processing** ---

//                     console.log(`[CMCHandler] Executing planned call: ${functionName} with processed params: ${JSON.stringify(params)}`);

//                     // Check paid plan requirement
//                     if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest', 'getPricePerformanceStats', 'getOhlcvLatest', 'getDexPairsOhlcvHistorical'].includes(functionName)) {
//                         requiresPaidPlan = true; console.log(`[CMCHandler] Note: ${functionName} likely requires paid plan.`);
//                     }

//                     // Add network context if needed
//                     if (['getDexPairsQuotesLatest', 'getDexPairsOhlcvLatest', 'getDexPairsOhlcvHistorical', 'getDexPairsTradesLatest'].includes(functionName)) {
//                         if (!params.network_slug && !params.network_id) {
//                              console.log(`[CMCHandler] Network missing from AI plan for ${functionName}. Parsing query: "${userQuery}"`);
//                              const networkMatch = userQuery.match(/on\s+([a-zA-Z]+)/i);
//                              if (networkMatch && networkMatch[1]) {
//                                  const networkSlug = networkMatch[1].toLowerCase();
//                                  const slugMap = {'eth':'ethereum', 'poly':'polygon', 'matic':'polygon', 'bsc':'bsc', 'bnb':'bsc', 'avax': 'avalanche', 'sol': 'solana'};
//                                  params.network_slug = slugMap[networkSlug] || networkSlug;
//                                  console.log(`[CMCHandler] Added parsed network_slug: ${params.network_slug}`);
//                              } else {
//                                   console.warn(`[CMCHandler] Could not determine network for ${functionName}.`);
//                              }
//                          }
//                     } // End Network Handling

//                     // Execute CMC Call
//                     if (typeof cmc[functionName] === 'function') {
//                         try {
//                             let result = await cmc[functionName](params); // Use processed params
//                             fetchedCmcData[dataKey] = result;
//                             console.log(`[CMCHandler] SUCCESS calling ${functionName}`);
//                             // Store data needed for chart if this call was the source
//                             if (plan.chart_request?.data_source_key === dataKey) {
//                                 // Adjust data extraction based on expected OHLCV structure
//                                 // Example: Assuming result is { id: { quotes: [...] } } or just result = [...]
//                                 let potentialChartData = result[Object.keys(result)[0]]?.quotes || result; // Adapt this line based on actual API response structure for OHLCV
//                                 chartData = Array.isArray(potentialChartData) ? potentialChartData : null;

//                                 if (!chartData || chartData.length === 0) {
//                                     console.warn(`[CMCHandler] Fetched data for chart source key "${dataKey}" is empty or invalid.`);
//                                     plan.chart_request = null; // Disable chart if data is bad
//                                 } else {
//                                      console.log(`[CMCHandler] Stored ${chartData.length} data points for chart generation from key "${dataKey}".`);
//                                 }
//                             }
//                         } catch (cmcError) { throw cmcError; }
//                     } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); }
//                 } // End CMC call loop

//                 console.log("[CMCHandler] Fetched CMC Data Keys:", Object.keys(fetchedCmcData));

//                 // Safeguard: Force analysis if common data types were fetched without explicit request
//                 if (!plan.needs_analysis && (fetchedCmcData.latest_quotes || fetchedCmcData.historical_ohlcv || fetchedCmcData.historical_quotes || fetchedCmcData.global_metrics || fetchedCmcData.market_pairs_latest)) {
//                     console.log("[CMCHandler] Safeguard: Forcing 'needs_analysis' to TRUE for fetched data type.");
//                     plan.needs_analysis = true;
//                 }

//                 // --- **START: Chart Generation Logic** ---
//                 if (plan.chart_request && chartData) { // Check if chart requested AND data available
//                     await thinkingMessage.edit("🎨 Generating chart...");
//                      if (!chartGenerator || typeof chartGenerator.generatePriceVolumeChart !== 'function') {
//                           console.error("[CMCHandler] Chart Generator service not available or function missing.");
//                      } else {
//                           try {
//                               console.log(`[CMCHandler] Generating chart for symbol: ${chartSymbol}`);
//                               chartImageBuffer = await chartGenerator.generatePriceVolumeChart(chartSymbol, chartData); // Generate chart
//                               if (!chartImageBuffer) console.warn("[CMCHandler] Chart generation returned null buffer.");
//                               else console.log("[CMCHandler] Chart generated successfully.");
//                           } catch (chartError) {
//                               console.error("[CMCHandler] Chart generation process error:", chartError);
//                               // Don't stop execution, maybe add note later
//                           }
//                      }
//                 }
//                 // --- **END: Chart Generation Logic** ---

//                 // Step 4b: Final AI Analysis or Direct Formatting
//                 if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
//                     await thinkingMessage.edit("🤖 Synthesizing analysis...");
//                     const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
//                     console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));

//                     // Token Estimation
//                     let encoding; try { if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0) { throw new Error('Constructed analysis prompt is invalid.'); } encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(analysisPrompt).length; console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) { console.warn(`[CMCHandler] Analysis tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`); fullResponseText = `(Note: Data too large for full analysis.)\n\n`; } encoding.free(); } catch (tokenError) { console.error("[CMCHandler] Analysis Token error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating analysis tokens."); }

//                     // AI Call #2 - Streaming
//                     if (!fullResponseText.startsWith("(Note:")) {
//                        const stream = await aiHelper.getAIStream(analysisPrompt);
//                        // Stream processing
//                        let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";
//                     }

//                 } else if (Object.keys(fetchedCmcData).length > 0) { // Format raw data
//                      console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let data = fetchedCmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT*2) { data = data.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Top ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ data = `{${Object.keys(data).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;
//                 } else { fullResponseText = "Sorry, I couldn't retrieve relevant market data."; }
//             } // End block with calls

//         } else { throw new Error(`AI Planner unknown query_type: ${plan.query_type}`); }

//         // --- **START: Final Discord Message Update with Chart** ---
//         if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response.";
//         if (plan?.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }
//         if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000); // Ensure text fits

//         const finalReplyOptions = { content: fullResponseText, files: [] }; // Initialize files array

//         // Add the chart attachment IF it was generated
//         if (chartImageBuffer) {
//             const attachment = new AttachmentBuilder(chartImageBuffer, { name: `${chartSymbol || 'chart'}.png` });
//             finalReplyOptions.files.push(attachment); // Add attachment to files array
//              console.log(`[CMCHandler] Attaching generated chart "${attachment.name}" to the final reply.`);
//         } else if (plan.chart_request) {
//              console.log("[CMCHandler] Chart was requested but not generated (check logs for chartGenerator errors or missing data).");
//              // Optionally add a note to the user text that the chart couldn't be generated
//              // finalReplyOptions.content += "\n*(Note: Chart generation failed.)*";
//         }

//         await thinkingMessage.edit(finalReplyOptions); // Send reply with content and potentially files
//         // --- **END: Final Discord Message Update with Chart** ---


//     } catch (error) { // Catch top-level errors
//         console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
//         if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan)); // Log plan on error
//         const errorMsg = `Sorry, encountered an error: ${error.message}`;
//         // Ensure files array is empty on error reply
//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, files: [], components: [] }); } catch (e) { await message.reply(errorMsg); } }
//         else { await message.reply(errorMsg); }
//     } // End Outer Try/Catch
// } // End handleCmcCommand

// module.exports = { handleCmcCommand };

// commands/cmcHandler.js
const { get_encoding } = require('tiktoken');
// Ensure paths are correct based on your project structure
const cmc = require('../services/coinMarketCap');
const aiHelper = require('../services/aiHelper');
// const chartGenerator = require('../services/chartGenerator'); // Removed chartGenerator
// const { AttachmentBuilder } = require('discord.js'); // Removed AttachmentBuilder
const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts'); // Assuming prompts.js is in root

// --- Configuration ---
const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
const MAX_SYMBOLS_PER_QUERY = 10;

// --- Helper Functions ---
function extractSymbols(query, max = MAX_SYMBOLS_PER_QUERY) { /**/
    const potentialSymbols = query.toUpperCase().match(/\b([A-Z]{2,6})\b/g) || [];
    const commonWords = new Set(['A', 'AN', 'AND', 'THE', 'FOR', 'INFO', 'PRICE', 'QUOTE', 'VS', 'OR', 'TREND', 'MARKET', 'GLOBAL', 'DATA', 'DEX', 'CHART', 'ON']);
    const symbols = potentialSymbols.filter(s => !commonWords.has(s));
    if (symbols.length === 0) return null;
    return [...new Set(symbols)].slice(0, max);
}
function extractSlugs(query, max = 1) { /**/
     const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
     const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart', 'on']);
     const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
     if(slugs.length === 0) return null;
     return [...new Set(slugs)].slice(0, max);
}
// Helper to build the final analysis prompt
const constructCmcAnalysisPrompt = (cmcData, query) => { /**/
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

// Helper Function to Process Date Placeholders
function processDatePlaceholder(placeholder) { /**/
    const now = new Date();
    const match = placeholder.match(/{{CURRENT_DATE(?:_minus_(\d+)([dhDH]))?}}/i);
    if (!match) { return placeholder; }
    let resultDate;
    if (match[1] && match[2]) {
        const valueToSubtract = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (!isNaN(valueToSubtract)) {
            resultDate = new Date(now);
            if (unit === 'd') { resultDate.setDate(resultDate.getDate() - valueToSubtract); }
            else if (unit === 'h') { resultDate.setHours(resultDate.getHours() - valueToSubtract); }
            else { console.warn(`[CMCHandler] processDatePlaceholder: Unknown unit "${unit}"...`); return placeholder; }
        } else { console.warn(`[CMCHandler] processDatePlaceholder: Invalid number "${match[1]}"...`); return placeholder; }
    } else { resultDate = new Date(now); }
    if (resultDate instanceof Date && !isNaN(resultDate.getTime())) { return resultDate.toISOString(); }
    else { console.error(`[CMCHandler] processDatePlaceholder: resultDate invalid...`); return placeholder; }
}

// --- **NEW** Helper Function to create TradingView symbol ---
function getTradingViewSymbol(symbol) {
    // Simple mapping - choose a default exchange or make it smarter
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return null;

    // You MUST refine this mapping based on common pairs and desired exchanges
    const commonPairs = {
        'BTC': 'BINANCE:BTCUSDT',
        'ETH': 'BINANCE:ETHUSDT',
        'SOL': 'BINANCE:SOLUSDT',
        'XRP': 'BINANCE:XRPUSDT',
        'ADA': 'BINANCE:ADAUSDT',
        'DOGE': 'BINANCE:DOGEUSDT',
        // Add more common mappings
    };

    if (commonPairs[upperSymbol]) {
        return commonPairs[upperSymbol];
    }

    // Generic fallback (might not always work)
    console.warn(`[CMCHandler] No specific TradingView map found for ${upperSymbol}, using generic BINANCE:${upperSymbol}USDT`);
    return `BINANCE:${upperSymbol}USDT`;
}
// --- End New Helper Function ---


// --- Main Handler ---
async function handleCmcCommand(message, userQuery) { /**/
    if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

    console.log(`[CMCHandler] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = "";
    // let chartImageBuffer = null; // Removed: No longer generating image buffer
    let plan = {};
    let tradingViewLink = null; // <-- Added variable for the link

    try {
        thinkingMessage = await message.reply("🤔 Planning request...");

        // --- Step 1: AI Call #1 - Query Planning ---
        console.log("[CMCHandler] Calling AI Planner/Classifier...");
        const currentDate = new Date().toISOString().split('T')[0];
        const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
            .replace('{{CURRENT_DATE}}', currentDate)
            .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));
        const plannerResponse = await aiHelper(plannerPrompt);
        try {
            const cleanedJsonResponse = plannerResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            plan = JSON.parse(cleanedJsonResponse);
            console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
            if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan (missing 'query_type')."); }
            if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
        } catch (parseError) { console.error("PLAN PARSE ERROR:", parseError); throw new Error("AI Planner response was not valid JSON."); }


        // --- Step 2: Route based on Classification ---
        if (plan.query_type === "GENERAL_KNOWLEDGE") {
            // ... (General Knowledge handling - unchanged) ...
             console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
            await thinkingMessage.edit("💡 Answering general question...");
            const directAnswerPrompt = `You are a helpful crypto assistant. Answer the user query accurately. **Be concise: Keep the response well under 2000 characters (aim for ~450 tokens max).**\n\nUser Query: "${userQuery}"`;
            const stream = await aiHelper.getAIStream(directAnswerPrompt);
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
                // let chartData = null; // Removed: No longer needed for generation
                let requiresPaidPlan = false;

                for (const callInstruction of plan.calls) {
                    const functionName = callInstruction.function;
                    let params = { ...(callInstruction.params || {}) };
                    let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);

                    // --- Date Placeholder Processing ---
                    // ... (Date processing logic - unchanged) ...
                     const dateParamKeys = ['time_start', 'time_end', 'date'];
                    for (const key of dateParamKeys) {
                         if (params[key] && typeof params[key] === 'string' && params[key].includes('{{CURRENT_DATE')) {
                            const originalValue = params[key];
                            const processedValue = processDatePlaceholder(params[key]);
                            if (processedValue !== originalValue && typeof processedValue === 'string' && processedValue.includes('T') && processedValue.includes('Z')) {
                                 params[key] = processedValue;
                                 console.log(`[CMCHandler] [SUCCESS] Processed date placeholder for '${key}'. New value: ${params[key]}`);
                            } else {
                                 console.warn(`[CMCHandler] [FAILURE] Failed to process date placeholder for '${key}'. Helper returned: "${processedValue}", Value remains: "${originalValue}"`);
                                 throw new Error(`Invalid or unprocessable date placeholder format/result: ${originalValue} -> ${processedValue}`);
                            }
                         }
                    }

                    console.log(`[CMCHandler] Executing planned call: ${functionName} with processed params: ${JSON.stringify(params)}`);

                    // Check paid plan requirement
                     if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest', 'getPricePerformanceStats', 'getOhlcvLatest', 'getDexPairsOhlcvHistorical'].includes(functionName)) {
                        requiresPaidPlan = true; console.log(`[CMCHandler] Note: ${functionName} likely requires paid plan.`);
                    }


                    // Add network context if needed
                    // ... (Network context logic - unchanged) ...
                    if (['getDexPairsQuotesLatest', 'getDexPairsOhlcvLatest', 'getDexPairsOhlcvHistorical', 'getDexPairsTradesLatest'].includes(functionName)) {
                        if (!params.network_slug && !params.network_id) {
                             console.log(`[CMCHandler] Network missing from AI plan for ${functionName}. Parsing query: "${userQuery}"`);
                             const networkMatch = userQuery.match(/on\s+([a-zA-Z]+)/i);
                             if (networkMatch && networkMatch[1]) {
                                 const networkSlug = networkMatch[1].toLowerCase();
                                 const slugMap = {'eth':'ethereum', 'poly':'polygon', 'matic':'polygon', 'bsc':'bsc', 'bnb':'bsc', 'avax': 'avalanche', 'sol': 'solana'};
                                 params.network_slug = slugMap[networkSlug] || networkSlug;
                                 console.log(`[CMCHandler] Added parsed network_slug: ${params.network_slug}`);
                             } else {
                                  console.warn(`[CMCHandler] Could not determine network for ${functionName}.`);
                             }
                         }
                    } // End Network Handling

                    // Execute CMC Call
                    if (typeof cmc[functionName] === 'function') {
                        try {
                            let result = await cmc[functionName](params);
                            fetchedCmcData[dataKey] = result;
                            console.log(`[CMCHandler] SUCCESS calling ${functionName}`);
                            // We no longer need to extract chartData here for generation
                        } catch (cmcError) {
                             console.error(`[CMCHandler] Error during CMC call ${functionName}:`, cmcError);
                             throw cmcError; // Rethrow
                        }
                    } else { throw new Error(`AI Planner requested invalid function: ${functionName}`); }
                } // End CMC call loop

                console.log("[CMCHandler] Fetched CMC Data Keys:", Object.keys(fetchedCmcData));

                // --- **START: Generate TradingView Link if Chart Requested** ---
                if (plan.chart_request && chartSymbol) {
                    const tvSymbol = getTradingViewSymbol(chartSymbol); // Use the helper
                    if (tvSymbol) {
                        tradingViewLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
                        console.log(`[CMCHandler] Generated TradingView link: ${tradingViewLink}`);
                    } else {
                        console.warn(`[CMCHandler] Could not generate TradingView symbol for: ${chartSymbol}`);
                        // Optionally add note for user if link fails?
                        // fullResponseText += "\n*(Note: Could not generate TradingView link for symbol)*";
                    }
                }
                // --- **END: Generate TradingView Link** ---


                // ... (Safeguard - unchanged) ...
                if (!plan.needs_analysis && (fetchedCmcData.latest_quotes || fetchedCmcData.historical_ohlcv || fetchedCmcData.historical_quotes || fetchedCmcData.global_metrics || fetchedCmcData.market_pairs_latest)) {
                    console.log("[CMCHandler] Safeguard: Forcing 'needs_analysis' to TRUE for fetched data type.");
                    plan.needs_analysis = true;
                }

                // --- Chart Generation Logic Removed ---

                // Step 4b: Final AI Analysis or Direct Formatting
                if (plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
                    // ... (AI analysis call - unchanged, uses fetchedCmcData) ...
                    await thinkingMessage.edit("🤖 Synthesizing analysis...");
                    const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
                    if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0 || analysisPrompt.includes("undefined")) {
                         console.error("[CMCHandler] Constructed analysis prompt is invalid. Skipping AI analysis.", analysisPrompt.substring(0,500));
                         fullResponseText = "Error: Could not construct valid analysis prompt from fetched data.";
                    } else {
                        console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));
                        // Token Estimation
                        let encoding; try { encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(analysisPrompt).length; console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) { console.warn(`[CMCHandler] Analysis tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`); fullResponseText = `(Note: Data too large for full analysis.)\n\n`; } encoding.free(); } catch (tokenError) { console.error("[CMCHandler] Analysis Token error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating analysis tokens."); }

                        // AI Call #2 - Streaming
                        if (!fullResponseText.startsWith("(Note:")) {
                           const stream = await aiHelper.getAIStream(analysisPrompt);
                           // Stream processing
                           let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";
                        }
                    } // End else block for valid prompt

                } else if (Object.keys(fetchedCmcData).length > 0) { // Format raw data
                    // ... (Direct formatting - unchanged) ...
                     console.log("[CMCHandler] Formatting direct response (no analysis)."); let directResponse = `Data for "${userQuery}":\n`; for (const key in fetchedCmcData) { let data = fetchedCmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT*2) { data = data.slice(0, AI_SUMMARIZE_LIMIT*2); note=` (Top ${AI_SUMMARIZE_LIMIT*2})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT*4 && key !== 'global_metrics'){ data = `{${Object.keys(data).length} keys}`; note=` (Truncated)`;} directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;

                } else { fullResponseText = "Sorry, I couldn't retrieve relevant market data."; }


            } // End block with calls

        } else { throw new Error(`AI Planner unknown query_type: ${plan.query_type}`); }

        // --- Final Discord Message Update ---
        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response.";
        if (plan?.needs_analysis && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }

        // **Append TradingView Link**
        if (tradingViewLink) {
            const linkText = `\n\nView interactive chart: <${tradingViewLink}>`; // Use angle brackets
            // Check length before appending
            if (fullResponseText.length + linkText.length <= 2000) {
                fullResponseText += linkText;
            } else {
                 console.warn("[CMCHandler] Response text too long to append TradingView link.");
                 // Optionally try to shorten fullResponseText first
                 // Or just omit the link if too long
            }
        }

        if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000); // Final trim

        // **Remove files array from options**
        const finalReplyOptions = { content: fullResponseText };

        await thinkingMessage.edit(finalReplyOptions);
        // --- End Final Discord Message Update ---


    } catch (error) { // Catch top-level errors
        console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
        if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan));
        const errorMsg = `Sorry, encountered an error: ${error.message}`;
        // Ensure files array is empty on error reply
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, files: [], components: [] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
    } // End Outer Try/Catch
} // End handleCmcCommand

module.exports = { handleCmcCommand };