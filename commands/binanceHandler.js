// // commands/binanceHandler.js
// const binanceHelper = require('../services/binanceHelper');
// const aiHelper = require('../services/aiHelper');
// const { EmbedBuilder } = require('discord.js');

// const MAX_DEPTH_DISPLAY = 10; // Max bids/asks to show in embed
// const MAX_KLINES_FOR_AI = 50; // Max klines to send to AI

// /**
//  * Formats the order book depth for display.
//  * @param {object} depthData - Depth data from binanceHelper.getDepth ({ bids: [{price, quantity}, ...], asks: [{price, quantity}, ...] }).
//  * @param {number} limit - Max number of levels to show.
//  * @returns {string} Formatted string for Discord embed.
//  */
// function formatDepth(depthData, limit = MAX_DEPTH_DISPLAY) {
//     console.log('[formatDepth] Received depthData:', JSON.stringify(depthData)); // Keep log for verification
//     let output = '**Bids (Price | Qty):**\n```\n';
//     // **CORRECTION START:** Iterate directly over the array of bid objects
//     const bids = Array.isArray(depthData?.bids) ? depthData.bids : [];
//     // Sort bids descending by price (highest price first)
//     bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

//     bids.slice(0, limit).forEach(bid => {
//         const numPrice = parseFloat(bid.price);
//         const numQuantity = parseFloat(bid.quantity);
//         if (!isNaN(numPrice) && !isNaN(numQuantity)) {
//             output += `${numPrice.toFixed(4).padEnd(12)}| ${numQuantity.toFixed(4)}\n`;
//         } else {
//             output += `${String(bid.price).padEnd(12)}| ${String(bid.quantity)}\n`; // Fallback
//         }
//     });
//     // **CORRECTION END**

//     output += '```\n**Asks (Price | Qty):**\n```\n';
//     // **CORRECTION START:** Iterate directly over the array of ask objects
//     const asks = Array.isArray(depthData?.asks) ? depthData.asks : [];
//      // Sort asks ascending by price (lowest price first)
//     asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

//     asks.slice(0, limit).forEach(ask => {
//         const numPrice = parseFloat(ask.price);
//         const numQuantity = parseFloat(ask.quantity);
//         if (!isNaN(numPrice) && !isNaN(numQuantity)) {
//             output += `${numPrice.toFixed(4).padEnd(12)}| ${numQuantity.toFixed(4)}\n`;
//         } else {
//             output += `${String(ask.price).padEnd(12)}| ${String(ask.quantity)}\n`; // Fallback
//         }
//     });
//     // **CORRECTION END**
//     output += '```';
//     return output;
// }

// /**
//  * Constructs a prompt for AI analysis based on Binance data.
//  * @param {string} symbol - The trading symbol.
//  * @param {object|null} priceData - Latest price data.
//  * @param {object|null} depthData - Order book depth data.
//  * @param {Array|null} klineData - Kline/OHLCV data.
//  * @param {string} userQuery - Original user query.
//  * @returns {string} The prompt for the AI.
//  */
// function constructBinancePrompt(symbol, priceData, depthData, klineData, userQuery) {
//     let prompt = `You are an AI crypto market analyst focusing on Binance data for ${symbol}.\nUser Query: "${userQuery}"\n\n== Current Data ==\n`;

//     if (priceData?.price) {
//         prompt += `* Latest Price: ${priceData.price}\n`;
//     } else {
//         prompt += `* Latest Price: N/A\n`;
//     }

//     // Use the corrected depth data structure (array of objects)
//     if (depthData) {
//         const bids = Array.isArray(depthData.bids) ? depthData.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)) : [];
//         const asks = Array.isArray(depthData.asks) ? depthData.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)) : [];
//         const topBid = bids[0]?.price || 'N/A';
//         const topAsk = asks[0]?.price || 'N/A';
//         prompt += `* Order Book: Top Bid: ${topBid}, Top Ask: ${topAsk} (${bids.length} bid levels, ${asks.length} ask levels fetched)\n`;
//     } else {
//          prompt += `* Order Book: N/A\n`;
//     }

