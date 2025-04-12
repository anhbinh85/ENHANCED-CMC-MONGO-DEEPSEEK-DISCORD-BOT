// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const { AttachmentBuilder } = require('discord.js');
// const mongoHelper = require('../services/mongoHelper');
// const aiHelper = require('../services/aiHelper');
// const blockcypherHelper = require('../services/blockcypherHelper');
// // const cmc = require('../services/coinMarketCap'); // No longer needed for price
// const binanceHelper = require('../services/binanceHelper'); // <-- Import Binance Helper
// const { parseWhaleQuery } = require('../utils/filterParser');
// const { stringify } = require('csv-stringify/sync');

// // --- Configuration ---
// const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
// const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';
// const MOST_ACTIVE_DISPLAY_LIMIT = 15;
// const MOST_ACTIVE_FETCH_LIMIT = 50;
// const RELATION_DISPLAY_LIMIT = 15;
// const AVG_BTC_TX_SIZE_BYTES = 250; // Rough estimate for fee calculation
// const BTC_PRICE_SYMBOL = 'BTCUSDT'; // Default Binance pair for BTC price

// // --- Helper: Generate Data File ---
// // (No changes needed in this helper function)
// function generateDataFile(data, type = 'transactions', format = 'csv', labelsMap = new Map()) {
//     console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${data.length} ${type}...`);
//     let dataForFile;
//     let columns;
//     let defaultColumns;

//     try {
//         if (type === 'transactions') {
//              defaultColumns = ['Timestamp', 'Block', 'Value_BTC', 'TxHash', 'From_Addresses', 'From_Labels', 'To_Addresses', 'To_Labels', 'Explorer_Link'];
//              dataForFile = data.map(tx => {
//                 let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} }
//                 const valueBTC = Number(tx?.value?.$numberLong || tx?.value || 0) / 1e8; // Handle BSON Long explicitly
//                 const fromLabels = Array.isArray(tx.fromLabels) ? tx.fromLabels.join(' | ') : '';
//                 const toLabels = Array.isArray(tx.toLabels) ? tx.toLabels.join(' | ') : '';
//                 return { Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block, Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A', From_Addresses: tx?.from?.join(', ') || '', From_Labels: fromLabels, To_Addresses: tx?.to?.join(', ') || '', To_Labels: toLabels, Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`, };
//              });
//         } else if (type === 'most_active') {
//              defaultColumns = ['Rank', 'Address', 'Label', 'Tx_Count', 'Total_IN_BTC', 'Total_OUT_BTC'];
//              dataForFile = data.map((item, index) => ({ Rank: index + 1, Address: item.address, Label: item.label || '', Tx_Count: item.count, Total_IN_BTC: item.totalInBTC.toFixed(8), Total_OUT_BTC: item.totalOutBTC.toFixed(8) }));
//         } else if (type === 'relations') {
//             defaultColumns = ['TxHash', 'Timestamp', 'Block', 'Counterparty', 'Counterparty_Label', 'Direction', 'Value_BTC', 'Tx_Type'];
//             dataForFile = data.map(item => ({
//                 TxHash: item.txHash || 'N/A',
//                 Timestamp: item.timestamp || '',
//                 Block: item.block,
//                 Counterparty: item.counterparty,
//                 Counterparty_Label: labelsMap.get(item.counterparty) || '', // Use labelsMap
//                 Direction: item.direction,
//                 Value_BTC: item.valueBTC.toFixed(8),
//                 Tx_Type: item.txType
//             }));
//             dataForFile.sort((a, b) => (a.Timestamp && b.Timestamp) ? new Date(b.Timestamp) - new Date(a.Timestamp) : 0); // Sort descending by time for relations
//         } else { throw new Error(`Unknown data type: ${type}`); }

//         if (format === 'csv' && stringify) { columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : defaultColumns; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
//         else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
//         else { throw new Error("Invalid format or csv-stringify missing."); }
//     } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file for type ${type}:`, fileError); return null; }
// }


// // --- Helper: Construct AI Prompt ---
// // (No changes needed in this helper function)
// const constructWhalePrompt = (summary, topNData, query) => {
//     if (!summary || typeof summary !== 'object' || !topNData || !Array.isArray(topNData)) {
//         console.error('[constructWhalePrompt] Invalid summary or topNData received.');
//         return null;
//     }
//     let dataPrompt = `User Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`;
//     let processedData;
//     try {
//          processedData = topNData.map(doc => {
//              if (!doc) return null;
//              const valueRaw = doc.value?.$numberLong || doc.value?.$numberInt || doc.value;
//              const valueNum = Number(valueRaw || 0);
//              const blockNum = doc.block?.$numberInt || doc.block?.$numberLong || doc.block;
//              const newDoc = { txHash: doc.txHash || null, timestamp: null, block: blockNum, valueBTC: parseFloat((valueNum / 1e8).toFixed(4)), from: doc.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] };
//              if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
//              return newDoc;
//          }).filter(Boolean);
//         dataPrompt += JSON.stringify(processedData, null, 2);
//     } catch (stringifyError) {
//          console.error("[constructWhalePrompt] Error processing/stringifying transaction data:", stringifyError);
//          dataPrompt += `[Error processing transaction details: ${stringifyError.message}]`;
//          return null;
//     }
//     dataPrompt += `\n\`\`\`\n`;
//     const analysisTask = `
// Analysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions provided above, generate a concise analysis using Markdown formatting. Structure your response like this:

