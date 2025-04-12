// // commands/cmcHandler.js
// const { get_encoding } = require('tiktoken');
// const cmc = require('../services/coinMarketCap');
// const aiHelper = require('../services/aiHelper'); // Uses unified AI helper now
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
//     const potentialSlugs = query.toLowerCase().match(/\b([a-z]{3,}(?:-[a-z]+)*)\b/g) || [];
//     const common = new Set(['info','quote','price','trend','market','global','data','tell','me','of','the','is','what','show','get','and','compare', 'chart', 'on']);
//     const slugs = potentialSlugs.filter(s => !common.has(s) && s.length > 2);
//     if(slugs.length === 0) return null;
//     return [...new Set(slugs)].slice(0, max);
// }

// // Helper to build the final analysis prompt
// const constructCmcAnalysisPrompt = (cmcData, query) => {
//     if (!cmcData || typeof cmcData !== 'object') {
//         console.warn("[constructCmcAnalysisPrompt] Invalid cmcData:", cmcData);
//         return `You are an AI assistant. User asked "${query}". Error retrieving structured data. Inform user.`;
//     }
//     let prompt = `You are an AI assistant crypto analyst.\nUser question: "${query}"\n\nUse this CMC data:\n`;
//     try {
//         for (const key in cmcData) {
//             if (cmcData[key]) {
//                 let data = cmcData[key];
//                 let note = '';
//                 if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT) {
//                     data = data.slice(0, AI_SUMMARIZE_LIMIT);
//                     note = ` (Top ${AI_SUMMARIZE_LIMIT})`;
//                 } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT * 4 && key !== 'global_metrics') {
//                     data = `{${Object.keys(data).length} keys}`;
//                     note = ` (Truncated)`;
//                 }
//                 prompt += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
//             }
//         }
//         prompt += `\nAnalysis Task: Based *only* on provided data, answer user query. **Be concise (<450 tokens / ~1800 chars).** Summarize key points. If asked for price, state price clearly. IMPORTANT: Conclude with '(Disclaimer: NOT financial advice.)'"`;
//     } catch (stringifyError) {
//         console.error("[constructCmcAnalysisPrompt] Stringify Error:", stringifyError);
//         // Provide a user-facing error message *without* the prefix here, caller will add prefix
//         prompt = `User asked "${query}". Error formatting market data for analysis. Inform user.`;
//     }
//     return prompt;
// };

// // Helper Function to Process Date Placeholders
// function processDatePlaceholder(placeholder) {
//     const now = new Date();
//     const match = placeholder.match(/{{CURRENT_DATE(?:_minus_(\d+)([dhDH]))?}}/i);
//     if (!match) { return placeholder; }
//     let resultDate;
//     if (match[1] && match[2]) {
//         const valueToSubtract = parseInt(match[1], 10);
//         const unit = match[2].toLowerCase();
//         if (!isNaN(valueToSubtract)) {
//             resultDate = new Date(now);
//             if (unit === 'd') { resultDate.setDate(resultDate.getDate() - valueToSubtract); }
//             else if (unit === 'h') { resultDate.setHours(resultDate.getHours() - valueToSubtract); }
//             else { console.warn(`[CMCHandler] processDatePlaceholder: Unknown unit "${unit}"...`); return placeholder; }
//         } else { console.warn(`[CMCHandler] processDatePlaceholder: Invalid number "${match[1]}"...`); return placeholder; }
//     } else { resultDate = new Date(now); }
//     if (resultDate instanceof Date && !isNaN(resultDate.getTime())) { return resultDate.toISOString(); }
//     else { console.error(`[CMCHandler] processDatePlaceholder: resultDate invalid...`); return placeholder; }
// }

// // Helper Function to create TradingView symbol
// function getTradingViewSymbol(symbol) {
//     const upperSymbol = symbol?.toUpperCase();
//     if (!upperSymbol) return null;
//     // Basic examples - expand as needed
//     const commonPairs = {
//         'BTC': 'BINANCE:BTCUSDT', 'ETH': 'BINANCE:ETHUSDT', 'SOL': 'BINANCE:SOLUSDT',
//         'XRP': 'BINANCE:XRPUSDT', 'ADA': 'BINANCE:ADAUSDT', 'DOGE': 'BINANCE:DOGEUSDT',
//         // Add more common mappings...
//     };
//     if (commonPairs[upperSymbol]) { return commonPairs[upperSymbol]; }
//     // Generic fallback
//     console.warn(`[CMCHandler] No specific TradingView map for ${upperSymbol}, using generic BINANCE:${upperSymbol}USDT`);
//     return `BINANCE:${upperSymbol}USDT`;
// }

// // Helper to format numbers nicely (e.g., Billion/Trillion)
// function formatLargeNumber(num) {
//     if (num === null || num === undefined) return 'N/A';
//     if (Math.abs(num) >= 1e12) { return `$${(num / 1e12).toFixed(2)}T`; }
//     if (Math.abs(num) >= 1e9) { return `$${(num / 1e9).toFixed(2)}B`; }
//     if (Math.abs(num) >= 1e6) { return `$${(num / 1e6).toFixed(2)}M`; }
//     return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// }

// // Helper to format percentage change
// function formatPercent(num) {
//     if (num === null || num === undefined) return 'N/A';
//     return `${num.toFixed(2)}%`;
// }

// // --- **NEW** Helper to Format Price Response (Req 5) ---
// function formatPriceResponse(quoteData, metadata) {
//     if (!quoteData || !quoteData.quote?.USD) {
//         console.warn("[formatPriceResponse] Missing quote or USD data.");
//         return null; // Cannot format
//     }

//     const usd = quoteData.quote.USD;
//     const name = metadata?.name || quoteData.name || 'N/A';
//     const symbol = quoteData.symbol || 'N/A';
//     const rank = quoteData.cmc_rank || 'N/A';
//     const price = usd.price;
//     // Check CMC API documentation for exact field names for high_24h, low_24h, ath, percent_change_from_ath
//     // Examples: usd.volume_change_24h, quoteData.ath, quoteData.atl
//     const high24h = quoteData.quote?.USD?.high_24h; // EXAMPLE - VERIFY FIELD NAME
//     const low24h = quoteData.quote?.USD?.low_24h;   // EXAMPLE - VERIFY FIELD NAME
//     const pct1h = usd.percent_change_1h;
//     const pct24h = usd.percent_change_24h;
//     const pct7d = usd.percent_change_7d;
//     const pct30d = usd.percent_change_30d;
//     const vol24h = usd.volume_24h;
//     const mktCap = usd.market_cap;
//     const athPrice = quoteData.ath; // EXAMPLE - VERIFY FIELD NAME
//     const athPctChange = quoteData.ath_change_percentage; // EXAMPLE - VERIFY FIELD NAME