//     if (Array.isArray(klineData) && klineData.length > 0) {
//         const firstKline = klineData[0];
//         const lastKline = klineData[klineData.length - 1];
//         if (firstKline && firstKline.length > 6 && lastKline && lastKline.length > 6) {
//             const startTime = new Date(firstKline[0]).toISOString();
//             const endTime = new Date(lastKline[6]).toISOString();
//             const high = Math.max(...klineData.map(k => parseFloat(k[2]))).toFixed(4);
//             const low = Math.min(...klineData.map(k => parseFloat(k[3]))).toFixed(4);
//             prompt += `\n== Historical Kline Data (${klineData.length} candles) ==\n`;
//             prompt += `* Period: ${startTime} to ${endTime}\n`;
//             prompt += `* High: ${high}, Low: ${low}\n`;
//             prompt += `* Last Close: ${parseFloat(lastKline[4]).toFixed(4)}\n`;
//         } else {
//              console.warn('[constructBinancePrompt] Kline data has unexpected structure.');
//              prompt += `\n== Historical Kline Data ==\n* Error processing Kline data structure.\n`;
//         }
//     } else {
//         prompt += `\n== Historical Kline Data ==\n* N/A\n`;
//     }

//     prompt += `\nAnalysis Task:\n1. Briefly summarize the current price and order book sentiment (if depth available).\n2. Based on the Kline data summary (if available), comment on recent price action (trend, range).\n3. Address the user's original query: "${userQuery}".\n4. **Keep the response concise (under 450 tokens).**\n5. Conclude with "(Disclaimer: NOT financial advice. Data from Binance.)"`;

//     return prompt;
// }


// /**
//  * Main handler for !binance commands.
//  */
// async function handleBinanceCommand(message, userQuery) {
//     const args = userQuery.toLowerCase().trim().split(/\s+/);
//     const subCommand = args[0];
//     const symbol = args[1] ? binanceHelper.standardizeSymbol(args[1]) : null;

//     let thinkingMessage = null;
//     let fullResponseText = "";
//     let embed = null;

//     try {
//         thinkingMessage = await message.reply(`⏳ Processing \`!binance ${userQuery}\`...`);

//         switch (subCommand) {
//             case 'tickers':
//             case 'list':
//             case 'pairs': {
//                 await thinkingMessage.edit("⏳ Fetching exchange info...");
//                 const info = await binanceHelper.getExchangeInfo();
//                 const symbols = info.symbols
//                                   .filter(s => s.status === 'TRADING')
//                                   .map(s => s.symbol);
//                 const displayLimit = 100;
//                 fullResponseText = `**Binance Tickers (${Math.min(displayLimit, symbols.length)}/${symbols.length}):**\n\`\`\`\n${symbols.slice(0, displayLimit).join(', ')}\n\`\`\``;
//                 if (symbols.length > displayLimit) {
//                     fullResponseText += `\n...and ${symbols.length - displayLimit} more.`;
//                 }
//                 break;
//             }

//             case 'price': {
//                 if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance price BTCUSDT`).");
//                 await thinkingMessage.edit(`⏳ Fetching price for ${symbol}...`);
//                 const priceData = await binanceHelper.getPrice(symbol);
//                  embed = new EmbedBuilder()
//                     .setColor(0xF0B90B)
//                     .setTitle(`Binance Price: ${symbol}`)
//                     .setDescription(`**${priceData.price}**`)
//                     .setTimestamp();
//                 break;
//             }

//             case 'depth': {
//                 if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance depth BTCUSDT`).");
//                 const limit = args[2] ? parseInt(args[2], 10) : MAX_DEPTH_DISPLAY;
//                 const validLimit = Math.min(Math.max(limit || MAX_DEPTH_DISPLAY, 5), 100);
//                 if (isNaN(validLimit)) throw new Error("Invalid limit specified for depth.");