// 1.  **Overall Activity:** Briefly comment on the total volume, transaction count, and block range.
// 2.  **Largest Transactions:** List the 1-2 largest transactions from the top ${topNData.length}. For each, mention the approximate BTC value, involved parties (especially known labels/exchanges), and the transaction hash using an inline code block (e.g., \`abc...xyz\`).
// 3.  **Notable Activity:** Use bullet points (\`*\`) to highlight any other significant transactions or patterns involving known whales or exchanges from the provided data. Mention relevant transaction hashes in inline code blocks.
// 4.  **Market Context (Optional):** If the overall volume/flows seem significant, add a *brief, cautious* comment on potential market implications (e.g., increased activity, potential volatility).
// 5.  **Conciseness:** Keep the entire response under ~450 tokens.
// 6.  **Formatting:** Use Markdown bold (\`**bold**\`) for headings and emphasis. Use inline code blocks (\`hash\`) for transaction hashes. DO NOT format hashes as links.
// `;
//     const finalPrompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\n${dataPrompt}\n${analysisTask}`;
//     console.log("[constructWhalePrompt] Successfully constructed prompt with formatting instructions.");
//     return finalPrompt;
// };


// // --- Main Handler Function ---
// async function handleWhaleCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Use \`!whale <query>\` e.g., \`!whale last hour\`, \`!whale fee\``); return; }

//     console.log(`[WhaleWatcher] Query: "${userQuery}"`);
//     let thinkingMessage = null;
//     let fullResponseText = "";
//     let fileBuffer = null;
//     let fileName = 'whale_report.csv';
//     let finalPrompt = "";
//     let skipAI = false;

//     try {
//         thinkingMessage = await message.reply("⏳ Preparing whale report...");

//         // Step 1: Parse the user query
//         const parseResult = parseWhaleQuery(userQuery);
//         if (parseResult.parseError) { throw new Error(`Invalid command format: ${parseResult.parseError}. Use \`!help\` for examples.`); }

//         let mongoFilter = parseResult.mongoFilter;
//         let filterDescription = parseResult.filterDescription;
//         const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
//         const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
//         const requiresRelationCheck = parseResult.requiresRelationCheck;
//         const requiresBalanceCheck = parseResult.requiresBalanceCheck;
//         const requiresFeeCheck = parseResult.requiresFeeCheck;
//         const targetAddress = parseResult.targetAddress;

//         // Step 1b: Handle 'latest block' lookups (if needed)
//         if (requiresLatestBlockLookup) {
//             // ... (logic unchanged) ...
//             await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
//             const latestBlock = await mongoHelper.getLatestBlockNumber();
//             if (latestBlock === null) {
//                 throw new Error("[DB] Could not determine the latest block number from the database.");
//             }
//             const blockFilter = { block: latestBlock };
//             if (mongoFilter && Object.keys(mongoFilter).length > 0) {
//                  if (mongoFilter['$or']) { mongoFilter = { $and: [mongoFilter, blockFilter] }; }
//                  else { Object.assign(mongoFilter, blockFilter); }
//             } else { mongoFilter = blockFilter; }
//             filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
//             console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
//         }

//         // --- Step 2: Branch based on query type ---

//         if (requiresFeeCheck) {
//             // --- Handle "Fee Check" Query ---
//             await thinkingMessage.edit(`⏳ Checking network fees and BTC price from Binance...`); // Updated message
//             let btcPriceUSD = null;
//             try {
//                  // **MODIFIED:** Get BTC price from Binance
//                  console.log(`[WhaleWatcher] Fetching BTC price from Binance (${BTC_PRICE_SYMBOL})...`);
//                  const priceData = await binanceHelper.getPrice(BTC_PRICE_SYMBOL);
//                  if (!priceData || !priceData.price) {
//                       throw new Error(`[BNB] Could not retrieve current BTC price (${BTC_PRICE_SYMBOL}) from Binance.`);
//                  }
//                  btcPriceUSD = parseFloat(priceData.price);
//                  if (isNaN(btcPriceUSD)) {
//                      throw new Error(`[BNB] Invalid price received from Binance: ${priceData.price}`);
//                  }
//                  console.log(`[WhaleWatcher] Successfully retrieved BTC price from Binance: ${btcPriceUSD}`);
//                  // **END MODIFICATION**

//                  // Then get fee info from Blockcypher
//                 const feeInfo = await blockcypherHelper.getBlockchainFeeInfo();
//                 const highFeeSatKB = feeInfo.high_fee_per_kb;
//                 const medFeeSatKB = feeInfo.medium_fee_per_kb;
//                 const lowFeeSatKB = feeInfo.low_fee_per_kb;

//                 if (highFeeSatKB === undefined || medFeeSatKB === undefined || lowFeeSatKB === undefined) {
//                     throw new Error("[BCR] Fee information missing in API response.");
//                 }

//                 const highFeeSatVB = highFeeSatKB / 1000;
//                 const medFeeSatVB = medFeeSatKB / 1000;
//                 const lowFeeSatVB = lowFeeSatKB / 1000;

//                 const calcFee = (satPerKB) => {
//                     const satPerVByte = satPerKB / 1000;
//                     const totalSat = satPerVByte * AVG_BTC_TX_SIZE_BYTES;
//                     const btc = totalSat / 1e8;
//                     const usd = btc * btcPriceUSD;
//                     return { satVb: satPerVByte.toFixed(1), btc: btc.toFixed(8), usd: usd.toFixed(2) };
//                 };

//                 const high = calcFee(highFeeSatKB);
//                 const med = calcFee(medFeeSatKB);
//                 const low = calcFee(lowFeeSatKB);