//     // Placeholder for ETH conversion - requires fetching ETH price separately
//     const ethConversion = 'N/A';

//     let response = `${name} - $${symbol} [${rank}] Price: ${formatLargeNumber(price)}\n`;
//     // Ensure you have the correct symbols (₿ for BTC, Ξ for ETH) or use text (BTC, ETH)
//     response += `⤷ ₿ 1.00 | Ξ ${ethConversion} `; // Assuming 1 BTC for example base
//     response += `H/L: ${formatLargeNumber(high24h)} | ${formatLargeNumber(low24h)} `;
//     response += `1h: ${formatPercent(pct1h)} 24h: ${formatPercent(pct24h)} 7d: ${formatPercent(pct7d)} 30d: ${formatPercent(pct30d)} `;
//     response += `ATH: ${formatLargeNumber(athPrice)} (${formatPercent(athPctChange)}) `;
//     response += `24h Vol: ${formatLargeNumber(vol24h)} MCap: ${formatLargeNumber(mktCap)}`;

//     return response;
// }

// // --- **NEW** Helper to Format "Statistics" Response (Req 4) ---
// function formatStatisticsResponse(quoteData, metadata) {
//     if (!quoteData || !quoteData.quote?.USD) {
//         console.warn("[formatStatisticsResponse] Missing quote or USD data.");
//         return null; // Cannot format
//     }
//     const usd = quoteData.quote.USD;
//     const name = metadata?.name || quoteData.name || 'N/A';
//     const symbol = quoteData.symbol || 'N/A';
//     const rank = quoteData.cmc_rank || 'N/A';

//     let response = `**${name} (${symbol}) - Rank #${rank}**\n`;
//     response += ` • Price: ${formatLargeNumber(usd.price)}\n`;
//     response += ` • Change (1h): ${formatPercent(usd.percent_change_1h)}\n`;
//     response += ` • Change (24h): ${formatPercent(usd.percent_change_24h)}\n`;
//     response += ` • Change (7d): ${formatPercent(usd.percent_change_7d)}\n`;
//     response += ` • Change (30d): ${formatPercent(usd.percent_change_30d)}\n`;
//     response += ` • Volume (24h): ${formatLargeNumber(usd.volume_24h)}\n`;
//     response += ` • Market Cap: ${formatLargeNumber(usd.market_cap)}\n`;
//     response += ` • Fully Diluted MCap: ${formatLargeNumber(usd.fully_diluted_market_cap)}\n`;
//     if (usd.market_cap_dominance !== undefined) {
//         response += ` • Dominance: ${formatPercent(usd.market_cap_dominance)}\n`;
//     }
//     if (quoteData.circulating_supply !== undefined && quoteData.total_supply !== undefined) {
//         response += ` • Supply: ${quoteData.circulating_supply?.toLocaleString() || 'N/A'} / ${quoteData.total_supply?.toLocaleString() || 'N/A'}\n`;
//     }
//     if (quoteData.max_supply !== undefined) {
//         response += ` • Max Supply: ${quoteData.max_supply?.toLocaleString() || 'N/A'}\n`;
//     }
//     response += ` • Last Updated: ${usd.last_updated ? new Date(usd.last_updated).toLocaleString() : 'N/A'}`;
//     // Add more fields as available and relevant from the quoteData object

//     return response;
// }


// // --- Main Handler ---
// async function handleCmcCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

//     console.log(`[CMCHandler] Query: "${userQuery}"`);
//     let thinkingMessage = null;
//     let fullResponseText = "";
//     let tradingViewLink = null;
//     let plan = {};
//     let finalReplyOptions = {}; // Define options object

//     try {
//         thinkingMessage = await message.reply("🤔 Planning request...");

//         // --- Step 1: AI Call #1 - Query Planning ---
//         console.log("[CMCHandler] Calling AI Planner/Classifier...");
//         const currentDate = new Date().toISOString().split('T')[0];
//         const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
//             .replace('{{CURRENT_DATE}}', currentDate)
//             .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));

//         const plannerResponse = await aiHelper.getAIResponse(plannerPrompt); // Use non-streaming for planning

//         try {
//             // More robust JSON extraction
//             let jsonString = null;
//             const jsonMatch = plannerResponse.match(/```json\s*([\s\S]*?)\s*```/); // Extract from markdown code block first
//             if (jsonMatch && jsonMatch[1]) {
//                 jsonString = jsonMatch[1];
//             } else {
//                 // Fallback: try to find JSON starting with { and ending with }
//                 const simpleMatch = plannerResponse.match(/\{.*\}/s);
//                 if (simpleMatch) {
//                     jsonString = simpleMatch[0];
//                 }
//             }

//             if (!jsonString) {
//                  throw new Error("No JSON object found in planner response.");
//             }

//             plan = JSON.parse(jsonString);

//             console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
//             if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan (missing 'query_type')."); }
//             if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
//         } catch (parseError) {
//             console.error("PLAN PARSE ERROR:", parseError, "\nRaw Response:", plannerResponse);
//             // Use the AI error prefix (DS/GE) from the getAIResponse error if available
//             const aiPrefix = plannerResponse.startsWith('[DS]') ? '[DS]' : (plannerResponse.startsWith('[GE]') ? '[GE]' : '');
//             throw new Error(`${aiPrefix} AI Planner response was not valid JSON or caused error: ${parseError.message}`.trim());
//         }