//                 await thinkingMessage.edit(`⏳ Fetching order book depth for ${symbol} (limit ${validLimit})...`);
//                 const depthData = await binanceHelper.getDepth(symbol, validLimit);
//                  embed = new EmbedBuilder()
//                     .setColor(0xF0B90B)
//                     .setTitle(`Binance Order Book: ${symbol} (Top ${validLimit})`)
//                     .setDescription(formatDepth(depthData, validLimit)) // Use corrected formatter
//                     .setTimestamp();
//                 break;
//             }

//             case 'klines':
//             case 'chart':
//             case 'analyze': {
//                 if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance klines BTCUSDT 1h`).");
//                 const interval = args[2] || '1h';
//                 const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
//                 if (!validIntervals.includes(interval)) {
//                     throw new Error(`Invalid interval: ${interval}. Use one of: ${validIntervals.join(', ')}`);
//                 }
//                 const limit = args[3] ? parseInt(args[3], 10) : MAX_KLINES_FOR_AI;
//                 const validLimit = Math.min(Math.max(limit || MAX_KLINES_FOR_AI, 1), 1000);
//                 if (isNaN(validLimit)) throw new Error("Invalid limit specified for klines.");

//                 await thinkingMessage.edit(`⏳ Fetching data for ${symbol} (${interval}, limit ${validLimit}) for analysis...`);

//                 let priceData = null, depthData = null, klineData = null;
//                 try { priceData = await binanceHelper.getPrice(symbol); } catch(e) { console.warn(`Failed to get price for ${symbol}: ${e.message}`); }
//                 try { depthData = await binanceHelper.getDepth(symbol, 5); } catch(e) { console.warn(`Failed to get depth for ${symbol}: ${e.message}`); }
//                 try { klineData = await binanceHelper.getKlines(symbol, interval, validLimit); }
//                 catch(e) {
//                     console.warn(`Failed to get klines for ${symbol}: ${e.message}`);
//                     if (subCommand === 'klines') throw e;
//                 }

//                 if (!priceData && !depthData && !klineData) {
//                     throw new Error(`Could not fetch any data (price, depth, klines) for ${symbol}. Check symbol and try again.`);
//                 }

//                 const prompt = constructBinancePrompt(symbol, priceData, depthData, klineData, userQuery);
//                 await thinkingMessage.edit(`🧠 Analyzing ${symbol} data with ${process.env.AI_PROVIDER}...`);

//                 const stream = aiHelper.getAIStream(prompt);
//                 let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null;
//                 try {
//                     for await (const chunk of stream) {
//                         const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
//                         if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
//                             fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
//                             if (currentEditText.length <= 1950) {
//                                 try { await thinkingMessage.edit(currentEditText); lastEditTime = now; }
//                                 catch (e) { console.error("Edit error:", e.message); }
//                             } else { console.warn("Truncating Binance analysis stream."); fullResponseText = fullResponseText.substring(0, 1900) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
//                         }
//                     }
//                     fullResponseText += accumulatedChunk;
//                 } catch (error) {
//                     console.error("Error DURING Binance AI stream:", error);
//                     streamError = error.message;
//                 }
//                 if (streamError) { fullResponseText = `Error during analysis: ${streamError}`; }
//                 else if (fullResponseText.length === 0) { fullResponseText = "AI analysis returned empty response."; }

//                 if (!streamError && !fullResponseText.toLowerCase().includes("not financial advice")) {
//                      fullResponseText += "\n\n*(Disclaimer: NOT financial advice. Data from Binance.)*";
//                 }

//                  const tradingLink = binanceHelper.getTradingLink(symbol);
//                  if (tradingLink) {
//                      const linkText = `\n\nView live chart on Binance: <${tradingLink}>`;
//                       if (fullResponseText.length + linkText.length <= 2000) {
//                           fullResponseText += linkText;
//                       }
//                  }
//                  if (subCommand === 'chart') {
//                       const taNote = "\n*(Note: Technical indicators like RSI/MACD are best viewed on the interactive chart linked above.)*";
//                        if (fullResponseText.length + taNote.length <= 2000) {
//                           fullResponseText += taNote;
//                       }
//                  }
//                 break;
//             }