//                 fullResponseText = `**Current Bitcoin Network Fee Estimates:**\n`;
//                 fullResponseText += ` • **High Priority:** ${high.satVb} sat/vB (~${high.btc} BTC / $${high.usd})\n`;
//                 fullResponseText += ` • **Medium Priority:** ${med.satVb} sat/vB (~${med.btc} BTC / $${med.usd})\n`;
//                 fullResponseText += ` • **Low Priority:** ${low.satVb} sat/vB (~${low.btc} BTC / $${low.usd})\n`;
//                 fullResponseText += `\n*(USD estimates based on BTC ≈ $${btcPriceUSD.toLocaleString()} via Binance and ~${AVG_BTC_TX_SIZE_BYTES} vByte tx size)*`; // Updated source
//                 fullResponseText += `\n*(Fee data from Blockcypher)*`; // Removed CMC mention

//             } catch (apiError) {
//                  console.error("[WhaleWatcher] Fee Check API Error:", apiError);
//                  // Prefix should be included from helpers (BNB or BCR)
//                  fullResponseText = `Sorry, failed to get fee info: ${apiError.message}`;
//             }
//             skipAI = true;
//             fileBuffer = null;

//         } else if (requiresBalanceCheck) {
//             // --- Handle Balance Check Query ---
//             // ... (logic unchanged) ...
//             if (!targetAddress) { throw new Error("Target address missing for balance check."); }
//             await thinkingMessage.edit(`⏳ Checking balance via Blockcypher for ${targetAddress.substring(0,6)}...`);
//             try {
//                 const balanceInfo = await blockcypherHelper.getAddressBalance(targetAddress);
//                 const finalBalanceBTC = (balanceInfo.final_balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8});
//                 const confirmedBalanceBTC = (balanceInfo.balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8});
//                 const unconfirmedBalanceBTC = (balanceInfo.unconfirmed_balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8});
//                 fullResponseText = `**Balance for \`${balanceInfo.address}\`:**\n`;
//                 fullResponseText += ` • Confirmed: **${confirmedBalanceBTC} BTC**\n`;
//                 fullResponseText += ` • Unconfirmed: ${unconfirmedBalanceBTC} BTC\n`;
//                 fullResponseText += ` • Total (Final): **${finalBalanceBTC} BTC**\n`;
//                 fullResponseText += ` • Total Txns: ${balanceInfo.final_n_tx}`;
//                 fullResponseText += `\n*(Data from Blockcypher)*`;
//             } catch (apiError) {
//                  console.error("[WhaleWatcher] Balance Check API Error:", apiError);
//                  fullResponseText = `Sorry, failed to get balance: ${apiError.message}`;
//             }
//             skipAI = true;
//             fileBuffer = null;

//         } else if (requiresRelationCheck) {
//              // --- Handle "Relation Cluster" Query ---
//              // ... (logic unchanged) ...
//              if (!targetAddress) { throw new Error("Target address missing for relation check."); }
//              await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}... (${filterDescription})...`);
//              if (typeof mongoHelper.findAddressRelations !== 'function') { throw new Error("[System] Relation query function not available."); }
//              const allInteractions = await mongoHelper.findAddressRelations(targetAddress, mongoFilter);
//              if (!allInteractions || allInteractions.length === 0) {
//                  fullResponseText = `No direct interactions found for \`${targetAddress}\` within the specified period (${filterDescription}).`;
//                  fileBuffer = null;
//              } else {
//                  const allInteractionCounterparties = [...new Set(allInteractions.map(i => i.counterparty))];
//                  const allLabelsMap = await mongoHelper.getLabelsForAddresses(allInteractionCounterparties);
//                  console.log(`[WhaleWatcher] Fetched ${allLabelsMap.size} labels for ${allInteractionCounterparties.length} total counterparties for CSV.`);
//                  fileName = `relations_${targetAddress.substring(0,10)}_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`;
//                  fileBuffer = generateDataFile(allInteractions, 'relations', 'csv', allLabelsMap);
//                  const summaryRelations = {};
//                  allInteractions.forEach(interaction => { const cpAddr = interaction.counterparty; if (!summaryRelations[cpAddr]) { summaryRelations[cpAddr] = { totalInBTC: 0, totalOutBTC: 0, txCount: 0, types: new Set() }; } summaryRelations[cpAddr].txCount++; summaryRelations[cpAddr].types.add(interaction.txType); if (interaction.direction === 'IN') { summaryRelations[cpAddr].totalInBTC += interaction.valueBTC; } else if (interaction.direction === 'OUT') { summaryRelations[cpAddr].totalOutBTC += interaction.valueBTC; } });
//                  const allCounterparties = Object.keys(summaryRelations);
//                  const sortedCounterparties = allCounterparties.sort((a, b) => (summaryRelations[b].totalInBTC + summaryRelations[b].totalOutBTC) - (summaryRelations[a].totalInBTC + summaryRelations[a].totalOutBTC) );
//                  const limitedCounterparties = sortedCounterparties.slice(0, RELATION_DISPLAY_LIMIT);
//                  const displayLabelsMap = new Map(limitedCounterparties.map(addr => [addr, allLabelsMap.get(addr)]).filter(entry => entry[1]));
//                  fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n*(Showing Top ${limitedCounterparties.length} of ${allCounterparties.length} total counterparties by volume)*\n\n`;
//                  limitedCounterparties.forEach((cpAddr, index) => { const data = summaryRelations[cpAddr]; const label = displayLabelsMap.get(cpAddr); const inBTC = data.totalInBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const outBTC = data.totalOutBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const types = Array.from(data.types).join(', ').replace(/_/g, ' '); const line = `${index + 1}. \`${cpAddr}\`${label ? ` (*${label}*)` : ''}: IN **${inBTC}** | OUT **${outBTC}** | (${data.txCount} txs) | Types: *${types}*\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; } });
//                  if (allCounterparties.length > RELATION_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allCounterparties.length - RELATION_DISPLAY_LIMIT} more interactions.`; }
//                  fullResponseText += `\n\n*See attached CSV for all ${allInteractions.length} individual interactions (sorted by time), including TxHashes & Labels.*`;
//                  fullResponseText += `\n*Tx Types key: single=1:1, consolidation=many:1(target), distribution=1(target):many.*`;
//              }
//              skipAI = true;