//         // --- Step 2: Route based on Classification ---
//         if (plan.query_type === "GENERAL_KNOWLEDGE") {
//             console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
//             await thinkingMessage.edit(`🧠 Answering general question with ${process.env.AI_PROVIDER}...`);
//             // Use streaming for general answers
//             const directAnswerPrompt = `You are a helpful crypto assistant. Answer the user query accurately. **Be concise: Keep the response well under 2000 characters (aim for ~450 tokens max).**\n\nUser Query: "${userQuery}"`;
//             const stream = aiHelper.getAIStream(directAnswerPrompt); // Use unified stream helper
//             let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null;
//             try {
//                 for await (const chunk of stream) {
//                     const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
//                     if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
//                         fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
//                         if (currentEditText.length <= 2000) {
//                             try { await thinkingMessage.edit(currentEditText); lastEditTime = now; }
//                             catch (e) { console.error("Edit error:", e.message); /* Continue stream */ }
//                         } else {
//                              console.warn("Truncating general knowledge stream.");
//                              fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)";
//                              try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){}
//                              break; // Stop stream processing
//                         }
//                     }
//                 }
//                 fullResponseText += accumulatedChunk; // Add any remaining part
//             } catch (error) {
//                 console.error("Error DURING General Knowledge AI stream:", error);
//                 streamError = error.message; // Contains prefix DS/GE
//             }
//             if (streamError) { fullResponseText = `Error getting answer: ${streamError}`; }
//             else if (fullResponseText.length === 0) { fullResponseText = "AI returned empty response for general query."; }

//         } else if (plan.query_type === "CMC_DATA_NEEDED") {
//             console.log("[CMCHandler] Query classified as CMC Data Needed.");
//             if (!plan.calls || plan.calls.length === 0) {
//                 console.warn("[CMCHandler] AI Planner requested CMC data but provided no calls.");
//                 fullResponseText = "I understood you need market data, but couldn't determine which specific data to fetch. Can you be more specific?";
//             } else {
//                 await thinkingMessage.edit("📊 Fetching market data...");
//                 let fetchedCmcData = {};
//                 let chartSymbol = plan.chart_request?.symbol || null;
//                 let requiresPaidPlan = false;
//                 let fetchedMetadata = {}; // Store metadata separately if needed for formatting

//                 for (const callInstruction of plan.calls) {
//                     const functionName = callInstruction.function;
//                     let params = { ...(callInstruction.params || {}) };
//                     let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);

//                     // --- Date Placeholder Processing ---
//                     const dateParamKeys = ['time_start', 'time_end', 'date'];
//                     for (const key of dateParamKeys) {
//                         if (params[key] && typeof params[key] === 'string' && params[key].includes('{{CURRENT_DATE')) {
//                             const originalValue = params[key];
//                             const processedValue = processDatePlaceholder(params[key]);
//                             if (processedValue !== originalValue && typeof processedValue === 'string' && processedValue.includes('T') && processedValue.includes('Z')) {
//                                 params[key] = processedValue;
//                                 console.log(`[CMCHandler] Processed date placeholder for '${key}'. New value: ${params[key]}`);
//                             } else {
//                                 console.warn(`[CMCHandler] Failed to process date placeholder for '${key}'. Helper returned: "${processedValue}", Value remains: "${originalValue}"`);
//                                 throw new Error(`[System] Invalid or unprocessable date placeholder format/result: ${originalValue} -> ${processedValue}`); // System prefix
//                             }
//                         }
//                     }

//                     console.log(`[CMCHandler] Executing planned call: ${functionName} with processed params: ${JSON.stringify(params)}`);
//                     // Check paid plan requirement
//                     if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest', 'getPricePerformanceStats', 'getOhlcvLatest', 'getDexPairsOhlcvHistorical'].includes(functionName)) {
//                         requiresPaidPlan = true;
//                         console.log(`[CMCHandler] Note: ${functionName} likely requires paid plan.`);
//                     }

//                     // Add network context if needed for DEX calls
//                     if (['getDexPairsQuotesLatest', 'getDexPairsOhlcvLatest', 'getDexPairsOhlcvHistorical', 'getDexPairsTradesLatest'].includes(functionName)) {
//                         if (!params.network_slug && !params.network_id) {
//                             console.log(`[CMCHandler] Network missing from AI plan for ${functionName}. Parsing query: "${userQuery}"`);
//                             const networkMatch = userQuery.match(/on\s+([a-zA-Z]+)/i);
//                             if (networkMatch && networkMatch[1]) {
//                                 const networkSlug = networkMatch[1].toLowerCase();
//                                 const slugMap = {'eth':'ethereum', 'poly':'polygon', 'matic':'polygon', 'bsc':'bsc', 'bnb':'bsc', 'avax': 'avalanche', 'sol': 'solana'};
//                                 params.network_slug = slugMap[networkSlug] || networkSlug;
//                                 console.log(`[CMCHandler] Added parsed network_slug: ${params.network_slug}`);
//                             } else {
//                                 console.warn(`[CMCHandler] Could not determine network for ${functionName}.`);
//                             }
//                         }
//                     }

//                     // Execute CMC Call
//                     if (typeof cmc[functionName] === 'function') {
//                         try {
//                             let result = await cmc[functionName](params);
//                             fetchedCmcData[dataKey] = result;
//                             // Store metadata separately if fetched
//                             if (functionName === 'getMetadata' && result) {
//                                 // CMC returns metadata keyed by ID, symbol, or slug. Normalize it.
//                                 const keys = Object.keys(result);
//                                 if (keys.length > 0) {
//                                     // If multiple IDs/symbols were requested, store metadata for each
//                                     keys.forEach(key => {
//                                         const cryptoData = result[key];
//                                         if (cryptoData) {
//                                              // Store by symbol (uppercase) for easier lookup later
//                                              fetchedMetadata[cryptoData.symbol.toUpperCase()] = cryptoData;
//                                              // Also maybe by slug?
//                                              if(cryptoData.slug) fetchedMetadata[cryptoData.slug] = cryptoData;
//                                         }
//                                     });
//                                 }
//                             }
//                             console.log(`[CMCHandler] SUCCESS calling ${functionName}`);
//                         } catch (cmcError) {
//                             console.error(`[CMCHandler] Error during CMC call ${functionName}:`, cmcError);
//                             // Error should already have [CMC] prefix from helper
//                             throw cmcError; // Rethrow
//                         }
//                     } else { throw new Error(`[System] AI Planner requested invalid function: ${functionName}`); } // System prefix
//                 } // End CMC call loop