//             case 'link': {
//                  if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance link BTCUSDT`).");
//                  const tradingLink = binanceHelper.getTradingLink(symbol);
//                  if (tradingLink) {
//                      fullResponseText = `Binance Trading Link for ${symbol}: <${tradingLink}>`;
//                  } else {
//                      fullResponseText = `Could not generate Binance link for ${symbol}.`;
//                  }
//                  break;
//             }

//             default:
//                 fullResponseText = `Unknown \`!binance\` command: "${subCommand}". Use \`!help\` to see available commands.`;
//         }

//         // --- Final Reply ---
//         const finalReplyOptions = {};
//         if (embed) {
//             finalReplyOptions.embeds = [embed];
//             if (fullResponseText && !embed.description?.includes(fullResponseText.substring(0,50))) {
//                  finalReplyOptions.content = fullResponseText.substring(0, 100);
//             }
//         } else {
//             finalReplyOptions.content = fullResponseText.substring(0, 2000);
//         }

//         await thinkingMessage.edit(finalReplyOptions);

//     } catch (error) {
//         console.error(`[BinanceHandler] Error processing query "${userQuery}":`, error);
//         const prefixRegex = /^\[(BNB|DS|GE|System)\]/;
//         const errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;
//         const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;

//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: finalErrorMsg.substring(0, 2000), embeds: [], components: [] }); } catch (e) { await message.reply(finalErrorMsg.substring(0, 2000)); } }
//         else { await message.reply(finalErrorMsg.substring(0, 2000)); }
//     }
// }

// module.exports = { handleBinanceCommand };

// commands/binanceHandler.js
const binanceHelper = require('../services/binanceHelper');
const aiHelper = require('../services/aiHelper');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js'); // Added AttachmentBuilder
const { stringify } = require('csv-stringify/sync'); // Added csv-stringify

const MAX_DEPTH_DISPLAY = 10;
const MAX_KLINES_FOR_AI = 50;

/**
 * Formats the order book depth for display.
 * @param {object} depthData - Depth data from binanceHelper.getDepth ({ bids: [{price, quantity}, ...], asks: [{price, quantity}, ...] }).
 * @param {number} limit - Max number of levels to show.
 * @returns {string} Formatted string for Discord embed.
 */
function formatDepth(depthData, limit = MAX_DEPTH_DISPLAY) {
    console.log('[formatDepth] Received depthData:', JSON.stringify(depthData));
    let output = '**Bids (Price | Qty):**\n```\n';
    const bids = Array.isArray(depthData?.bids) ? depthData.bids : [];
    bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    bids.slice(0, limit).forEach(bid => {
        const numPrice = parseFloat(bid.price);
        const numQuantity = parseFloat(bid.quantity);
        if (!isNaN(numPrice) && !isNaN(numQuantity)) {
            output += `${numPrice.toFixed(4).padEnd(12)}| ${numQuantity.toFixed(4)}\n`;
        } else {
            output += `${String(bid.price).padEnd(12)}| ${String(bid.quantity)}\n`;
        }
    });

    output += '```\n**Asks (Price | Qty):**\n```\n';
    const asks = Array.isArray(depthData?.asks) ? depthData.asks : [];
    asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    asks.slice(0, limit).forEach(ask => {
        const numPrice = parseFloat(ask.price);
        const numQuantity = parseFloat(ask.quantity);
        if (!isNaN(numPrice) && !isNaN(numQuantity)) {
            output += `${numPrice.toFixed(4).padEnd(12)}| ${numQuantity.toFixed(4)}\n`;
        } else {
            output += `${String(ask.price).padEnd(12)}| ${String(ask.quantity)}\n`;
        }
    });
    output += '```';
    return output;
}