//         } else if (requiresMostActiveCheck) {
//             // --- Handle "Most Active" Query ---
//             // ... (logic unchanged) ...
//              await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`);
//              const allActiveAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_FETCH_LIMIT);
//              if (!allActiveAddresses || allActiveAddresses.length === 0) { fullResponseText = `No significant address activity found for: \`${filterDescription}\``; fileBuffer = null; }
//              else {
//                   fileName = `most_active_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`;
//                   fileBuffer = generateDataFile(allActiveAddresses, 'most_active', 'csv');
//                   const limitedActiveAddresses = allActiveAddresses.slice(0, MOST_ACTIVE_DISPLAY_LIMIT);
//                   fullResponseText = `**Most Active Addresses (${filterDescription}):**\n*(Showing Top ${limitedActiveAddresses.length} of ${allActiveAddresses.length} found by Tx Count)*\n\n`;
//                   limitedActiveAddresses.forEach((item, index) => { const inBTC = item.totalInBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const outBTC = item.totalOutBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const line = `${index + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; } });
//                   if (allActiveAddresses.length > MOST_ACTIVE_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allActiveAddresses.length - MOST_ACTIVE_DISPLAY_LIMIT} more (see attached CSV).`; }
//              }
//              skipAI = true;

//         } else {
//             // --- Handle Standard Transaction Summary Query ---
//             // ... (logic unchanged except for prompt construction call) ...
//              await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
//              let summaryData, topTransactions;
//              try {
//                  const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI);
//                  summaryData = results.summary;
//                  topTransactions = results.topTransactions;
//                  summaryData.filter = filterDescription;
//                  if (!summaryData || topTransactions.length === 0) { await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``); return; }
//                  console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`);
//              } catch (dbError) { throw new Error(dbError.message.startsWith('[DB]') ? dbError.message : `[DB] ${dbError.message}`); }
//              if (topTransactions.length > 0) { await thinkingMessage.edit("⏳ Generating data file..."); fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}byValue.csv`; fileBuffer = generateDataFile(topTransactions, 'transactions', 'csv'); }

//              finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery); // Uses updated prompt constructor

//              let encoding;
//              try {
//                  if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) { console.error("[WhaleWatcher] Invalid finalPrompt generated (null or empty). Skipping AI."); fullResponseText = `*(Could not construct analysis prompt. Displaying summary only)*\n\n**Overall Summary (${filterDescription}):**\nTotal Volume: ${summaryData.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nTx Count: ${summaryData.totalTxCount || 0}\nBlock Range: ${summaryData.minBlock && summaryData.maxBlock ? `${summaryData.minBlock} - ${summaryData.maxBlock}` : 'N/A'}`; skipAI = true; }
//                  else { encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Estimated prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}). May be truncated by AI.`); } encoding.free(); }
//              } catch (tokenError) { if(encoding) encoding.free(); console.error("[WhaleWatcher] Token estimation error:", tokenError); throw new Error(`[System] Error estimating AI tokens: ${tokenError.message}`); }

//              if (!skipAI) {
//                   await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs with ${process.env.AI_PROVIDER}...`);
//                   let stream = null;
//                   try { stream = aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); }
//                   catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }
//                   fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false;
//                   try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } } else { console.warn("Truncating stream output due to Discord length limit."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } console.log(`[WhaleWatcher] AI Stream finished.`); }
//                   catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; }
//                   if (!streamErrored) { fullResponseText += accumulatedChunk; }
//                   if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }
//              }
//         }

//         // --- Final Discord Message Update ---
//         // ... (logic unchanged) ...
//         console.log("[WhaleWatcher] Preparing final message edit...");
//         let finalReplyOptions = {};
//         if (fullResponseText.length === 0 && !skipAI) { fullResponseText = "Sorry, couldn't generate a response or analysis."; }
//         else if (fullResponseText.length === 0 && skipAI) { fullResponseText = `No specific data found for your query (\`${filterDescription}\`).`; }
//         if (fullResponseText.endsWith("...") && !fullResponseText.includes("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
//         if (!skipAI && fullResponseText.length > 0 && !fullResponseText.toLowerCase().includes("not financial advice") && !fullResponseText.toLowerCase().startsWith("error") && !fullResponseText.toLowerCase().includes("failed")) { fullResponseText += "\n\n*(Disclaimer: AI analysis, NOT financial advice.)*"; }
//         if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";
//         finalReplyOptions.content = fullResponseText;
//         finalReplyOptions.files = [];
//         if (fileBuffer) { const attachment = new AttachmentBuilder(fileBuffer, { name: fileName }); finalReplyOptions.files.push(attachment); const fileNote = `\n\n*See attached \`${fileName}\` for full details.*`; if (finalReplyOptions.content.length + fileNote.length <= 2000) { finalReplyOptions.content += fileNote; } else { console.warn("[WhaleWatcher] Content too long to add file attachment note."); } }
//         else { if (!requiresBalanceCheck && !requiresFeeCheck && !requiresRelationCheck && !requiresMostActiveCheck) { if (!fullResponseText.toLowerCase().includes("no whale transaction data found")) { const fileErrorNote = `\n\n*(Note: Data file could not be generated)*`; if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) { finalReplyOptions.content += fileErrorNote; } } } }
//         console.log('[WhaleWatcher] Final Reply Options:', {content: finalReplyOptions.content.substring(0,100)+'...', fileCount: finalReplyOptions.files.length});
//         await thinkingMessage.edit(finalReplyOptions);
//         console.log("[WhaleWatcher] Final message sent/edited.");