//                 console.log("[CMCHandler] Fetched CMC Data Keys:", Object.keys(fetchedCmcData));
//                 // console.log("[CMCHandler] Fetched Metadata Keys:", Object.keys(fetchedMetadata)); // Debug log

//                 // --- Generate TradingView Link if Chart Requested ---
//                 if (plan.chart_request && chartSymbol) {
//                     const tvSymbol = getTradingViewSymbol(chartSymbol);
//                     if (tvSymbol) {
//                         tradingViewLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
//                         console.log(`[CMCHandler] Generated TradingView link: ${tradingViewLink}`);
//                     } else {
//                         console.warn(`[CMCHandler] Could not generate TradingView symbol for: ${chartSymbol}`);
//                     }
//                 }

//                 // --- **NEW** Price Formatting Logic ---
//                 let formattedPriceResponse = null;
//                 const isOnlyQuoteCall = plan.calls.length === 1 && plan.calls[0].function === 'getLatestQuotes';
//                 // More robust check for price-only queries
//                 const queryLooksLikePriceOnly = /^\s*((price|quote|cost|value)\s+(of\s+)?|what('?s| is) the price of)\s*([A-Z]{2,6}(?:,\s*[A-Z]{2,6})*)\s*(\?*)$/i.test(userQuery.trim());
//                 const quoteDataResult = fetchedCmcData.latest_quotes; // Data from getLatestQuotes

//                 if (isOnlyQuoteCall && quoteDataResult) {
//                     // Extract the first symbol's data for formatting (handle multiple if needed?)
//                     const symbolsRequested = plan.calls[0]?.params?.symbol?.split(',') || plan.calls[0]?.params?.slug?.split(',') || Object.keys(quoteDataResult);
//                     if (symbolsRequested && symbolsRequested.length > 0) {
//                         const firstSymbol = symbolsRequested[0].trim().toUpperCase(); // Use symbol from params if possible

//                         // **Handle CMC returning array for symbol**
//                         let dataToFormat = null;
//                         if (Array.isArray(quoteDataResult[firstSymbol])) {
//                              console.warn(`[CMCHandler] CMC returned array for symbol ${firstSymbol}. Using first element.`);
//                              dataToFormat = quoteDataResult[firstSymbol][0];
//                         } else {
//                              dataToFormat = quoteDataResult[firstSymbol];
//                         }

//                         // Lookup metadata using the symbol key we just determined
//                         const metadataForFormat = fetchedMetadata[firstSymbol];

//                         if (dataToFormat) {
//                             if (queryLooksLikePriceOnly) {
//                                 console.log("[CMCHandler] Applying specific price format (Req 5).");
//                                 formattedPriceResponse = formatPriceResponse(dataToFormat, metadataForFormat);
//                             } else {
//                                 console.log("[CMCHandler] Applying statistics format (Req 4).");
//                                 formattedPriceResponse = formatStatisticsResponse(dataToFormat, metadataForFormat);
//                             }
//                             if (formattedPriceResponse) {
//                                 plan.needs_analysis = false; // Override AI analysis if formatting is successful
//                                 console.log("[CMCHandler] Using pre-formatted price response, skipping AI analysis.");
//                                 fullResponseText = formattedPriceResponse; // Set the response text directly
//                             } else {
//                                 console.warn("[CMCHandler] Formatting function returned null, will proceed to AI analysis if planned.");
//                             }
//                         } else {
//                             console.warn(`[CMCHandler] Could not find quote data for symbol ${firstSymbol} in the fetched data.`);
//                         }
//                     } else {
//                         console.warn("[CMCHandler] Could not determine symbol from plan parameters for formatting.");
//                     }
//                 }
//                 // --- End Price Formatting Logic ---

//                 // --- Final AI Analysis or Direct Formatting (only if not handled by price formatting above) ---
//                 if (!formattedPriceResponse && plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) {
//                     await thinkingMessage.edit(`🧠 Synthesizing analysis with ${process.env.AI_PROVIDER}...`);
//                     const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);

//                     if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0 || analysisPrompt.includes("Error formatting market data")) {
//                         console.error("[CMCHandler] Constructed analysis prompt is invalid or indicates formatting error. Skipping AI analysis.", analysisPrompt ? analysisPrompt.substring(0,500): 'NULL');
//                         // Use System prefix for this internal error
//                         fullResponseText = "[System] Error: Could not construct valid analysis prompt from fetched data.";
//                     } else {
//                         console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200));
//                         // Token Estimation
//                         let encoding;
//                         try {
//                             encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(analysisPrompt).length; console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`);
//                             if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) { console.warn(`[CMCHandler] Analysis tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`); fullResponseText = `(Note: Data too large for full analysis by AI.)\n\n`; } encoding.free();
//                         } catch (tokenError) {
//                              if(encoding) encoding.free();
//                              console.error("[CMCHandler] Analysis Token error:", tokenError);
//                              throw new Error("[System] Error estimating analysis tokens."); // System prefix
//                         }

//                         // AI Call #2 - Streaming (only if prompt is valid and no truncation note set)
//                         if (!fullResponseText.startsWith("(Note:")) {
//                             const stream = aiHelper.getAIStream(analysisPrompt); // Use unified helper
//                             let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null;
//                             try {
//                                 for await (const chunk of stream) {
//                                     const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
//                                     if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
//                                         fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
//                                         if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } else { console.warn("Truncating analysis stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
//                                     }
//                                 }
//                                 fullResponseText += accumulatedChunk;
//                             } catch (error) {
//                                 console.error("Error DURING Analysis AI stream:", error);
//                                 streamError = error.message; // Contains DS/GE prefix
//                             }
//                             if (streamError) { fullResponseText = `Error during analysis: ${streamError}`; }
//                             else if (fullResponseText.length === 0) { fullResponseText = "AI analysis returned empty response."; }
//                         }
//                     } // End else block for valid prompt