/**
 * Constructs a prompt for AI analysis based on Binance data.
 * @param {string} symbol - The trading symbol.
 * @param {object|null} priceData - Latest price data.
 * @param {object|null} depthData - Order book depth data.
 * @param {Array|null} klineData - Kline/OHLCV data.
 * @param {string} userQuery - Original user query.
 * @returns {string} The prompt for the AI.
 */
function constructBinancePrompt(symbol, priceData, depthData, klineData, userQuery) {
    let prompt = `You are an AI crypto market analyst focusing on Binance data for ${symbol}.\nUser Query: "${userQuery}"\n\n== Current Data ==\n`;

    if (priceData?.price) {
        prompt += `* Latest Price: ${priceData.price}\n`;
    } else {
        prompt += `* Latest Price: N/A\n`;
    }

    if (depthData) {
        const bids = Array.isArray(depthData.bids) ? depthData.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)) : [];
        const asks = Array.isArray(depthData.asks) ? depthData.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)) : [];
        const topBid = bids[0]?.price || 'N/A';
        const topAsk = asks[0]?.price || 'N/A';
        prompt += `* Order Book: Top Bid: ${topBid}, Top Ask: ${topAsk} (${bids.length} bid levels, ${asks.length} ask levels fetched)\n`;
    } else {
         prompt += `* Order Book: N/A\n`;
    }

    if (Array.isArray(klineData) && klineData.length > 0) {
        const firstKline = klineData[0];
        const lastKline = klineData[klineData.length - 1];
        if (firstKline && firstKline.length > 6 && lastKline && lastKline.length > 6) {
            const startTime = new Date(firstKline[0]).toISOString();
            const endTime = new Date(lastKline[6]).toISOString();
            const high = Math.max(...klineData.map(k => parseFloat(k[2]))).toFixed(4);
            const low = Math.min(...klineData.map(k => parseFloat(k[3]))).toFixed(4);
            prompt += `\n== Historical Kline Data (${klineData.length} candles) ==\n`;
            prompt += `* Period: ${startTime} to ${endTime}\n`;
            prompt += `* High: ${high}, Low: ${low}\n`;
            prompt += `* Last Close: ${parseFloat(lastKline[4]).toFixed(4)}\n`;
        } else {
             console.warn('[constructBinancePrompt] Kline data has unexpected structure.');
             prompt += `\n== Historical Kline Data ==\n* Error processing Kline data structure.\n`;
        }
    } else {
        prompt += `\n== Historical Kline Data ==\n* N/A\n`;
    }

    prompt += `\nAnalysis Task:\n1. Briefly summarize the current price and order book sentiment (if depth available).\n2. Based on the Kline data summary (if available), comment on recent price action (trend, range).\n3. Address the user's original query: "${userQuery}".\n4. **Keep the response concise (under 450 tokens).**\n5. Conclude with "(Disclaimer: NOT financial advice. Data from Binance.)"`;

    return prompt;
}


/**
 * Main handler for !binance commands.
 */