//     } catch (error) { // Catch top-level errors
//         console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
//         const prefixRegex = /^\[(DS|GE|CMC|BCR|BNB|OAI|DB|System)\]/; // Added BNB
//         const errorMsg = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;
//         const finalErrorMsg = `Sorry, encountered an error: ${errorMsg}`;
//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: finalErrorMsg.substring(0, 2000), embeds: [], files: [], components:[] }); } catch (e) { await message.reply(finalErrorMsg.substring(0, 2000)); } }
//         else { await message.reply(finalErrorMsg.substring(0, 2000)); }
//     }
// } // End handleWhaleCommand

// module.exports = { handleWhaleCommand };

// commands/whaleWatcher.js
const { ObjectId } = require('mongodb');
const { get_encoding } = require('tiktoken');
const { AttachmentBuilder } = require('discord.js');
const mongoHelper = require('../services/mongoHelper');
const aiHelper = require('../services/aiHelper');
const blockcypherHelper = require('../services/blockcypherHelper');
const binanceHelper = require('../services/binanceHelper'); // Use Binance for price
const { parseWhaleQuery } = require('../utils/filterParser');
const { stringify } = require('csv-stringify/sync');

// --- Configuration ---
const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';
const MOST_ACTIVE_DISPLAY_LIMIT = 15;
const MOST_ACTIVE_FETCH_LIMIT = 50;
const RELATION_DISPLAY_LIMIT = 15;
const AVG_BTC_TX_SIZE_BYTES = 250;
const BTC_PRICE_SYMBOL = 'BTCUSDT';