//                 } else if (!formattedPriceResponse && Object.keys(fetchedCmcData).length > 0) { // Format raw data if no analysis needed/possible AND not handled by price formatting
//                     console.log("[CMCHandler] Formatting direct response (no analysis needed or possible, and not price-formatted).");
//                     let directResponse = `**Data for "${userQuery}"**:\n`;
//                     for (const key in fetchedCmcData) {
//                         let data = fetchedCmcData[key];
//                         let note = '';
//                         if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT * 2) { data = data.slice(0, AI_SUMMARIZE_LIMIT * 2); note = ` (Top ${AI_SUMMARIZE_LIMIT * 2})`; }
//                          else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT * 4 && key !== 'global_metrics') { data = `{${Object.keys(data).length} keys}`; note = ` (Truncated)`; }
//                         directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`;
//                         directResponse += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n";
//                     }
//                     if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)";
//                     fullResponseText = directResponse;
//                 } else if (!formattedPriceResponse) { // Only show this if no data AND no formatted price response
//                     // This case means CMC calls were planned but returned no data or failed silently before throwing.
//                     fullResponseText = "Sorry, I couldn't retrieve the requested market data.";
//                 }
//             } // End block with calls

//         } else { throw new Error(`[System] AI Planner returned unknown query_type: ${plan.query_type}`); } // System prefix


//         // --- Final Discord Message Update ---
//         if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response.";
//         // Add disclaimer only if AI analysis was originally planned (even if overridden by formatting)
//         // and the final response isn't an error message.
//         if (plan?.needs_analysis && !fullResponseText.startsWith("Error") && !fullResponseText.startsWith("[") && !fullResponseText.toLowerCase().includes("not financial advice")) {
//             fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*";
//         }

//         // Append TradingView Link if generated
//         if (tradingViewLink) {
//             // Add explanation about why link vs image
//             const linkText = `\n\nView interactive chart on TradingView (direct image generation not available): <${tradingViewLink}>`;
//             if (fullResponseText.length + linkText.length <= 2000) {
//                 fullResponseText += linkText;
//             } else { console.warn("[CMCHandler] Response text too long to append TradingView link."); }
//         }

//         if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 1970) + "..."; // Final trim

//         finalReplyOptions.content = fullResponseText;
//         // Ensure no attachments are attempted
//         finalReplyOptions.files = [];
//         finalReplyOptions.components = [];

//         await thinkingMessage.edit(finalReplyOptions);
//         // --- End Final Discord Message Update ---

//     } catch (error) { // Catch top-level errors
//         console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
//         if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan));
//         // Ensure error message has a prefix if not already added by helpers
//         const prefixRegex = /^\[(DS|GE|CMC|BCR|OAI|DB|System)\]/;
//         const errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`; // Add System prefix if unknown source
//         const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;

//         finalReplyOptions = { content: finalErrorMsg.substring(0, 2000), files: [], components: [] }; // Prepare error reply options

//         if (thinkingMessage) { try { await thinkingMessage.edit(finalReplyOptions); } catch (e) { await message.reply(finalReplyOptions); } }
//         else { await message.reply(finalReplyOptions); }
//     } // End Outer Try/Catch
// } // End handleCmcCommand

// module.exports = { handleCmcCommand };

// commands/cmcHandler.js
const { get_encoding } = require('tiktoken');
const cmc = require('../services/coinMarketCap');
const aiHelper = require('../services/aiHelper');
const { CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE } = require('../prompts');

// --- Configuration ---
const MAX_PROMPT_TOKENS_ANALYSIS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const AI_SUMMARIZE_LIMIT = parseInt(process.env.AI_SUMMARIZE_LIMIT || "5");
const MAX_SYMBOLS_PER_QUERY = 10;

// --- Helper Functions ---
// (extractSymbols, extractSlugs, constructCmcAnalysisPrompt, processDatePlaceholder, getTradingViewSymbol, formatLargeNumber, formatPercent, formatPriceResponse, formatStatisticsResponse - unchanged from previous correct version)
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
const constructCmcAnalysisPrompt = (cmcData, query) => {
    if (!cmcData || typeof cmcData !== 'object') {
        console.warn("[constructCmcAnalysisPrompt] Invalid cmcData:", cmcData);
        return `You are an AI assistant. User asked "${query}". Error retrieving structured data. Inform user.`;
    }
    let prompt = `You are an AI assistant crypto analyst.\nUser question: "${query}"\n\nUse this CMC data:\n`;
    try {
        for (const key in cmcData) {
            if (cmcData[key]) {
                let data = cmcData[key];
                let note = '';
                if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT) {
                    data = data.slice(0, AI_SUMMARIZE_LIMIT);
                    note = ` (Top ${AI_SUMMARIZE_LIMIT})`;
                } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT * 4 && key !== 'global_metrics') {
                    data = `{${Object.keys(data).length} keys}`;
                    note = ` (Truncated)`;
                }
                prompt += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
            }
        }
        prompt += `\nAnalysis Task: Based *only* on provided data, answer user query. **Be concise (<450 tokens / ~1800 chars).** Summarize key points. If asked for price, state price clearly. IMPORTANT: Conclude with '(Disclaimer: NOT financial advice.)'"`;
    } catch (stringifyError) {
        console.error("[constructCmcAnalysisPrompt] Stringify Error:", stringifyError);
        prompt = `User asked "${query}". Error formatting market data for analysis. Inform user.`;
    }
    return prompt;
};
function processDatePlaceholder(placeholder) {
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
function getTradingViewSymbol(symbol) {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return null;
    const commonPairs = { 'BTC': 'BINANCE:BTCUSDT', 'ETH': 'BINANCE:ETHUSDT', 'SOL': 'BINANCE:SOLUSDT', 'XRP': 'BINANCE:XRPUSDT', 'ADA': 'BINANCE:ADAUSDT', 'DOGE': 'BINANCE:DOGEUSDT' };
    if (commonPairs[upperSymbol]) { return commonPairs[upperSymbol]; }
    console.warn(`[CMCHandler] No specific TradingView map for ${upperSymbol}, using generic BINANCE:${upperSymbol}USDT`);
    return `BINANCE:${upperSymbol}USDT`;
}
function formatLargeNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    if (Math.abs(num) >= 1e12) { return `$${(num / 1e12).toFixed(2)}T`; }
    if (Math.abs(num) >= 1e9) { return `$${(num / 1e9).toFixed(2)}B`; }
    if (Math.abs(num) >= 1e6) { return `$${(num / 1e6).toFixed(2)}M`; }
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatPercent(num) {
    if (num === null || num === undefined) return 'N/A';
    return `${num.toFixed(2)}%`;
}
function formatPriceResponse(quoteData, metadata) {
    if (!quoteData || !quoteData.quote?.USD) { console.warn("[formatPriceResponse] Missing quote or USD data."); return null; }
    const usd = quoteData.quote.USD; const name = metadata?.name || quoteData.name || 'N/A'; const symbol = quoteData.symbol || 'N/A'; const rank = quoteData.cmc_rank || 'N/A'; const price = usd.price;
    const high24h = quoteData.quote?.USD?.high_24h; const low24h = quoteData.quote?.USD?.low_24h; const pct1h = usd.percent_change_1h; const pct24h = usd.percent_change_24h; const pct7d = usd.percent_change_7d; const pct30d = usd.percent_change_30d; const vol24h = usd.volume_24h; const mktCap = usd.market_cap; const athPrice = quoteData.ath; const athPctChange = quoteData.ath_change_percentage; const ethConversion = 'N/A';
    let response = `${name} - $${symbol} [${rank}] Price: ${formatLargeNumber(price)}\n`; response += `⤷ ₿ 1.00 | Ξ ${ethConversion} `; response += `H/L: ${formatLargeNumber(high24h)} | ${formatLargeNumber(low24h)} `; response += `1h: ${formatPercent(pct1h)} 24h: ${formatPercent(pct24h)} 7d: ${formatPercent(pct7d)} 30d: ${formatPercent(pct30d)} `; response += `ATH: ${formatLargeNumber(athPrice)} (${formatPercent(athPctChange)}) `; response += `24h Vol: ${formatLargeNumber(vol24h)} MCap: ${formatLargeNumber(mktCap)}`;
    return response;
}
function formatStatisticsResponse(quoteData, metadata) {
    if (!quoteData || !quoteData.quote?.USD) { console.warn("[formatStatisticsResponse] Missing quote or USD data."); return null; }
    const usd = quoteData.quote.USD; const name = metadata?.name || quoteData.name || 'N/A'; const symbol = quoteData.symbol || 'N/A'; const rank = quoteData.cmc_rank || 'N/A';
    let response = `**${name} (${symbol}) - Rank #${rank}**\n`; response += ` • Price: ${formatLargeNumber(usd.price)}\n`; response += ` • Change (1h): ${formatPercent(usd.percent_change_1h)}\n`; response += ` • Change (24h): ${formatPercent(usd.percent_change_24h)}\n`; response += ` • Change (7d): ${formatPercent(usd.percent_change_7d)}\n`; response += ` • Change (30d): ${formatPercent(usd.percent_change_30d)}\n`; response += ` • Volume (24h): ${formatLargeNumber(usd.volume_24h)}\n`; response += ` • Market Cap: ${formatLargeNumber(usd.market_cap)}\n`; response += ` • Fully Diluted MCap: ${formatLargeNumber(usd.fully_diluted_market_cap)}\n`; if (usd.market_cap_dominance !== undefined) { response += ` • Dominance: ${formatPercent(usd.market_cap_dominance)}\n`; } if (quoteData.circulating_supply !== undefined && quoteData.total_supply !== undefined) { response += ` • Supply: ${quoteData.circulating_supply?.toLocaleString() || 'N/A'} / ${quoteData.total_supply?.toLocaleString() || 'N/A'}\n`; } if (quoteData.max_supply !== undefined) { response += ` • Max Supply: ${quoteData.max_supply?.toLocaleString() || 'N/A'}\n`; } response += ` • Last Updated: ${usd.last_updated ? new Date(usd.last_updated).toLocaleString() : 'N/A'}`;
    return response;
}

// --- Main Handler ---
async function handleCmcCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Please provide details after \`!cmc\`!`); return; }

    console.log(`[CMCHandler] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = "";
    let tradingViewLink = null;
    let plan = {};
    let finalReplyOptions = {};

    try {
        thinkingMessage = await message.reply("🤔 Planning request...");

        // Step 1: AI Call #1 - Query Planning
        console.log("[CMCHandler] Calling AI Planner/Classifier...");
        const currentDate = new Date().toISOString().split('T')[0];
        const plannerPrompt = CMC_PLANNER_SYSTEM_PROMPT_TEMPLATE
            .replace('{{CURRENT_DATE}}', currentDate)
            .replace('{{USER_QUERY}}', userQuery.replace(/`/g, "'"));
        const plannerResponse = await aiHelper.getAIResponse(plannerPrompt);

        try {
            let jsonString = null;
            const jsonMatch = plannerResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }
            else { const simpleMatch = plannerResponse.match(/\{.*\}/s); if (simpleMatch) { jsonString = simpleMatch[0]; } }
            if (!jsonString) { throw new Error("No JSON object found in planner response."); }
            plan = JSON.parse(jsonString);
            console.log("[CMCHandler] Received Plan:", JSON.stringify(plan, null, 2));
            if (!plan || !plan.query_type) { throw new Error("AI Planner returned invalid plan (missing 'query_type')."); }
            if (plan.query_type === "CMC_DATA_NEEDED" && !Array.isArray(plan.calls)) { throw new Error("AI Planner classified as CMC_DATA_NEEDED but missing 'calls' array."); }
        } catch (parseError) {
            console.error("PLAN PARSE ERROR:", parseError, "\nRaw Response:", plannerResponse);
            const aiPrefix = plannerResponse.startsWith('[DS]') ? '[DS]' : (plannerResponse.startsWith('[GE]') ? '[GE]' : '');
            throw new Error(`${aiPrefix} AI Planner response was not valid JSON or caused error: ${parseError.message}`.trim());
        }

        // Step 2: Route based on Classification
        if (plan.query_type === "GENERAL_KNOWLEDGE") {
            // ... (General Knowledge logic - unchanged) ...
            console.log("[CMCHandler] Query classified as General Knowledge. Calling AI directly.");
            await thinkingMessage.edit(`🧠 Answering general question with ${process.env.AI_PROVIDER}...`);
            const directAnswerPrompt = `You are a helpful crypto assistant. Answer the user query accurately. **Be concise: Keep the response well under 2000 characters (aim for ~450 tokens max).**\n\nUser Query: "${userQuery}"`;
            const stream = aiHelper.getAIStream(directAnswerPrompt);
            let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null;
            try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } else { console.warn("Truncating general knowledge stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } fullResponseText += accumulatedChunk; }
            catch (error) { console.error("Error DURING General Knowledge AI stream:", error); streamError = error.message; }
            if (streamError) { fullResponseText = `Error getting answer: ${streamError}`; }
            else if (fullResponseText.length === 0) { fullResponseText = "AI returned empty response for general query."; }

        } else if (plan.query_type === "CMC_DATA_NEEDED") {
            // ... (CMC Data Fetching logic - unchanged) ...
            console.log("[CMCHandler] Query classified as CMC Data Needed.");
            if (!plan.calls || plan.calls.length === 0) { console.warn("[CMCHandler] AI Planner requested CMC data but provided no calls."); fullResponseText = "I understood you need market data, but couldn't determine which specific data to fetch. Can you be more specific?"; }
            else {
                await thinkingMessage.edit("📊 Fetching market data...");
                let fetchedCmcData = {}; let chartSymbol = plan.chart_request?.symbol || null; let requiresPaidPlan = false; let fetchedMetadata = {};
                for (const callInstruction of plan.calls) { /* ... loop logic unchanged ... */
                    const functionName = callInstruction.function; let params = { ...(callInstruction.params || {}) }; let dataKey = functionName.replace(/^get/, '').replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);
                    const dateParamKeys = ['time_start', 'time_end', 'date']; for (const key of dateParamKeys) { if (params[key] && typeof params[key] === 'string' && params[key].includes('{{CURRENT_DATE')) { const originalValue = params[key]; const processedValue = processDatePlaceholder(params[key]); if (processedValue !== originalValue && typeof processedValue === 'string' && processedValue.includes('T') && processedValue.includes('Z')) { params[key] = processedValue; console.log(`[CMCHandler] Processed date placeholder for '${key}'. New value: ${params[key]}`); } else { console.warn(`[CMCHandler] Failed to process date placeholder for '${key}'. Helper returned: "${processedValue}", Value remains: "${originalValue}"`); throw new Error(`[System] Invalid or unprocessable date placeholder format/result: ${originalValue} -> ${processedValue}`); } } }
                    console.log(`[CMCHandler] Executing planned call: ${functionName} with processed params: ${JSON.stringify(params)}`); if (['getOhlcvHistorical', 'getQuotesHistorical', 'getListingsHistorical', 'getTrendingLatest', 'getTrendingMostVisited', 'getTrendingGainersLosers', 'getMarketPairsLatest', 'getPricePerformanceStats', 'getOhlcvLatest', 'getDexPairsOhlcvHistorical'].includes(functionName)) { requiresPaidPlan = true; console.log(`[CMCHandler] Note: ${functionName} likely requires paid plan.`); }
                    if (['getDexPairsQuotesLatest', 'getDexPairsOhlcvLatest', 'getDexPairsOhlcvHistorical', 'getDexPairsTradesLatest'].includes(functionName)) { if (!params.network_slug && !params.network_id) { console.log(`[CMCHandler] Network missing from AI plan for ${functionName}. Parsing query: "${userQuery}"`); const networkMatch = userQuery.match(/on\s+([a-zA-Z]+)/i); if (networkMatch && networkMatch[1]) { const networkSlug = networkMatch[1].toLowerCase(); const slugMap = {'eth':'ethereum', 'poly':'polygon', 'matic':'polygon', 'bsc':'bsc', 'bnb':'bsc', 'avax': 'avalanche', 'sol': 'solana'}; params.network_slug = slugMap[networkSlug] || networkSlug; console.log(`[CMCHandler] Added parsed network_slug: ${params.network_slug}`); } else { console.warn(`[CMCHandler] Could not determine network for ${functionName}.`); } } }
                    if (typeof cmc[functionName] === 'function') { try { let result = await cmc[functionName](params); fetchedCmcData[dataKey] = result; if (functionName === 'getMetadata' && result) { const keys = Object.keys(result); if (keys.length > 0) { keys.forEach(key => { const cryptoData = result[key]; if (cryptoData) { fetchedMetadata[cryptoData.symbol.toUpperCase()] = cryptoData; if(cryptoData.slug) fetchedMetadata[cryptoData.slug] = cryptoData; } }); } } console.log(`[CMCHandler] SUCCESS calling ${functionName}`); } catch (cmcError) { console.error(`[CMCHandler] Error during CMC call ${functionName}:`, cmcError); throw cmcError; } }
                    else { throw new Error(`[System] AI Planner requested invalid function: ${functionName}`); }
                }
                console.log("[CMCHandler] Fetched CMC Data Keys:", Object.keys(fetchedCmcData));
                if (plan.chart_request && chartSymbol) { const tvSymbol = getTradingViewSymbol(chartSymbol); if (tvSymbol) { tradingViewLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`; console.log(`[CMCHandler] Generated TradingView link: ${tradingViewLink}`); } else { console.warn(`[CMCHandler] Could not generate TradingView symbol for: ${chartSymbol}`); } }

                // Price Formatting Logic - unchanged
                let formattedPriceResponse = null; const isOnlyQuoteCall = plan.calls.length === 1 && plan.calls[0].function === 'getLatestQuotes'; const queryLooksLikePriceOnly = /^\s*((price|quote|cost|value)\s+(of\s+)?|what('?s| is) the price of)\s*([A-Z]{2,6}(?:,\s*[A-Z]{2,6})*)\s*(\?*)$/i.test(userQuery.trim()); const quoteDataResult = fetchedCmcData.latest_quotes;
                if (isOnlyQuoteCall && quoteDataResult) { const symbolsRequested = plan.calls[0]?.params?.symbol?.split(',') || plan.calls[0]?.params?.slug?.split(',') || Object.keys(quoteDataResult); if (symbolsRequested && symbolsRequested.length > 0) { const firstSymbol = symbolsRequested[0].trim().toUpperCase(); let dataToFormat = null; if (Array.isArray(quoteDataResult[firstSymbol])) { console.warn(`[CMCHandler] CMC returned array for symbol ${firstSymbol}. Using first element.`); dataToFormat = quoteDataResult[firstSymbol][0]; } else { dataToFormat = quoteDataResult[firstSymbol]; } const metadataForFormat = fetchedMetadata[firstSymbol]; if (dataToFormat) { if (queryLooksLikePriceOnly) { console.log("[CMCHandler] Applying specific price format (Req 5)."); formattedPriceResponse = formatPriceResponse(dataToFormat, metadataForFormat); } else { console.log("[CMCHandler] Applying statistics format (Req 4)."); formattedPriceResponse = formatStatisticsResponse(dataToFormat, metadataForFormat); } if (formattedPriceResponse) { plan.needs_analysis = false; console.log("[CMCHandler] Using pre-formatted price response, skipping AI analysis."); fullResponseText = formattedPriceResponse; } else { console.warn("[CMCHandler] Formatting function returned null, will proceed to AI analysis if planned."); } } else { console.warn(`[CMCHandler] Could not find quote data for symbol ${firstSymbol} in the fetched data.`); } } else { console.warn("[CMCHandler] Could not determine symbol from plan parameters for formatting."); } }

                // Final AI Analysis or Direct Formatting - unchanged
                 if (!formattedPriceResponse && plan.needs_analysis && Object.keys(fetchedCmcData).length > 0) { /* ... AI analysis logic ... */
                    await thinkingMessage.edit(`🧠 Synthesizing analysis with ${process.env.AI_PROVIDER}...`); const analysisPrompt = constructCmcAnalysisPrompt(fetchedCmcData, userQuery);
                    if (typeof analysisPrompt !== 'string' || analysisPrompt.length === 0 || analysisPrompt.includes("Error formatting market data")) { console.error("[CMCHandler] Constructed analysis prompt is invalid or indicates formatting error. Skipping AI analysis.", analysisPrompt ? analysisPrompt.substring(0,500): 'NULL'); fullResponseText = "[System] Error: Could not construct valid analysis prompt from fetched data."; }
                    else { console.log("[CMCHandler] Constructed Analysis Prompt (first 200 chars):", analysisPrompt?.substring(0, 200)); let encoding; try { encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(analysisPrompt).length; console.log(`[CMCHandler] Estimated analysis prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS_ANALYSIS) { console.warn(`[CMCHandler] Analysis tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS_ANALYSIS}).`); fullResponseText = `(Note: Data too large for full analysis by AI.)\n\n`; } encoding.free(); } catch (tokenError) { if(encoding) encoding.free(); console.error("[CMCHandler] Analysis Token error:", tokenError); throw new Error("[System] Error estimating analysis tokens."); }
                        if (!fullResponseText.startsWith("(Note:")) { const stream = aiHelper.getAIStream(analysisPrompt); let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } else { console.warn("Truncating analysis stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } fullResponseText += accumulatedChunk; } catch (error) { console.error("Error DURING Analysis AI stream:", error); streamError = error.message; } if (streamError) { fullResponseText = `Error during analysis: ${streamError}`; } else if (fullResponseText.length === 0) { fullResponseText = "AI analysis returned empty response."; } }
                    }
                 } else if (!formattedPriceResponse && Object.keys(fetchedCmcData).length > 0) { /* ... Direct formatting logic ... */
                     console.log("[CMCHandler] Formatting direct response (no analysis needed or possible, and not price-formatted)."); let directResponse = `**Data for "${userQuery}"**:\n`; for (const key in fetchedCmcData) { let data = fetchedCmcData[key]; let note=''; if (Array.isArray(data) && data.length > AI_SUMMARIZE_LIMIT * 2) { data = data.slice(0, AI_SUMMARIZE_LIMIT * 2); note = ` (Top ${AI_SUMMARIZE_LIMIT * 2})`; } else if (typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > AI_SUMMARIZE_LIMIT * 4 && key !== 'global_metrics') { data = `{${Object.keys(data).length} keys}`; note = ` (Truncated)`; } directResponse += `\n**${key.replace(/_/g,' ').toUpperCase()}${note}:**\n`; directResponse += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n"; } if (directResponse.length > 1980) directResponse = directResponse.substring(0, 1980) + "... (Truncated)"; fullResponseText = directResponse;
                 } else if (!formattedPriceResponse) { fullResponseText = "Sorry, I couldn't retrieve the requested market data."; }
            } // End CMC_DATA_NEEDED block

        } else { throw new Error(`[System] AI Planner returned unknown query_type: ${plan.query_type}`); }

        // Final Discord Message Update - unchanged
        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response.";
        if (plan?.needs_analysis && !fullResponseText.startsWith("Error") && !fullResponseText.startsWith("[") && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: NOT financial advice.)*"; }
        if (tradingViewLink) { const linkText = `\n\nView interactive chart on TradingView (direct image generation not available): <${tradingViewLink}>`; if (fullResponseText.length + linkText.length <= 2000) { fullResponseText += linkText; } else { console.warn("[CMCHandler] Response text too long to append TradingView link."); } }
        if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 1970) + "...";
        finalReplyOptions.content = fullResponseText; finalReplyOptions.files = []; finalReplyOptions.components = [];
        await thinkingMessage.edit(finalReplyOptions);

    } catch (error) { // Catch top-level errors
        console.error(`[CMCHandler] Top-level error processing query "${userQuery}":`, error);
        if(typeof plan !== 'undefined') console.error("[CMCHandler] Plan at time of error:", JSON.stringify(plan));
        const prefixRegex = /^\[(DS|GE|CMC|BCR|OAI|DB|System)\]/;
        let errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;

        // **ADDED:** Check for parameter errors and append help suggestion
        const parameterErrorMessages = [
            "invalid symbol", "invalid function", "requires parameter", "missing parameter",
            "invalid query", "invalid plan", "no json object found", // Planner/parsing errors
            "invalid date placeholder", "invalid range" // Parameter format errors
        ];
        if (parameterErrorMessages.some(phrase => errorMsgContent.toLowerCase().includes(phrase))) {
            errorMsgContent += " Please check the command format using `!help`.";
        }

        const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;
        finalReplyOptions = { content: finalErrorMsg.substring(0, 2000), files: [], components: [] };
        if (thinkingMessage) { try { await thinkingMessage.edit(finalReplyOptions); } catch (e) { await message.reply(finalReplyOptions); } }
        else { await message.reply(finalReplyOptions); }
    } // End Outer Try/Catch
} // End handleCmcCommand

module.exports = { handleCmcCommand };