async function handleBinanceCommand(message, userQuery) {
    const args = userQuery.toLowerCase().trim().split(/\s+/);
    const subCommand = args[0];
    const symbol = args[1] ? binanceHelper.standardizeSymbol(args[1]) : null;

    let thinkingMessage = null;
    let fullResponseText = "";
    let embed = null;
    let fileAttachment = null; // To hold potential file attachment

    try {
        thinkingMessage = await message.reply(`⏳ Processing \`!binance ${userQuery}\`...`);

        switch (subCommand) {
            case 'tickers':
            case 'list':
            case 'pairs': {
                await thinkingMessage.edit("⏳ Fetching exchange info and generating CSV...");
                const info = await binanceHelper.getExchangeInfo();
                const tradingSymbols = info.symbols
                                  .filter(s => s.status === 'TRADING')
                                  .map(s => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset })); // Get more info

                if (!tradingSymbols || tradingSymbols.length === 0) {
                    fullResponseText = "Could not retrieve any trading symbols from Binance.";
                    break;
                }

                // Generate CSV
                const csvString = stringify(tradingSymbols, { header: true });
                const csvBuffer = Buffer.from(csvString, 'utf-8');
                fileAttachment = new AttachmentBuilder(csvBuffer, { name: 'binance_tickers.csv' });

                fullResponseText = `Fetched **${tradingSymbols.length}** trading symbols from Binance. See attached CSV for the full list.`;
                break; // CSV handled in final reply options
            }

            case 'price': {
                if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance price BTCUSDT`).");
                await thinkingMessage.edit(`⏳ Fetching price for ${symbol}...`);
                const priceData = await binanceHelper.getPrice(symbol);
                 embed = new EmbedBuilder()
                    .setColor(0xF0B90B)
                    .setTitle(`Binance Price: ${symbol}`)
                    .setDescription(`**${priceData.price}**`)
                    .setTimestamp();
                break;
            }

            case 'depth': {
                if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance depth BTCUSDT`).");
                const limit = args[2] ? parseInt(args[2], 10) : MAX_DEPTH_DISPLAY;
                const validLimit = Math.min(Math.max(limit || MAX_DEPTH_DISPLAY, 5), 100);
                if (isNaN(validLimit)) throw new Error("Invalid limit specified for depth.");

                await thinkingMessage.edit(`⏳ Fetching order book depth for ${symbol} (limit ${validLimit})...`);
                const depthData = await binanceHelper.getDepth(symbol, validLimit);
                 embed = new EmbedBuilder()
                    .setColor(0xF0B90B)
                    .setTitle(`Binance Order Book: ${symbol} (Top ${validLimit})`)
                    .setDescription(formatDepth(depthData, validLimit))
                    .setTimestamp();
                break;
            }

            case 'klines':
            case 'chart':
            case 'analyze': {
                if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance klines BTCUSDT 1h`).");
                const interval = args[2] || '1h';
                const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
                if (!validIntervals.includes(interval)) {
                    throw new Error(`Invalid interval: ${interval}. Use one of: ${validIntervals.join(', ')}`);
                }
                const limit = args[3] ? parseInt(args[3], 10) : MAX_KLINES_FOR_AI;
                const validLimit = Math.min(Math.max(limit || MAX_KLINES_FOR_AI, 1), 1000);
                if (isNaN(validLimit)) throw new Error("Invalid limit specified for klines.");

                await thinkingMessage.edit(`⏳ Fetching data for ${symbol} (${interval}, limit ${validLimit}) for analysis...`);

                let priceData = null, depthData = null, klineData = null;
                try { priceData = await binanceHelper.getPrice(symbol); } catch(e) { console.warn(`Failed to get price for ${symbol}: ${e.message}`); }
                try { depthData = await binanceHelper.getDepth(symbol, 5); } catch(e) { console.warn(`Failed to get depth for ${symbol}: ${e.message}`); }
                try { klineData = await binanceHelper.getKlines(symbol, interval, validLimit); }
                catch(e) {
                    console.warn(`Failed to get klines for ${symbol}: ${e.message}`);
                    if (subCommand === 'klines') throw e;
                }

                if (!priceData && !depthData && !klineData) {
                    throw new Error(`Could not fetch any data (price, depth, klines) for ${symbol}. Check symbol and try again.`);
                }

                const prompt = constructBinancePrompt(symbol, priceData, depthData, klineData, userQuery);
                await thinkingMessage.edit(`🧠 Analyzing ${symbol} data with ${process.env.AI_PROVIDER}...`);

                const stream = aiHelper.getAIStream(prompt);
                let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamError = null;
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
                        if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
                            fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
                            if (currentEditText.length <= 1950) {
                                try { await thinkingMessage.edit(currentEditText); lastEditTime = now; }
                                catch (e) { console.error("Edit error:", e.message); }
                            } else { console.warn("Truncating Binance analysis stream."); fullResponseText = fullResponseText.substring(0, 1900) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
                        }
                    }
                    fullResponseText += accumulatedChunk;
                } catch (error) {
                    console.error("Error DURING Binance AI stream:", error);
                    streamError = error.message;
                }
                if (streamError) { fullResponseText = `Error during analysis: ${streamError}`; }
                else if (fullResponseText.length === 0) { fullResponseText = "AI analysis returned empty response."; }

                if (!streamError && !fullResponseText.toLowerCase().includes("not financial advice")) {
                     fullResponseText += "\n\n*(Disclaimer: NOT financial advice. Data from Binance.)*";
                }

                 const tradingLink = binanceHelper.getTradingLink(symbol);
                 if (tradingLink) {
                     const linkText = `\n\nView live chart on Binance: <${tradingLink}>`;
                      if (fullResponseText.length + linkText.length <= 2000) {
                          fullResponseText += linkText;
                      }
                 }
                 if (subCommand === 'chart') {
                      const taNote = "\n*(Note: Technical indicators like RSI/MACD are best viewed on the interactive chart linked above.)*";
                       if (fullResponseText.length + taNote.length <= 2000) {
                          fullResponseText += taNote;
                      }
                 }
                break;
            }

            case 'link': {
                 if (!symbol) throw new Error("Please specify a symbol (e.g., `!binance link BTCUSDT`).");
                 const tradingLink = binanceHelper.getTradingLink(symbol);
                 if (tradingLink) {
                     fullResponseText = `Binance Trading Link for ${symbol}: <${tradingLink}>`;
                 } else {
                     fullResponseText = `Could not generate Binance link for ${symbol}.`;
                 }
                 break;
            }

            default:
                // Throw an error for unknown sub-command, which will be caught below
                throw new Error(`Unknown \`!binance\` command: "${subCommand}".`);
        }

        // --- Final Reply ---
        const finalReplyOptions = {
             content: null, // Default to null
             embeds: [],
             files: []
         };

        if (embed) {
            finalReplyOptions.embeds.push(embed);
        }
        // Set content only if there's text and it's not already fully represented by the embed description
        if (fullResponseText && (!embed || !embed.data.description || !embed.data.description.includes(fullResponseText.substring(0, 50)))) {
             finalReplyOptions.content = fullResponseText.substring(0, 2000);
        } else if (fullResponseText && !embed) {
             finalReplyOptions.content = fullResponseText.substring(0, 2000);
        }


        if (fileAttachment) {
            finalReplyOptions.files.push(fileAttachment);
        }

        // Ensure there's at least content or an embed
        if (!finalReplyOptions.content && finalReplyOptions.embeds.length === 0) {
             finalReplyOptions.content = "Processing complete, but no output generated."; // Fallback message
        }


        await thinkingMessage.edit(finalReplyOptions);

    } catch (error) {
        console.error(`[BinanceHandler] Error processing query "${userQuery}":`, error);
        const prefixRegex = /^\[(BNB|DS|GE|System)\]/;
        let errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;

        // **ADDED:** Check for common parameter errors and append help suggestion
        const parameterErrorMessages = [
            "invalid symbol",
            "please specify a symbol",
            "symbol is required",
            "invalid limit",
            "invalid interval",
            "unknown binance command", // From the default case throw
        ];
        if (parameterErrorMessages.some(phrase => errorMsgContent.toLowerCase().includes(phrase))) {
            errorMsgContent += " Please check the command format using `!help`.";
        }

        const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;

        if (thinkingMessage) { try { await thinkingMessage.edit({ content: finalErrorMsg.substring(0, 2000), embeds: [], files: [], components: [] }); } catch (e) { await message.reply(finalErrorMsg.substring(0, 2000)); } }
        else { await message.reply(finalErrorMsg.substring(0, 2000)); }
    }
}

module.exports = { handleBinanceCommand };