// --- Helper: Generate Data File ---
// (No changes needed in this helper function)
function generateDataFile(data, type = 'transactions', format = 'csv', labelsMap = new Map()) {
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${data.length} ${type}...`);
    let dataForFile; let columns; let defaultColumns;
    try {
        if (type === 'transactions') { defaultColumns = ['Timestamp', 'Block', 'Value_BTC', 'TxHash', 'From_Addresses', 'From_Labels', 'To_Addresses', 'To_Labels', 'Explorer_Link']; dataForFile = data.map(tx => { let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} } const valueBTC = Number(tx?.value?.$numberLong || tx?.value || 0) / 1e8; const fromLabels = Array.isArray(tx.fromLabels) ? tx.fromLabels.join(' | ') : ''; const toLabels = Array.isArray(tx.toLabels) ? tx.toLabels.join(' | ') : ''; return { Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block, Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A', From_Addresses: tx?.from?.join(', ') || '', From_Labels: fromLabels, To_Addresses: tx?.to?.join(', ') || '', To_Labels: toLabels, Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`, }; }); }
        else if (type === 'most_active') { defaultColumns = ['Rank', 'Address', 'Label', 'Tx_Count', 'Total_IN_BTC', 'Total_OUT_BTC']; dataForFile = data.map((item, index) => ({ Rank: index + 1, Address: item.address, Label: item.label || '', Tx_Count: item.count, Total_IN_BTC: item.totalInBTC.toFixed(8), Total_OUT_BTC: item.totalOutBTC.toFixed(8) })); }
        else if (type === 'relations') { defaultColumns = ['TxHash', 'Timestamp', 'Block', 'Counterparty', 'Counterparty_Label', 'Direction', 'Value_BTC', 'Tx_Type']; dataForFile = data.map(item => ({ TxHash: item.txHash || 'N/A', Timestamp: item.timestamp || '', Block: item.block, Counterparty: item.counterparty, Counterparty_Label: labelsMap.get(item.counterparty) || '', Direction: item.direction, Value_BTC: item.valueBTC.toFixed(8), Tx_Type: item.txType })); dataForFile.sort((a, b) => (a.Timestamp && b.Timestamp) ? new Date(b.Timestamp) - new Date(a.Timestamp) : 0); }
        else { throw new Error(`Unknown data type: ${type}`); }
        if (format === 'csv' && stringify) { columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : defaultColumns; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
        else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
        else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file for type ${type}:`, fileError); return null; }
}

// --- Helper: Construct AI Prompt ---
// (No changes needed in this helper function)
const constructWhalePrompt = (summary, topNData, query) => {
    if (!summary || typeof summary !== 'object' || !topNData || !Array.isArray(topNData)) { console.error('[constructWhalePrompt] Invalid summary or topNData received.'); return null; }
    let dataPrompt = `User Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`; let processedData;
    try { processedData = topNData.map(doc => { if (!doc) return null; const valueRaw = doc.value?.$numberLong || doc.value?.$numberInt || doc.value; const valueNum = Number(valueRaw || 0); const blockNum = doc.block?.$numberInt || doc.block?.$numberLong || doc.block; const newDoc = { txHash: doc.txHash || null, timestamp: null, block: blockNum, valueBTC: parseFloat((valueNum / 1e8).toFixed(4)), from: doc.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] }; if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} } return newDoc; }).filter(Boolean); dataPrompt += JSON.stringify(processedData, null, 2); }
    catch (stringifyError) { console.error("[constructWhalePrompt] Error processing/stringifying transaction data:", stringifyError); dataPrompt += `[Error processing transaction details: ${stringifyError.message}]`; return null; } dataPrompt += `\n\`\`\`\n`;
    const analysisTask = `
Analysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions provided above, generate a concise analysis using Markdown formatting. Structure your response like this:
1.  **Overall Activity:** Briefly comment on the total volume, transaction count, and block range.
2.  **Largest Transactions:** List the 1-2 largest transactions from the top ${topNData.length}. For each, mention the approximate BTC value, involved parties (especially known labels/exchanges), and the transaction hash using an inline code block (e.g., \`abc...xyz\`).
3.  **Notable Activity:** Use bullet points (\`*\`) to highlight any other significant transactions or patterns involving known whales or exchanges from the provided data. Mention relevant transaction hashes in inline code blocks.
4.  **Market Context (Optional):** If the overall volume/flows seem significant, add a *brief, cautious* comment on potential market implications (e.g., increased activity, potential volatility).
5.  **Conciseness:** Keep the entire response under ~450 tokens.
6.  **Formatting:** Use Markdown bold (\`**bold**\`) for headings and emphasis. Use inline code blocks (\`hash\`) for transaction hashes. DO NOT format hashes as links.
`;
    const finalPrompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\n${dataPrompt}\n${analysisTask}`;
    console.log("[constructWhalePrompt] Successfully constructed prompt with formatting instructions."); return finalPrompt;
};


// --- Main Handler Function ---
async function handleWhaleCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Use \`!whale <query>\` e.g., \`!whale last hour\`, \`!whale fee\``); return; }

    console.log(`[WhaleWatcher] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = "";
    let fileBuffer = null;
    let fileName = 'whale_report.csv';
    let finalPrompt = "";
    let skipAI = false;

    try {
        thinkingMessage = await message.reply("⏳ Preparing whale report...");

        // Step 1: Parse the user query
        const parseResult = parseWhaleQuery(userQuery);
        // ** Handle parse error directly with help suggestion **
        if (parseResult.parseError) {
             throw new Error(`Invalid command format: ${parseResult.parseError}.`); // Let the main catch handle adding help suggestion
        }

        let mongoFilter = parseResult.mongoFilter;
        let filterDescription = parseResult.filterDescription;
        const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
        const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
        const requiresRelationCheck = parseResult.requiresRelationCheck;
        const requiresBalanceCheck = parseResult.requiresBalanceCheck;
        const requiresFeeCheck = parseResult.requiresFeeCheck;
        const targetAddress = parseResult.targetAddress;

        // Step 1b: Handle 'latest block' lookups (if needed)
        if (requiresLatestBlockLookup) {
            // ... (logic unchanged) ...
            await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
            const latestBlock = await mongoHelper.getLatestBlockNumber();
            if (latestBlock === null) { throw new Error("[DB] Could not determine the latest block number from the database."); }
            const blockFilter = { block: latestBlock }; if (mongoFilter && Object.keys(mongoFilter).length > 0) { if (mongoFilter['$or']) { mongoFilter = { $and: [mongoFilter, blockFilter] }; } else { Object.assign(mongoFilter, blockFilter); } } else { mongoFilter = blockFilter; } filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`); console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
        }

        // --- Step 2: Branch based on query type ---

        if (requiresFeeCheck) {
            // --- Handle "Fee Check" Query ---
             // ... (logic unchanged, uses binanceHelper) ...
            await thinkingMessage.edit(`⏳ Checking network fees and BTC price from Binance...`); let btcPriceUSD = null; try { console.log(`[WhaleWatcher] Fetching BTC price from Binance (${BTC_PRICE_SYMBOL})...`); const priceData = await binanceHelper.getPrice(BTC_PRICE_SYMBOL); if (!priceData || !priceData.price) { throw new Error(`[BNB] Could not retrieve current BTC price (${BTC_PRICE_SYMBOL}) from Binance.`); } btcPriceUSD = parseFloat(priceData.price); if (isNaN(btcPriceUSD)) { throw new Error(`[BNB] Invalid price received from Binance: ${priceData.price}`); } console.log(`[WhaleWatcher] Successfully retrieved BTC price from Binance: ${btcPriceUSD}`); const feeInfo = await blockcypherHelper.getBlockchainFeeInfo(); const highFeeSatKB = feeInfo.high_fee_per_kb; const medFeeSatKB = feeInfo.medium_fee_per_kb; const lowFeeSatKB = feeInfo.low_fee_per_kb; if (highFeeSatKB === undefined || medFeeSatKB === undefined || lowFeeSatKB === undefined) { throw new Error("[BCR] Fee information missing in API response."); } const highFeeSatVB = highFeeSatKB / 1000; const medFeeSatVB = medFeeSatKB / 1000; const lowFeeSatVB = lowFeeSatKB / 1000; const calcFee = (satPerKB) => { const satPerVByte = satPerKB / 1000; const totalSat = satPerVByte * AVG_BTC_TX_SIZE_BYTES; const btc = totalSat / 1e8; const usd = btc * btcPriceUSD; return { satVb: satPerVByte.toFixed(1), btc: btc.toFixed(8), usd: usd.toFixed(2) }; }; const high = calcFee(highFeeSatKB); const med = calcFee(medFeeSatKB); const low = calcFee(lowFeeSatKB); fullResponseText = `**Current Bitcoin Network Fee Estimates:**\n`; fullResponseText += ` • **High Priority:** ${high.satVb} sat/vB (~${high.btc} BTC / $${high.usd})\n`; fullResponseText += ` • **Medium Priority:** ${med.satVb} sat/vB (~${med.btc} BTC / $${med.usd})\n`; fullResponseText += ` • **Low Priority:** ${low.satVb} sat/vB (~${low.btc} BTC / $${low.usd})\n`; fullResponseText += `\n*(USD estimates based on BTC ≈ $${btcPriceUSD.toLocaleString()} via Binance and ~${AVG_BTC_TX_SIZE_BYTES} vByte tx size)*`; fullResponseText += `\n*(Fee data from Blockcypher)*`; } catch (apiError) { console.error("[WhaleWatcher] Fee Check API Error:", apiError); fullResponseText = `Sorry, failed to get fee info: ${apiError.message}`; } skipAI = true; fileBuffer = null;

        } else if (requiresBalanceCheck) {
            // --- Handle Balance Check Query ---
             // ... (logic unchanged) ...
            if (!targetAddress) { throw new Error("Target address missing for balance check."); } await thinkingMessage.edit(`⏳ Checking balance via Blockcypher for ${targetAddress.substring(0,6)}...`); try { const balanceInfo = await blockcypherHelper.getAddressBalance(targetAddress); const finalBalanceBTC = (balanceInfo.final_balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8}); const confirmedBalanceBTC = (balanceInfo.balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8}); const unconfirmedBalanceBTC = (balanceInfo.unconfirmed_balance / 1e8).toLocaleString(undefined, {minimumFractionDigits: 8, maximumFractionDigits: 8}); fullResponseText = `**Balance for \`${balanceInfo.address}\`:**\n`; fullResponseText += ` • Confirmed: **${confirmedBalanceBTC} BTC**\n`; fullResponseText += ` • Unconfirmed: ${unconfirmedBalanceBTC} BTC\n`; fullResponseText += ` • Total (Final): **${finalBalanceBTC} BTC**\n`; fullResponseText += ` • Total Txns: ${balanceInfo.final_n_tx}`; fullResponseText += `\n*(Data from Blockcypher)*`; } catch (apiError) { console.error("[WhaleWatcher] Balance Check API Error:", apiError); fullResponseText = `Sorry, failed to get balance: ${apiError.message}`; } skipAI = true; fileBuffer = null;

        } else if (requiresRelationCheck) {
             // --- Handle "Relation Cluster" Query ---
             // ... (logic unchanged) ...
             if (!targetAddress) { throw new Error("Target address missing for relation check."); } await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}... (${filterDescription})...`); if (typeof mongoHelper.findAddressRelations !== 'function') { throw new Error("[System] Relation query function not available."); } const allInteractions = await mongoHelper.findAddressRelations(targetAddress, mongoFilter); if (!allInteractions || allInteractions.length === 0) { fullResponseText = `No direct interactions found for \`${targetAddress}\` within the specified period (${filterDescription}).`; fileBuffer = null; } else { const allInteractionCounterparties = [...new Set(allInteractions.map(i => i.counterparty))]; const allLabelsMap = await mongoHelper.getLabelsForAddresses(allInteractionCounterparties); console.log(`[WhaleWatcher] Fetched ${allLabelsMap.size} labels for ${allInteractionCounterparties.length} total counterparties for CSV.`); fileName = `relations_${targetAddress.substring(0,10)}_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`; fileBuffer = generateDataFile(allInteractions, 'relations', 'csv', allLabelsMap); const summaryRelations = {}; allInteractions.forEach(interaction => { const cpAddr = interaction.counterparty; if (!summaryRelations[cpAddr]) { summaryRelations[cpAddr] = { totalInBTC: 0, totalOutBTC: 0, txCount: 0, types: new Set() }; } summaryRelations[cpAddr].txCount++; summaryRelations[cpAddr].types.add(interaction.txType); if (interaction.direction === 'IN') { summaryRelations[cpAddr].totalInBTC += interaction.valueBTC; } else if (interaction.direction === 'OUT') { summaryRelations[cpAddr].totalOutBTC += interaction.valueBTC; } }); const allCounterparties = Object.keys(summaryRelations); const sortedCounterparties = allCounterparties.sort((a, b) => (summaryRelations[b].totalInBTC + summaryRelations[b].totalOutBTC) - (summaryRelations[a].totalInBTC + summaryRelations[a].totalOutBTC) ); const limitedCounterparties = sortedCounterparties.slice(0, RELATION_DISPLAY_LIMIT); const displayLabelsMap = new Map(limitedCounterparties.map(addr => [addr, allLabelsMap.get(addr)]).filter(entry => entry[1])); fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n*(Showing Top ${limitedCounterparties.length} of ${allCounterparties.length} total counterparties by volume)*\n\n`; limitedCounterparties.forEach((cpAddr, index) => { const data = summaryRelations[cpAddr]; const label = displayLabelsMap.get(cpAddr); const inBTC = data.totalInBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const outBTC = data.totalOutBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const types = Array.from(data.types).join(', ').replace(/_/g, ' '); const line = `${index + 1}. \`${cpAddr}\`${label ? ` (*${label}*)` : ''}: IN **${inBTC}** | OUT **${outBTC}** | (${data.txCount} txs) | Types: *${types}*\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; } }); if (allCounterparties.length > RELATION_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allCounterparties.length - RELATION_DISPLAY_LIMIT} more interactions.`; } fullResponseText += `\n\n*See attached CSV for all ${allInteractions.length} individual interactions (sorted by time), including TxHashes & Labels.*`; fullResponseText += `\n*Tx Types key: single=1:1, consolidation=many:1(target), distribution=1(target):many.*`; } skipAI = true;

        } else if (requiresMostActiveCheck) {
            // --- Handle "Most Active" Query ---
             // ... (logic unchanged) ...
             await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`); const allActiveAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_FETCH_LIMIT); if (!allActiveAddresses || allActiveAddresses.length === 0) { fullResponseText = `No significant address activity found for: \`${filterDescription}\``; fileBuffer = null; } else { fileName = `most_active_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`; fileBuffer = generateDataFile(allActiveAddresses, 'most_active', 'csv'); const limitedActiveAddresses = allActiveAddresses.slice(0, MOST_ACTIVE_DISPLAY_LIMIT); fullResponseText = `**Most Active Addresses (${filterDescription}):**\n*(Showing Top ${limitedActiveAddresses.length} of ${allActiveAddresses.length} found by Tx Count)*\n\n`; limitedActiveAddresses.forEach((item, index) => { const inBTC = item.totalInBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const outBTC = item.totalOutBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const line = `${index + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; } }); if (allActiveAddresses.length > MOST_ACTIVE_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allActiveAddresses.length - MOST_ACTIVE_DISPLAY_LIMIT} more (see attached CSV).`; } } skipAI = true;

        } else {
            // --- Handle Standard Transaction Summary Query ---
             // ... (logic unchanged) ...
             await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`); let summaryData, topTransactions; try { const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI); summaryData = results.summary; topTransactions = results.topTransactions; summaryData.filter = filterDescription; if (!summaryData || topTransactions.length === 0) { await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``); return; } console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`); } catch (dbError) { throw new Error(dbError.message.startsWith('[DB]') ? dbError.message : `[DB] ${dbError.message}`); } if (topTransactions.length > 0) { await thinkingMessage.edit("⏳ Generating data file..."); fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}byValue.csv`; fileBuffer = generateDataFile(topTransactions, 'transactions', 'csv'); }
             finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery);
             let encoding; try { if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) { console.error("[WhaleWatcher] Invalid finalPrompt generated (null or empty). Skipping AI."); fullResponseText = `*(Could not construct analysis prompt. Displaying summary only)*\n\n**Overall Summary (${filterDescription}):**\nTotal Volume: ${summaryData.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nTx Count: ${summaryData.totalTxCount || 0}\nBlock Range: ${summaryData.minBlock && summaryData.maxBlock ? `${summaryData.minBlock} - ${summaryData.maxBlock}` : 'N/A'}`; skipAI = true; } else { encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Estimated prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}). May be truncated by AI.`); } encoding.free(); } } catch (tokenError) { if(encoding) encoding.free(); console.error("[WhaleWatcher] Token estimation error:", tokenError); throw new Error(`[System] Error estimating AI tokens: ${tokenError.message}`); }
             if (!skipAI) { await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs with ${process.env.AI_PROVIDER}...`); let stream = null; try { stream = aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); } catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); } fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } } else { console.warn("Truncating stream output due to Discord length limit."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } console.log(`[WhaleWatcher] AI Stream finished.`); } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; } if (!streamErrored) { fullResponseText += accumulatedChunk; } if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; } }
        }

        // --- Final Discord Message Update ---
        // ... (logic unchanged) ...
        console.log("[WhaleWatcher] Preparing final message edit..."); let finalReplyOptions = {}; if (fullResponseText.length === 0 && !skipAI) { fullResponseText = "Sorry, couldn't generate a response or analysis."; } else if (fullResponseText.length === 0 && skipAI) { fullResponseText = `No specific data found for your query (\`${filterDescription}\`).`; } if (fullResponseText.endsWith("...") && !fullResponseText.includes("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); } if (!skipAI && fullResponseText.length > 0 && !fullResponseText.toLowerCase().includes("not financial advice") && !fullResponseText.toLowerCase().startsWith("error") && !fullResponseText.toLowerCase().includes("failed")) { fullResponseText += "\n\n*(Disclaimer: AI analysis, NOT financial advice.)*"; } if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "..."; finalReplyOptions.content = fullResponseText; finalReplyOptions.files = []; if (fileBuffer) { const attachment = new AttachmentBuilder(fileBuffer, { name: fileName }); finalReplyOptions.files.push(attachment); const fileNote = `\n\n*See attached \`${fileName}\` for full details.*`; if (finalReplyOptions.content.length + fileNote.length <= 2000) { finalReplyOptions.content += fileNote; } else { console.warn("[WhaleWatcher] Content too long to add file attachment note."); } } else { if (!requiresBalanceCheck && !requiresFeeCheck && !requiresRelationCheck && !requiresMostActiveCheck) { if (!fullResponseText.toLowerCase().includes("no whale transaction data found")) { const fileErrorNote = `\n\n*(Note: Data file could not be generated)*`; if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) { finalReplyOptions.content += fileErrorNote; } } } } console.log('[WhaleWatcher] Final Reply Options:', {content: finalReplyOptions.content.substring(0,100)+'...', fileCount: finalReplyOptions.files.length}); await thinkingMessage.edit(finalReplyOptions); console.log("[WhaleWatcher] Final message sent/edited.");

    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
        const prefixRegex = /^\[(DS|GE|CMC|BCR|BNB|OAI|DB|System)\]/; // Added BNB
        let errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;

        // **ADDED:** Check for parameter errors and append help suggestion
        const parameterErrorMessages = [
            "invalid command format", // From filterParser initial check
            "target address missing",
            "invalid range", // From filterParser range checks
            "invalid block number",
            "invalid block range",
            "unhandled time word",
        ];
         if (parameterErrorMessages.some(phrase => errorMsgContent.toLowerCase().includes(phrase))) {
            errorMsgContent += " Please check the command format using `!help`.";
        }

        const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: finalErrorMsg.substring(0, 2000), embeds: [], files: [], components:[] }); } catch (e) { await message.reply(finalErrorMsg.substring(0, 2000)); } }
        else { await message.reply(finalErrorMsg.substring(0, 2000)); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };






