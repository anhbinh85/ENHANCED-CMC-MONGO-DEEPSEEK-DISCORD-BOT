// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const { AttachmentBuilder } = require('discord.js');
// const mongoHelper = require('../services/mongoHelper');
// const aiHelper = require('../services/aiHelper');
// const blockcypherHelper = require('../services/blockcypherHelper'); // Used ONLY for balance & fee
// const binanceHelper = require('../services/binanceHelper'); // Use Binance for price
// const quicknodeHelper = require('../services/quicknodeHelper'); // <-- Used for TX analysis now
// const transactionAnalyzer = require('../utils/transactionAnalyzer'); // <-- For analysis logic
// const { parseWhaleQuery } = require('../utils/filterParser');
// const { stringify } = require('csv-stringify/sync');

// // --- Configuration ---
// const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "10");
// const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/'; // Example explorer
// const MOST_ACTIVE_DISPLAY_LIMIT = 15;
// const MOST_ACTIVE_FETCH_LIMIT = 50;
// const RELATION_DISPLAY_LIMIT = 15;
// const AVG_BTC_TX_SIZE_BYTES = 250;
// const BTC_PRICE_SYMBOL = 'BTCUSDT';
// const MAX_TX_TO_ANALYZE = parseInt(process.env.MAX_TX_TO_ANALYZE_PER_COMMAND || "25"); // Limit RPC calls
// const EXTERNAL_THRESHOLD = parseFloat(process.env.WHALE_EXTERNAL_TRANSFER_THRESHOLD_BTC || "1");


// // --- Helper: Generate Data File ---
// // Added more safety checks for potentially undefined properties
// function generateDataFile(data, type = 'transactions', format = 'csv', labelsMap = new Map()) {
//     console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${data?.length ?? 0} ${type}...`);
//     let dataForFile; let columns; let defaultColumns;
//     // Ensure data is an array before proceeding
//     if (!Array.isArray(data)) {
//         console.error(`[generateDataFile] Error: Input data is not an array for type ${type}.`);
//         return null;
//     }
//     try {
//         if (type === 'external_movements') {
//             defaultColumns = ['TxHash', 'External_Value_BTC', 'Fee_BTC', 'External_Outputs_Count', 'External_Outputs_Details', 'Change_Outputs_Count', 'Change_Outputs_Details', 'Explorer_Link'];
//             dataForFile = data.map(m => {
//                 const formatOutputs = (outputs) => {
//                      if (!Array.isArray(outputs)) return '';
//                      // Ensure valueBTC exists and is a number before calling toFixed
//                      return outputs.map(o => `${o?.address || 'N/A'}${labelsMap.get(o?.address) ? ` (${labelsMap.get(o.address)})` : ''}: ${(typeof o?.valueBTC === 'number' ? o.valueBTC.toFixed(4) : 'N/A')} BTC`).join(' | ');
//                 }
//                 return {
//                     TxHash: m?.txid || 'N/A',
//                     External_Value_BTC: typeof m?.externalValueBTC === 'number' ? m.externalValueBTC.toFixed(8) : '0.00000000',
//                     Fee_BTC: typeof m?.feeBTC === 'number' ? m.feeBTC.toFixed(8) : '0.00000000',
//                     External_Outputs_Count: m?.externalOutputs?.length ?? 0,
//                     External_Outputs_Details: formatOutputs(m?.externalOutputs),
//                     Change_Outputs_Count: m?.changeOutputs?.length ?? 0,
//                     Change_Outputs_Details: formatOutputs(m?.changeOutputs),
//                     Explorer_Link: `${BLOCK_EXPLORER_URL}${m?.txid || ''}`,
//                 };
//             });
//             dataForFile.sort((a, b) => parseFloat(b.External_Value_BTC) - parseFloat(a.External_Value_BTC));

//         } else if (type === 'most_active') {
//             defaultColumns = ['Rank', 'Address', 'Label', 'Tx_Count', 'Total_IN_BTC', 'Total_OUT_BTC'];
//             dataForFile = data.map((item, index) => ({
//                 Rank: index + 1,
//                 Address: item?.address || 'N/A',
//                 Label: item?.label || '',
//                 Tx_Count: item?.count ?? 0,
//                 Total_IN_BTC: typeof item?.totalInBTC === 'number' ? item.totalInBTC.toFixed(8) : '0.00000000',
//                 Total_OUT_BTC: typeof item?.totalOutBTC === 'number' ? item.totalOutBTC.toFixed(8) : '0.00000000'
//             }));
//         } else if (type === 'relations') {
//             defaultColumns = ['TxHash', 'Timestamp', 'Block', 'Counterparty', 'Counterparty_Label', 'Direction', 'Value_BTC', 'Tx_Type'];
//             dataForFile = data.map(item => ({
//                 TxHash: item?.txHash || 'N/A',
//                 Timestamp: item?.timestamp || '',
//                 Block: item?.block ?? 'N/A',
//                 Counterparty: item?.counterparty || 'N/A',
//                 Counterparty_Label: labelsMap.get(item?.counterparty) || '',
//                 Direction: item?.direction || 'N/A',
//                 // Added safety check here previously
//                 Value_BTC: (typeof item?.valueBTC === 'number') ? item.valueBTC.toFixed(8) : '0.00000000',
//                 Tx_Type: item?.txType || 'N/A'
//             }));
//             dataForFile.sort((a, b) => (a.Timestamp && b.Timestamp) ? new Date(b.Timestamp) - new Date(a.Timestamp) : 0);
//         } else {
//             console.warn(`[generateDataFile] Unknown data type: ${type}. Falling back to basic tx dump.`);
//             defaultColumns = ['TxHash', 'Value_BTC', 'Block'];
//             dataForFile = data.map(item => ({
//                 TxHash: item?.txHash || item?.hash || item?.txid || 'N/A',
//                  Value_BTC: (Number(item?.value?.$numberLong || item?.value || item?.externalValueBTC || 0) / 1e8).toFixed(8), // Basic fallback
//                  Block: item?.block?.$numberInt || item?.block?.$numberLong || item?.block || 'N/A'
//             }));
//         }

//         if (format === 'csv' && stringify) {
//             columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : defaultColumns;
//             const csvString = stringify(dataForFile, { header: true, columns: columns });
//             return Buffer.from(csvString, 'utf-8');
//         } else if (format === 'json') {
//             const jsonString = JSON.stringify(dataForFile, null, 2);
//             return Buffer.from(jsonString, 'utf-8');
//         } else {
//             throw new Error("Invalid format or csv-stringify missing.");
//         }
//     } catch (fileError) {
//         console.error(`[WhaleWatcher] Error generating ${format} file for type ${type}:`, fileError);
//         return null;
//     }
// }


// // --- Helper: Construct AI Prompt for Filtered Movements ---
// // (No changes needed here, assumes analyzedMovements is valid)
// function constructFilteredWhalePrompt(analyzedMovements, query, filterDescription) {
//     if (!Array.isArray(analyzedMovements)) {
//         console.error('[constructFilteredWhalePrompt] Invalid analyzedMovements received.');
//         return null;
//     }
//     let prompt = `You are an AI analyzing verified external Bitcoin whale movements (external value > ${EXTERNAL_THRESHOLD} BTC).\nUser Query: "${query}"\nFilter Applied: "${filterDescription}"\n\n== Verified External Whale Movements ==\n`;
//     if (analyzedMovements.length === 0) {
//         prompt += "No significant external whale movements detected matching the criteria.\n";
//     } else {
//         prompt += `Based on analysis of raw transactions, the following ${analyzedMovements.length} external movement(s) were identified:\n`;
//         prompt += "```json\n";
//         const dataForAI = analyzedMovements.slice(0, TOP_N_FOR_AI).map(m => {
//             const getLabel = (addr) => m?.labels?.get(addr) || null;
//             return {
//                 txid: m?.txid || 'N/A',
//                 externalValueBTC: parseFloat((m?.externalValueBTC || 0).toFixed(4)),
//                 externalOutputs: m?.externalOutputs?.map(o => ({
//                     address: o?.address || 'N/A',
//                     value: parseFloat((o?.valueBTC || 0).toFixed(4)),
//                     label: getLabel(o?.address)
//                 })) || [],
//                 feeBTC: parseFloat((m?.feeBTC || 0).toFixed(8)),
//             };
//         });
//         try { prompt += JSON.stringify(dataForAI, null, 2); }
//         catch (e) { prompt += "[Error formatting data]"; console.error("Error stringifying filtered data:", e); return null; }
//         prompt += "\n```\n";
//         if (analyzedMovements.length > TOP_N_FOR_AI) {
//             prompt += `\n*(Showing top ${TOP_N_FOR_AI} movements. See CSV for all ${analyzedMovements.length}.)*\n`;
//         }
//     }
//     prompt += `\nAnalysis Task:\n1. Summarize key external movements (txid, externalValueBTC, recipients/labels).\n2. Highlight largest external transfer(s).\n3. Focus ONLY on provided external movements.\n4. **Be concise (<450 tokens).** Use Markdown (\`**bold**\`, \`*list*\`, \`txid\`).\n5. Conclude with "(Disclaimer: NOT financial advice.)"`;
//     console.log("[constructFilteredWhalePrompt] Successfully constructed prompt.");
//     return prompt;
// }


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
//     let analyzedMovements = [];

//     try {
//         thinkingMessage = await message.reply("⏳ Preparing whale report...");
//         const parseResult = parseWhaleQuery(userQuery);
//         if (parseResult.parseError) {
//             throw new Error(`Invalid command format: ${parseResult.parseError}.`);
//         }

//         let mongoFilter = parseResult.mongoFilter;
//         let filterDescription = parseResult.filterDescription;
//         const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
//         const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
//         const requiresRelationCheck = parseResult.requiresRelationCheck;
//         const requiresBalanceCheck = parseResult.requiresBalanceCheck;
//         const requiresFeeCheck = parseResult.requiresFeeCheck;
//         const targetAddress = parseResult.targetAddress;

//         if (requiresLatestBlockLookup) {
//             await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
//             const latestBlock = await mongoHelper.getLatestBlockNumber();
//             if (latestBlock === null) throw new Error("[DB] Could not determine latest block.");
//             const blockFilter = { block: latestBlock };
//             if (mongoFilter && Object.keys(mongoFilter).length > 0) {
//                  if (mongoFilter['$or'] || mongoFilter['$and']) mongoFilter = { $and: [mongoFilter, blockFilter] };
//                  else Object.assign(mongoFilter, blockFilter);
//             } else mongoFilter = blockFilter;
//             filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
//             console.log(`[WhaleWatcher] Updated filter for block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
//         }

//         // --- Branch for non-standard commands (Use Blockcypher) ---
//         if (requiresFeeCheck) {
//             // (Fee check logic - uses blockcypherHelper, binanceHelper - unchanged)
//             await thinkingMessage.edit(`⏳ Checking network fees...`); let btcPriceUSD = null; try { const priceData = await binanceHelper.getPrice(BTC_PRICE_SYMBOL); if (!priceData?.price) throw new Error(`[BNB] Could not retrieve BTC price`); btcPriceUSD = parseFloat(priceData.price); if (isNaN(btcPriceUSD)) throw new Error(`[BNB] Invalid price: ${priceData.price}`); const feeInfo = await blockcypherHelper.getBlockchainFeeInfo(); const { high_fee_per_kb, medium_fee_per_kb, low_fee_per_kb } = feeInfo; if (high_fee_per_kb === undefined || medium_fee_per_kb === undefined || low_fee_per_kb === undefined) throw new Error("[BCR] Fee info missing."); const calcFee = (satKB) => { const satVB = satKB / 1000; const totalSat = satVB * AVG_BTC_TX_SIZE_BYTES; const btc = totalSat / 1e8; const usd = btc * btcPriceUSD; return { satVb: satVB.toFixed(1), btc: btc.toFixed(8), usd: usd.toFixed(2) }; }; const h = calcFee(high_fee_per_kb), m = calcFee(medium_fee_per_kb), l = calcFee(low_fee_per_kb); fullResponseText = `**Bitcoin Network Fee Estimates:**\n • High: ${h.satVb} sat/vB (~${h.btc} BTC / $${h.usd})\n • Medium: ${m.satVb} sat/vB (~${m.btc} BTC / $${m.usd})\n • Low: ${l.satVb} sat/vB (~${l.btc} BTC / $${l.usd})\n\n*(BTC≈$${btcPriceUSD.toLocaleString()}, ~${AVG_BTC_TX_SIZE_BYTES} vB tx | Fees: Blockcypher)*`; } catch (e) { console.error("[WhaleWatcher] Fee Check Err:", e); fullResponseText = `Sorry, failed to get fee info: ${e.message}`; } skipAI = true; fileBuffer = null;
//         } else if (requiresBalanceCheck) {
//             // (Balance check logic - uses blockcypherHelper - unchanged)
//             if (!targetAddress) throw new Error("Target address missing"); await thinkingMessage.edit(`⏳ Checking balance via Blockcypher...`); try { const balInfo = await blockcypherHelper.getAddressBalance(targetAddress); const f = (balInfo.final_balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); const c = (balInfo.balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); const u = (balInfo.unconfirmed_balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); fullResponseText = `**Balance for \`${balInfo.address}\`:**\n • Confirmed: **${c} BTC**\n • Unconfirmed: ${u} BTC\n • Total: **${f} BTC**\n • Txns: ${balInfo.final_n_tx}\n*(Data: Blockcypher)*`; } catch (e) { console.error("[WhaleWatcher] Balance Check Err:", e); fullResponseText = `Sorry, failed to get balance: ${e.message}`; } skipAI = true; fileBuffer = null;
//         } else if (requiresRelationCheck) {
//             // (Relation check logic - uses mongoHelper, generateDataFile - unchanged)
//             if (!targetAddress) throw new Error("Target address missing"); await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}...`); if (typeof mongoHelper.findAddressRelations !== 'function') throw new Error("[System] Relation query fn missing."); const allInteractions = await mongoHelper.findAddressRelations(targetAddress, mongoFilter); if (!allInteractions?.length) { fullResponseText = `No interactions found for \`${targetAddress}\` (${filterDescription}).`; fileBuffer = null; } else { const counterparties = [...new Set(allInteractions.map(i => i.counterparty))]; const labels = await mongoHelper.getLabelsForAddresses(counterparties); fileName = `relations_${targetAddress.substring(0,10)}_${filterDescription.replace(/[^a-z0-9]/gi,'_')}.csv`; fileBuffer = generateDataFile(allInteractions, 'relations', 'csv', labels); const summary = {}; allInteractions.forEach(i => { const cp = i.counterparty; if (!summary[cp]) summary[cp] = {in:0,out:0,count:0,types:new Set()}; summary[cp].count++; summary[cp].types.add(i.txType); if(i.direction==='IN') summary[cp].in+=i.valueBTC; else summary[cp].out+=i.valueBTC; }); const sorted = Object.keys(summary).sort((a,b)=>(summary[b].in+summary[b].out)-(summary[a].in+summary[a].out)); const limited = sorted.slice(0,RELATION_DISPLAY_LIMIT); const displayLbls = new Map(limited.map(a=>[a,labels.get(a)]).filter(e=>e[1])); fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n*(Top ${limited.length} of ${sorted.length} by volume)*\n\n`; limited.forEach((cp,i)=>{ const d=summary[cp]; const l=displayLbls.get(cp); const iBTC=d.in.toLocaleString(undefined,{maximumFractionDigits:8}); const oBTC=d.out.toLocaleString(undefined,{maximumFractionDigits:8}); const typs=Array.from(d.types).join(', ').replace(/_/g,' '); const line=`${i+1}. \`${cp}\`${l?` (*${l}*)`:''}: IN **${iBTC}** | OUT **${oBTC}** | (${d.count} txs) | *${typs}*\n`; if (fullResponseText.length+line.length<1900) fullResponseText+=line; else if (!fullResponseText.endsWith("...")) fullResponseText+="..."; }); if (sorted.length>limited.length) fullResponseText+=`\n...and ${sorted.length - limited.length} more.`; if (fileBuffer) fullResponseText+=`\n\n*See attached CSV for all ${allInteractions.length} interactions.*`; fullResponseText+=`\n*Types key: single=1:1, consolidation=many:1, distribution=1:many.*`; } skipAI = true;
//         } else if (requiresMostActiveCheck) {
//             // (Most Active logic - uses mongoHelper, generateDataFile - unchanged)
//             await thinkingMessage.edit(`⏳ Finding most active addresses...`); const allActive = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_FETCH_LIMIT); if (!allActive?.length) { fullResponseText = `No significant activity found for: \`${filterDescription}\``; fileBuffer = null; } else { fileName = `most_active_${filterDescription.replace(/[^a-z0-9]/gi,'_')}.csv`; fileBuffer = generateDataFile(allActive, 'most_active', 'csv'); const limited = allActive.slice(0, MOST_ACTIVE_DISPLAY_LIMIT); fullResponseText = `**Most Active Addresses (${filterDescription}):**\n*(Top ${limited.length} of ${allActive.length} by Tx Count)*\n\n`; limited.forEach((item, idx) => { const inBTC = item.totalInBTC.toLocaleString(undefined,{maximumFractionDigits:4}); const outBTC = item.totalOutBTC.toLocaleString(undefined,{maximumFractionDigits:4}); const line = `${idx + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`; if (fullResponseText.length + line.length < 1900) fullResponseText += line; else if (!fullResponseText.endsWith("...")) fullResponseText += "..."; }); if (allActive.length > limited.length) fullResponseText += `\n...and ${allActive.length - limited.length} more.`; if (fileBuffer) fullResponseText += `\n\n*See attached CSV for full details.*`; } skipAI = true;
//         } else {
//             // --- ** Standard Query Path (Using QuickNode + transactionAnalyzer) ** ---
//             await thinkingMessage.edit(`⏳ Querying transaction candidates...`);
//             const candidateLimit = MAX_TX_TO_ANALYZE + 10; // Fetch buffer
//             const candidates = await mongoHelper.queryCollection(
//                 mongoHelper.WHALE_TRANSFERS_COLLECTION, mongoFilter, candidateLimit, { _id: -1 } // Sort newest first
//             );

//             if (!candidates || candidates.length === 0) {
//                 await thinkingMessage.edit(`No potential whale transactions found in DB for: \`${filterDescription}\``); return;
//             }
//             console.log(`[WhaleWatcher] Found ${candidates.length} candidates from DB.`);
//             const txsToAnalyze = candidates.slice(0, MAX_TX_TO_ANALYZE).map(c => ({ txHash: c.txHash })).filter(c => c.txHash);

//             if (txsToAnalyze.length === 0) {
//                 await thinkingMessage.edit(`No valid transaction hashes found for analysis.`); return;
//             }

//             // *** SWITCH TO QuickNode HERE ***
//             await thinkingMessage.edit(`⏳ Analyzing details for up to ${txsToAnalyze.length} transaction(s) via QuickNode...`);
//             const analysisPromises = txsToAnalyze.map(async (txInfo) => {
//                 if (!txInfo.txHash) return null;
//                 try {
//                     // Use QuickNode Helper
//                     const txDetails = await quicknodeHelper.getTransactionDetails(txInfo.txHash);
//                     if (!txDetails) {
//                         console.warn(`[WhaleWatcher] No details returned for tx ${txInfo.txHash} from QuickNode.`);
//                         return null;
//                     }
//                     // Analyze using the transactionAnalyzer utility (ensure it handles QuickNode format)
//                     return transactionAnalyzer.analyzeTransaction(txDetails);
//                 } catch (error) {
//                     // Add [QN] prefix to error message if not already present
//                     const errMsg = error.message?.startsWith('[QN]') ? error.message : `[QN] ${error.message}`;
//                     console.error(`[WhaleWatcher] Error analyzing tx ${txInfo.txHash} with QuickNode: ${errMsg}`);
//                     return null; // Ignore errors for single tx analysis, proceed with others
//                 }
//             });
//             const analysisResults = (await Promise.all(analysisPromises)).filter(Boolean);

//             // Assign to higher scope variable AFTER filtering
//             analyzedMovements = analysisResults.filter(r => r.isWhaleMovement);
//             console.log(`[WhaleWatcher] Analysis complete. Found ${analyzedMovements.length} external whale movement(s) > ${EXTERNAL_THRESHOLD} BTC.`);

//             if (analyzedMovements.length === 0) {
//                 fullResponseText = `Analyzed ${analysisResults.length} transaction(s). No significant external whale movements (> ${EXTERNAL_THRESHOLD} BTC) found matching: \`${filterDescription}\``;
//                 skipAI = true; fileBuffer = null;
//             } else {
//                 await thinkingMessage.edit(`⏳ Fetching labels for ${analyzedMovements.length} relevant transaction(s)...`);
//                 const relevantAddresses = new Set();
//                 analyzedMovements.forEach(m => {
//                     m.inputs?.forEach(i => i?.address && relevantAddresses.add(i.address));
//                     m.externalOutputs?.forEach(o => o?.address && relevantAddresses.add(o.address));
//                     m.changeOutputs?.forEach(c => c?.address && relevantAddresses.add(c.address));
//                 });
//                 const labelsMap = await mongoHelper.getLabelsForAddresses(Array.from(relevantAddresses));
//                 console.log(`[WhaleWatcher] Fetched ${labelsMap.size} labels.`);
//                 analyzedMovements.forEach(m => m.labels = labelsMap);

//                 // Generate CSV for external movements
//                 fileName = `whale_movements_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'report'}.csv`;
//                 fileBuffer = generateDataFile(analyzedMovements, 'external_movements', 'csv', labelsMap);
//                 if (!fileBuffer) console.error(`[WhaleWatcher] Failed to generate CSV buffer.`);

//                 // Construct AI Prompt
//                 finalPrompt = constructFilteredWhalePrompt(analyzedMovements, userQuery, filterDescription);

//                 // Validate & Estimate Tokens
//                 let encoding; try { if (!finalPrompt) { console.error("[WhaleWatcher] Invalid finalPrompt. Skipping AI."); fullResponseText = `Identified ${analyzedMovements.length} external movements, but failed to generate AI summary.`; skipAI = true; } else { encoding = get_encoding(TOKENIZER_ENCODING); let tokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Est. prompt tokens: ${tokens}`); if (tokens > MAX_PROMPT_TOKENS) console.warn(`Tokens (${tokens}) > limit (${MAX_PROMPT_TOKENS}).`); encoding.free(); } } catch (e) { if(encoding) encoding.free(); console.error("[WhaleWatcher] Token error:", e); throw new Error(`[System] Token estimation error: ${e.message}`); }

//                 // Call AI (Streaming) if !skipAI
//                 if (!skipAI) {
//                     await thinkingMessage.edit(`⏳ Generating AI summary for ${analyzedMovements.length} movement(s)...`);
//                     let stream = null; try { stream = aiHelper.getAIStream(finalPrompt); } catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); } fullResponseText = ""; let chunkAcc = ""; let lastEdit = 0; const minEdit = 1500, maxAcc = 100; let streamErr = false; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) chunkAcc += content; const now = Date.now(); if (thinkingMessage && chunkAcc.length > 0 && (chunkAcc.length >= maxAcc || now - lastEdit > minEdit)) { fullResponseText += chunkAcc; chunkAcc = ""; const currentEdit = fullResponseText + "..."; if (currentEdit.length <= 2000) { try { await thinkingMessage.edit(currentEdit); lastEdit = now; } catch (e) { /* Ignore */ } } else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } } catch (e) { console.error("AI stream error:", e); streamErr = true; fullResponseText = `AI analysis stream error: ${e.message}`; } if (!streamErr) { fullResponseText += chunkAcc; } if (fullResponseText.length === 0 && !streamErr) { fullResponseText = "AI analysis returned empty response."; }
//                 }
//             }
//         } // End standard query path

//         // --- Final Discord Message Update ---
//         console.log("[WhaleWatcher] Preparing final message edit...");
//         let finalReplyOptions = { content: null, embeds: [], files: [], components: [] };

//         if (!fullResponseText && !skipAI) fullResponseText = "Sorry, couldn't generate response.";
//         else if (!fullResponseText && skipAI) fullResponseText = `No specific data found for: \`${filterDescription}\`.`;

//         if (fullResponseText?.endsWith("...") && !fullResponseText.includes("(truncated)")) fullResponseText = fullResponseText.slice(0, -3);

//         if (!skipAI && fullResponseText?.length > 0 && !fullResponseText.toLowerCase().includes("not financial advice") && !fullResponseText.toLowerCase().startsWith("error")) {
//             fullResponseText += "\n\n*(Disclaimer: AI analysis, NOT financial advice.)*";
//         }

//         if (fullResponseText && fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";
//         finalReplyOptions.content = fullResponseText;

//         if (fileBuffer) {
//             const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
//             finalReplyOptions.files.push(attachment);
//             const fileNote = `\n\n*See attached \`${fileName}\` for full details.*`;
//             if (finalReplyOptions.content && finalReplyOptions.content.length + fileNote.length <= 2000) {
//                 finalReplyOptions.content += fileNote;
//             } else console.warn("Content too long for file note.");
//         } else if (!requiresFeeCheck && !requiresBalanceCheck && !requiresRelationCheck && !requiresMostActiveCheck) {
//              // Add appropriate note if CSV wasn't generated for standard path
//              const note = analyzedMovements?.length > 0 ? `\n\n*(Note: Failed to generate detailed CSV report)*` : `\n\n*(No significant external movements found to generate CSV)*`;
//              if (finalReplyOptions.content && finalReplyOptions.content.length + note.length <= 2000) {
//                  finalReplyOptions.content += note;
//              }
//          }

//         console.log('[WhaleWatcher] Final Reply:', {content: finalReplyOptions.content?.substring(0,100)+'...', files: finalReplyOptions.files.length});
//         await thinkingMessage.edit(finalReplyOptions);
//         console.log("[WhaleWatcher] Final message sent.");

//     } catch (error) { // Catch top-level errors
//         console.error(`[WhaleWatcher] Top-level error for query "${userQuery}":`, error);
//         const prefixRegex = /^\[(DS|GE|CMC|BCR|BNB|OAI|DB|System|QN)\]/; // Added QN back
//         let errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;
//         const paramErrors = [ "invalid command format", "target address missing", "invalid range", "invalid block number", "invalid block range", "unhandled time word", ];
//         if (paramErrors.some(phrase => errorMsgContent.toLowerCase().includes(phrase))) errorMsgContent += " Use `!help`.";
//         const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;
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
const blockcypherHelper = require('../services/blockcypherHelper'); // Used ONLY for balance & fee
// const binanceHelper = require('../services/binanceHelper'); // Use Binance for price
// const coinMarketCapHelper = require('../services/coinMarketCap');
const quicknodeHelper = require('../services/quicknodeHelper'); // <-- Used for TX analysis
const transactionAnalyzer = require('../utils/transactionAnalyzer');
const { parseWhaleQuery } = require('../utils/filterParser');
const { stringify } = require('csv-stringify/sync');

// --- Configuration ---
const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "10");
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';
const MOST_ACTIVE_DISPLAY_LIMIT = 15;
const MOST_ACTIVE_FETCH_LIMIT = 50;
const RELATION_DISPLAY_LIMIT = 15;
const AVG_BTC_TX_SIZE_BYTES = 250;
const BTC_PRICE_SYMBOL = 'BTCUSDT';
const MAX_TX_TO_ANALYZE = parseInt(process.env.MAX_TX_TO_ANALYZE_PER_COMMAND || "25"); // How many top-value TXs to analyze
const EXTERNAL_THRESHOLD = parseFloat(process.env.WHALE_EXTERNAL_TRANSFER_THRESHOLD_BTC || "1");
const CANDIDATE_BUFFER_FACTOR = 1.5;


// --- Helper: Generate Data File ---
// (Unchanged from previous version - includes block column and safety checks)
function generateDataFile(data, type = 'transactions', format = 'csv', labelsMap = new Map()) {
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${data?.length ?? 0} ${type}...`);
    let dataForFile; let columns; let defaultColumns;
    if (!Array.isArray(data)) { console.error(`[generateDataFile] Error: Input not array for type ${type}.`); return null; }
    try {
        if (type === 'external_movements') {
            defaultColumns = ['TxHash', 'Block', 'External_Value_BTC', 'Fee_BTC', 'External_Outputs_Count', 'External_Outputs_Details', 'Change_Outputs_Count', 'Change_Outputs_Details', 'Explorer_Link'];
            dataForFile = data.map(m => {
                const formatOutputs = (outputs) => { if (!Array.isArray(outputs)) return ''; return outputs.map(o => `${o?.address || 'N/A'}${labelsMap.get(o?.address) ? ` (${labelsMap.get(o.address)})` : ''}: ${(typeof o?.valueBTC === 'number' ? o.valueBTC.toFixed(4) : 'N/A')} BTC`).join(' | '); }
                return { TxHash: m?.txid || 'N/A', Block: m?.block ?? 'N/A', External_Value_BTC: typeof m?.externalValueBTC === 'number' ? m.externalValueBTC.toFixed(8) : '0.0', Fee_BTC: typeof m?.feeBTC === 'number' ? m.feeBTC.toFixed(8) : '0.0', External_Outputs_Count: m?.externalOutputs?.length ?? 0, External_Outputs_Details: formatOutputs(m?.externalOutputs), Change_Outputs_Count: m?.changeOutputs?.length ?? 0, Change_Outputs_Details: formatOutputs(m?.changeOutputs), Explorer_Link: `${BLOCK_EXPLORER_URL}${m?.txid || ''}`, };
            });
            dataForFile.sort((a, b) => parseFloat(b.External_Value_BTC) - parseFloat(a.External_Value_BTC)); // Sort CSV by external value
        } else if (type === 'most_active') {
             defaultColumns = ['Rank', 'Address', 'Label', 'Tx_Count', 'Total_IN_BTC', 'Total_OUT_BTC'];
             dataForFile = data.map((item, index) => ({ Rank: index + 1, Address: item?.address || 'N/A', Label: item?.label || '', Tx_Count: item?.count ?? 0, Total_IN_BTC: typeof item?.totalInBTC === 'number' ? item.totalInBTC.toFixed(8) : '0.0', Total_OUT_BTC: typeof item?.totalOutBTC === 'number' ? item.totalOutBTC.toFixed(8) : '0.0' }));
        } else if (type === 'relations') {
             defaultColumns = ['TxHash', 'Timestamp', 'Block', 'Counterparty', 'Counterparty_Label', 'Direction', 'Value_BTC', 'Tx_Type'];
             dataForFile = data.map(item => ({ TxHash: item?.txHash || 'N/A', Timestamp: item?.timestamp || '', Block: item?.block ?? 'N/A', Counterparty: item?.counterparty || 'N/A', Counterparty_Label: labelsMap.get(item?.counterparty) || '', Direction: item?.direction || 'N/A', Value_BTC: (typeof item?.valueBTC === 'number') ? item.valueBTC.toFixed(8) : '0.0', Tx_Type: item?.txType || 'N/A' }));
             dataForFile.sort((a, b) => (a.Timestamp && b.Timestamp) ? new Date(b.Timestamp) - new Date(a.Timestamp) : 0);
        } else { console.warn(`[generateDataFile] Unknown data type: ${type}.`); return null; }

        if (format === 'csv' && stringify) { columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : defaultColumns; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
        else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
        else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file for ${type}:`, fileError); return null; }
}


// --- Helper: Construct AI Prompt for Filtered Movements ---
// Updated prompt to reflect analysis of top raw-value transactions
function constructFilteredWhalePrompt(analyzedMovements, query, filterDescription, blockInfo, candidateCount, analyzedCount) {
     if (!Array.isArray(analyzedMovements)) { console.error('[constructFilteredWhalePrompt] Invalid analyzedMovements.'); return null; }

     let blockContext = ""; let blockRangeMsgPart = "matching the criteria";
     if (blockInfo?.resultsMinBlock && blockInfo?.resultsMaxBlock) {
          if (blockInfo.resultsMinBlock === blockInfo.resultsMaxBlock) { blockContext = `(Block: ${blockInfo.resultsMinBlock})`; blockRangeMsgPart = `in Block ${blockInfo.resultsMinBlock}`; }
          else { blockContext = `(Resulting Blocks: ${blockInfo.resultsMinBlock} - ${blockInfo.resultsMaxBlock})`; blockRangeMsgPart = `between Blocks ${blockInfo.resultsMinBlock} and ${blockInfo.resultsMaxBlock}`; }
     } else if (blockInfo?.latestBlock) { blockContext = `(Latest Block: ${blockInfo.latestBlock})`; blockRangeMsgPart = `in the latest block (${blockInfo.latestBlock})`; }

     let queriedRangeContext = `Filter Applied: "${filterDescription}"`;
     if (blockInfo?.queriedMinBlock && blockInfo?.queriedMaxBlock) {
          if (blockInfo.queriedMinBlock !== blockInfo.resultsMinBlock || blockInfo.queriedMaxBlock !== blockInfo.resultsMaxBlock) {
               queriedRangeContext += ` (Queried Blocks: ${blockInfo.queriedMinBlock} - ${blockInfo.queriedMaxBlock})`;
          }
     }

     // Clarify that analysis started with highest *raw* value txs
     let analysisScopeNote = `(Analyzed ${analyzedCount} highest raw-value transactions matching the query)`;

     let prompt = `You are an AI analyzing verified external Bitcoin whale movements (external value > ${EXTERNAL_THRESHOLD} BTC).\nUser Query: "!whale ${query}" (${queriedRangeContext})\n${analysisScopeNote}\n\n== Verified External Whale Movements ${blockContext} ==\n`;
     if (analyzedMovements.length === 0) {
         prompt += `No significant external whale movements detected ${blockRangeMsgPart} among the top analyzed transactions.\n`;
     } else {
         prompt += `Based on analysis of the highest raw-value transactions, the following ${analyzedMovements.length} external movement(s) were identified ${blockRangeMsgPart} (sorted by External Value BTC Descending):\n`;
         prompt += "```json\n";
         const dataForAI = analyzedMovements.slice(0, TOP_N_FOR_AI).map(m => { /* ... formatting unchanged ... */
             const getLabel = (addr) => m?.labels?.get(addr) || null;
             return { txid: m?.txid || 'N/A', block: m?.block ?? 'N/A', externalValueBTC: parseFloat((m?.externalValueBTC || 0).toFixed(4)), externalOutputs: m?.externalOutputs?.map(o => ({ address: o?.address || 'N/A', value: parseFloat((o?.valueBTC || 0).toFixed(4)), label: getLabel(o?.address) })) || [], feeBTC: parseFloat((m?.feeBTC || 0).toFixed(8)) };
         });
         try { prompt += JSON.stringify(dataForAI, null, 2); }
         catch (e) { prompt += "[Error formatting data]"; console.error("Error stringifying filtered data:", e); return null; }
         prompt += "\n```\n";
         if (analyzedMovements.length > TOP_N_FOR_AI) { prompt += `\n*(Showing top ${TOP_N_FOR_AI} movements by external value. See CSV for all ${analyzedMovements.length}.)*\n`; }
     }
     prompt += `\nAnalysis Task:\n1. Summarize the key external whale movements identified ${blockRangeMsgPart} based on the JSON data (txid, block, externalValueBTC, notable recipients/labels).\n2. Mention the overall query context ("${filterDescription}").\n3. Highlight the largest external transfer(s) by 'externalValueBTC'.\n4. Focus ONLY on the provided verified external movements from the analyzed top-value transactions.\n5. **Be concise (<450 tokens).** Use Markdown (\`**bold**\`, \`*list*\`, \`txid\`).\n6. Conclude with "(Disclaimer: NOT financial advice.)"`;
     console.log("[constructFilteredWhalePrompt] Successfully constructed prompt.");
     return prompt;
}


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
    let analyzedMovements = [];
    let blockInfo = { queriedMinBlock: null, queriedMaxBlock: null, resultsMinBlock: null, resultsMaxBlock: null, latestBlock: null };
    let initialCandidateCount = 0;
    let analyzedCandidateCount = 0;

    try {
        thinkingMessage = await message.reply("⏳ Preparing whale report...");
        const parseResult = parseWhaleQuery(userQuery);
        if (parseResult.parseError) { console.error(`[WhaleWatcher] FilterParser Error for query "${userQuery}": ${parseResult.parseError}`); throw new Error(`Invalid command format: ${parseResult.parseError}.`); }

        let mongoFilter = parseResult.mongoFilter;
        let filterDescription = parseResult.filterDescription;
        const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
        const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
        const requiresRelationCheck = parseResult.requiresRelationCheck;
        const requiresBalanceCheck = parseResult.requiresBalanceCheck;
        const requiresFeeCheck = parseResult.requiresFeeCheck;
        const targetAddress = parseResult.targetAddress;

        console.log(`[WhaleWatcher] Parsed Filter Desc: "${filterDescription}", DB Filter: ${JSON.stringify(mongoFilter)}, LatestLookup: ${requiresLatestBlockLookup}`);

        if (requiresLatestBlockLookup) {
            await thinkingMessage.edit(`⏳ Finding latest block...`);
            const latestBlock = await mongoHelper.getLatestBlockNumber();
            if (latestBlock === null) throw new Error("[DB] Could not determine latest block.");
            blockInfo.latestBlock = blockInfo.queriedMinBlock = blockInfo.queriedMaxBlock = latestBlock;
            const blockFilter = { block: latestBlock };
            if (mongoFilter && Object.keys(mongoFilter).length > 0 && JSON.stringify(mongoFilter) !== '{}') { mongoFilter = { $and: [mongoFilter, blockFilter] }; }
            else mongoFilter = blockFilter;
            filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
            console.log(`[WhaleWatcher] Using filter for block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
        }

        // --- Branch for non-standard commands ---
        if (requiresFeeCheck || requiresBalanceCheck || requiresRelationCheck || requiresMostActiveCheck) {
            skipAI = true;
            // ... (Fee, Balance, Relation, Most Active logic remains unchanged) ...
            // if (requiresFeeCheck) { /* ... fee logic ... */ await thinkingMessage.edit(`⏳ Checking network fees...`); let btcPriceUSD = null; try { const priceData = await binanceHelper.getPrice(BTC_PRICE_SYMBOL); if (!priceData?.price) throw new Error(`[BNB] Could not retrieve BTC price`); btcPriceUSD = parseFloat(priceData.price); if (isNaN(btcPriceUSD)) throw new Error(`[BNB] Invalid price: ${priceData.price}`); const feeInfo = await blockcypherHelper.getBlockchainFeeInfo(); const { high_fee_per_kb, medium_fee_per_kb, low_fee_per_kb } = feeInfo; if (high_fee_per_kb === undefined || medium_fee_per_kb === undefined || low_fee_per_kb === undefined) throw new Error("[BCR] Fee info missing."); const calcFee = (satKB) => { const satVB = satKB / 1000; const totalSat = satVB * AVG_BTC_TX_SIZE_BYTES; const btc = totalSat / 1e8; const usd = btc * btcPriceUSD; return { satVb: satVB.toFixed(1), btc: btc.toFixed(8), usd: usd.toFixed(2) }; }; const h = calcFee(high_fee_per_kb), m = calcFee(medium_fee_per_kb), l = calcFee(low_fee_per_kb); fullResponseText = `**Bitcoin Network Fee Estimates:**\n • High: ${h.satVb} sat/vB (~${h.btc} BTC / $${h.usd})\n • Medium: ${m.satVb} sat/vB (~${m.btc} BTC / $${m.usd})\n • Low: ${l.satVb} sat/vB (~${l.btc} BTC / $${l.usd})\n\n*(BTC≈$${btcPriceUSD.toLocaleString()}, ~${AVG_BTC_TX_SIZE_BYTES} vB tx | Fees: Blockcypher)*`; } catch (e) { console.error("[WhaleWatcher] Fee Check Err:", e); fullResponseText = `Sorry, failed to get fee info: ${e.message}`; } fileBuffer = null; }
            if (requiresFeeCheck) {
                await thinkingMessage.edit(`⏳ Checking network fees via Blockcypher...`); // Updated message
                try {
                    const feeInfo = await blockcypherHelper.getBlockchainFeeInfo(); // [cite: 126]
                    const { high_fee_per_kb, medium_fee_per_kb, low_fee_per_kb } = feeInfo; // [cite: 127]

                    if (high_fee_per_kb === undefined || medium_fee_per_kb === undefined || low_fee_per_kb === undefined) {
                        throw new Error("[BCR] Fee info missing from Blockcypher response."); // [cite: 127]
                    }

                    // Function to calculate sat/vB and estimated BTC cost
                    const calculateBtcFee = (satKB) => {
                        if (typeof satKB !== 'number' || isNaN(satKB)) {
                             return { satVb: 'N/A', btc: 'N/A' }; // Handle invalid input
                        }
                        const satVB = satKB / 1000; // Calculate satoshis per vByte
                        const totalSat = satVB * AVG_BTC_TX_SIZE_BYTES; // Estimate total satoshis for avg tx size [cite: 68, 128]
                        const btc = totalSat / 1e8; // Convert total satoshis to BTC [cite: 129]
                        return {
                            satVb: satVB.toFixed(1), // Format sat/vB
                            btc: btc.toFixed(8)     // Format BTC value
                        };
                    };

                    const h = calculateBtcFee(high_fee_per_kb);
                    const m = calculateBtcFee(medium_fee_per_kb);
                    const l = calculateBtcFee(low_fee_per_kb);

                    // Updated response text (BTC only)
                    fullResponseText = `**Bitcoin Network Fee Estimates:**\n` +
                                       ` • High:   **${h.satVb} sat/vB** (~${h.btc} BTC)\n` +
                                       ` • Medium: **${m.satVb} sat/vB** (~${m.btc} BTC)\n` +
                                       ` • Low:    **${l.satVb} sat/vB** (~${l.btc} BTC)\n\n` +
                                       `*(Estimates based on ~${AVG_BTC_TX_SIZE_BYTES} vB average transaction size | Data: Blockcypher)*`; // [cite: 68, 130]

                } catch (e) {
                    console.error("[WhaleWatcher] Fee Check Err:", e);
                    // Keep error reporting simple as no external price API is involved now
                    const errorMessage = e.message.includes('[BCR]') ? e.message : `[System] ${e.message}`;
                    fullResponseText = `Sorry, failed to get fee info: ${errorMessage}`; // [cite: 131]
                }
                fileBuffer = null; // [cite: 132]
            }
            else if (requiresBalanceCheck) { /* ... balance logic ... */ if (!targetAddress) throw new Error("Target address missing"); await thinkingMessage.edit(`⏳ Checking balance via Blockcypher...`); try { const balInfo = await blockcypherHelper.getAddressBalance(targetAddress); const f = (balInfo.final_balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); const c = (balInfo.balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); const u = (balInfo.unconfirmed_balance / 1e8).toLocaleString(undefined,{minimumFractionDigits:8,maximumFractionDigits:8}); fullResponseText = `**Balance for \`${balInfo.address}\`:**\n • Confirmed: **${c} BTC**\n • Unconfirmed: ${u} BTC\n • Total: **${f} BTC**\n • Txns: ${balInfo.final_n_tx}\n*(Data: Blockcypher)*`; } catch (e) { console.error("[WhaleWatcher] Balance Check Err:", e); fullResponseText = `Sorry, failed to get balance: ${e.message}`; } fileBuffer = null; }
            else if (requiresRelationCheck) { /* ... relation logic ... */ if (!targetAddress) throw new Error("Target address missing"); await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}...`); if (typeof mongoHelper.findAddressRelations !== 'function') throw new Error("[System] Relation query fn missing."); const allInteractions = await mongoHelper.findAddressRelations(targetAddress, mongoFilter); if (!allInteractions?.length) { fullResponseText = `No interactions found for \`${targetAddress}\` (${filterDescription}).`; fileBuffer = null; } else { const counterparties = [...new Set(allInteractions.map(i => i.counterparty))]; const labels = await mongoHelper.getLabelsForAddresses(counterparties); fileName = `relations_${targetAddress.substring(0,10)}_${filterDescription.replace(/[^a-z0-9]/gi,'_')}.csv`; fileBuffer = generateDataFile(allInteractions, 'relations', 'csv', labels); const summary = {}; allInteractions.forEach(i => { const cp = i.counterparty; if (!summary[cp]) summary[cp] = {in:0,out:0,count:0,types:new Set()}; summary[cp].count++; summary[cp].types.add(i.txType); if(i.direction==='IN') summary[cp].in+=i.valueBTC; else summary[cp].out+=i.valueBTC; }); const sorted = Object.keys(summary).sort((a,b)=>(summary[b].in+summary[b].out)-(summary[a].in+summary[a].out)); const limited = sorted.slice(0,RELATION_DISPLAY_LIMIT); const displayLbls = new Map(limited.map(a=>[a,labels.get(a)]).filter(e=>e[1])); fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n*(Top ${limited.length} of ${sorted.length} by volume)*\n\n`; limited.forEach((cp,i)=>{ const d=summary[cp]; const l=displayLbls.get(cp); const iBTC=d.in.toLocaleString(undefined,{maximumFractionDigits:8}); const oBTC=d.out.toLocaleString(undefined,{maximumFractionDigits:8}); const typs=Array.from(d.types).join(', ').replace(/_/g,' '); const line=`${i+1}. \`${cp}\`${l?` (*${l}*)`:''}: IN **${iBTC}** | OUT **${oBTC}** | (${d.count} txs) | *${typs}*\n`; if (fullResponseText.length+line.length<1900) fullResponseText+=line; else if (!fullResponseText.endsWith("...")) fullResponseText+="..."; }); if (sorted.length>limited.length) fullResponseText+=`\n...and ${sorted.length - limited.length} more.`; if (fileBuffer) fullResponseText+=`\n\n*See attached CSV for all ${allInteractions.length} interactions.*`; fullResponseText+=`\n*Types key: single=1:1, consolidation=many:1, distribution=1:many.*`; } }
            else if (requiresMostActiveCheck) { /* ... most active logic ... */ await thinkingMessage.edit(`⏳ Finding most active addresses...`); const allActive = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_FETCH_LIMIT); if (!allActive?.length) { fullResponseText = `No significant activity found for: \`${filterDescription}\``; fileBuffer = null; } else { fileName = `most_active_${filterDescription.replace(/[^a-z0-9]/gi,'_')}.csv`; fileBuffer = generateDataFile(allActive, 'most_active', 'csv'); const limited = allActive.slice(0, MOST_ACTIVE_DISPLAY_LIMIT); fullResponseText = `**Most Active Addresses (${filterDescription}):**\n*(Top ${limited.length} of ${allActive.length} by Tx Count)*\n\n`; limited.forEach((item, idx) => { const inBTC = item.totalInBTC.toLocaleString(undefined,{maximumFractionDigits:4}); const outBTC = item.totalOutBTC.toLocaleString(undefined,{maximumFractionDigits:4}); const line = `${idx + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`; if (fullResponseText.length + line.length < 1900) fullResponseText += line; else if (!fullResponseText.endsWith("...")) fullResponseText += "..."; }); if (allActive.length > limited.length) fullResponseText += `\n...and ${allActive.length - limited.length} more.`; if (fileBuffer) fullResponseText += `\n\n*See attached CSV for full details.*`; } }
        } else {
            // --- ** Standard Query Path (Using QuickNode + transactionAnalyzer) ** ---
            await thinkingMessage.edit(`⏳ Querying highest value transactions for: ${filterDescription}...`);
            const candidateLimit = Math.max(30, Math.ceil(MAX_TX_TO_ANALYZE * CANDIDATE_BUFFER_FACTOR));

            // *** Fetch candidates SORTED BY VALUE descending ***
            console.log(`[WhaleWatcher] Fetching up to ${candidateLimit} candidates sorted by value DESC...`);
            const candidates = await mongoHelper.queryCollection(
                mongoHelper.WHALE_TRANSFERS_COLLECTION,
                mongoFilter,
                candidateLimit,
                { value: -1 } // <-- SORT BY RAW VALUE STORED IN DB
            );

            if (!candidates || candidates.length === 0) {
                await thinkingMessage.edit(`No potential whale transactions found in DB for: \`${filterDescription}\``); return;
            }
            initialCandidateCount = candidates.length;
            console.log(`[WhaleWatcher] Found ${initialCandidateCount} candidates from DB for filter: ${JSON.stringify(mongoFilter)} (Sorted by value)`);

            // Calculate Queried Block Range (from these top-value candidates)
            const candidateBlocks = candidates.map(c => c.block).filter(b => typeof b === 'number');
            if (candidateBlocks.length > 0) {
                 blockInfo.queriedMinBlock = Math.min(...candidateBlocks);
                 blockInfo.queriedMaxBlock = Math.max(...candidateBlocks);
                 console.log(`[WhaleWatcher] Top value candidates span blocks: ${blockInfo.queriedMinBlock} - ${blockInfo.queriedMaxBlock}`);
            }

            // Select top N from value-sorted list to analyze
            const candidateMap = new Map();
            const txsToAnalyze = candidates.slice(0, MAX_TX_TO_ANALYZE)
               .map(c => { if (c?.txHash && c.block !== undefined && c.block !== null) { candidateMap.set(c.txHash, { block: c.block }); return c.txHash; } return null; })
               .filter(Boolean);

            analyzedCandidateCount = txsToAnalyze.length;
            if (analyzedCandidateCount === 0) {
                await thinkingMessage.edit(`No valid transaction hashes found for analysis (found ${initialCandidateCount} candidates).`); return;
            }

            await thinkingMessage.edit(`⏳ Analyzing details for ${analyzedCandidateCount} highest value transaction(s) via QuickNode...`);
            const analysisPromises = txsToAnalyze.map(async (txHash) => { /* ... unchanged analysis loop ... */
                if (!txHash) return null;
                try {
                    const txDetails = await quicknodeHelper.getTransactionDetails(txHash);
                    if (!txDetails) { console.warn(`[WhaleWatcher] No details for ${txHash} from QuickNode.`); return null; }
                    const analysisResult = transactionAnalyzer.analyzeTransaction(txDetails);
                    analysisResult.block = candidateMap.get(txHash)?.block ?? 'N/A';
                    return analysisResult;
                } catch (error) { const errMsg = error.message?.startsWith('[QN]') ? error.message : `[QN] ${error.message}`; console.error(`[WhaleWatcher] Error analyzing ${txHash}: ${errMsg}`); return null; }
            });
            const analysisResults = (await Promise.all(analysisPromises)).filter(Boolean);

            analyzedMovements = analysisResults.filter(r => r.isWhaleMovement);
            console.log(`[WhaleWatcher] Analysis complete. Found ${analyzedMovements.length} external whale movement(s) > ${EXTERNAL_THRESHOLD} BTC from ${analyzedCandidateCount} analyzed top-value txs.`);

            // Calculate Resulting Block Range (from actual movements)
            if (analyzedMovements.length > 0) {
                 const resultBlocks = analyzedMovements.map(m => m.block).filter(b => typeof b === 'number');
                 if (resultBlocks.length > 0) { blockInfo.resultsMinBlock = Math.min(...resultBlocks); blockInfo.resultsMaxBlock = Math.max(...resultBlocks); console.log(`[WhaleWatcher] Identified movements occurred in blocks: ${blockInfo.resultsMinBlock} - ${blockInfo.resultsMaxBlock}`); }
            } else if (blockInfo.queriedMinBlock) { // If no results, use queried range
                 blockInfo.resultsMinBlock = blockInfo.queriedMinBlock; blockInfo.resultsMaxBlock = blockInfo.queriedMaxBlock; console.log(`[WhaleWatcher] No movements found, using candidate block range for context: ${blockInfo.resultsMinBlock} - ${blockInfo.resultsMaxBlock}`);
            }

            if (analyzedMovements.length === 0) {
                fullResponseText = `Analyzed ${analyzedCandidateCount} highest value transaction(s) for filter "${filterDescription}". No significant external whale movements (> ${EXTERNAL_THRESHOLD} BTC) found`;
                 // Append block info context if available
                 if (blockInfo.resultsMinBlock && blockInfo.resultsMaxBlock && blockInfo.resultsMinBlock !== blockInfo.resultsMaxBlock) { fullResponseText += ` within blocks ${blockInfo.resultsMinBlock} - ${blockInfo.resultsMaxBlock}.`; }
                 else if (blockInfo.resultsMinBlock) { fullResponseText += ` in block ${blockInfo.resultsMinBlock}.`; }
                 else { fullResponseText += `.`; }
                skipAI = true; fileBuffer = null;
            } else {
                // *** SORT analyzedMovements by externalValueBTC DESCENDING ***
                analyzedMovements.sort((a, b) => b.externalValueBTC - a.externalValueBTC);
                console.log(`[WhaleWatcher] Sorted ${analyzedMovements.length} movements by external value for AI/CSV.`);

                // Fetch Labels
                await thinkingMessage.edit(`⏳ Fetching labels for ${analyzedMovements.length} movement(s)...`);
                const relevantAddresses = new Set(); /* ... unchanged label fetching ... */ analyzedMovements.forEach(m => { m.inputs?.forEach(i => i?.address && relevantAddresses.add(i.address)); m.externalOutputs?.forEach(o => o?.address && relevantAddresses.add(o.address)); m.changeOutputs?.forEach(c => c?.address && relevantAddresses.add(c.address)); }); const labelsMap = await mongoHelper.getLabelsForAddresses(Array.from(relevantAddresses)); console.log(`[WhaleWatcher] Fetched ${labelsMap.size} labels.`); analyzedMovements.forEach(m => m.labels = labelsMap);

                // Generate CSV
                fileName = `whale_movements_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'report'}.csv`;
                fileBuffer = generateDataFile(analyzedMovements, 'external_movements', 'csv', labelsMap);
                if (!fileBuffer) console.error(`[WhaleWatcher] Failed to generate CSV buffer.`);

                // Construct AI Prompt
                finalPrompt = constructFilteredWhalePrompt(analyzedMovements, userQuery, filterDescription, blockInfo, initialCandidateCount, analyzedCandidateCount);

                // Validate & Estimate Tokens
                let encoding; try { if (!finalPrompt) { console.error("[WhaleWatcher] Invalid finalPrompt. Skipping AI."); fullResponseText = `Identified ${analyzedMovements.length} external movements, but failed AI prompt generation.`; skipAI = true; } else { encoding = get_encoding(TOKENIZER_ENCODING); let tokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Est. prompt tokens: ${tokens}`); if (tokens > MAX_PROMPT_TOKENS) console.warn(`Tokens (${tokens}) > limit (${MAX_PROMPT_TOKENS}).`); encoding.free(); } } catch (e) { if(encoding) encoding.free(); console.error("[WhaleWatcher] Token error:", e); throw new Error(`[System] Token estimation error: ${e.message}`); }

                // Call AI (Streaming) if !skipAI
                if (!skipAI) {
                    await thinkingMessage.edit(`⏳ Generating AI summary for ${analyzedMovements.length} movement(s)...`);
                    // (AI Stream handling logic - unchanged)
                     let stream = null; try { stream = aiHelper.getAIStream(finalPrompt); } catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); } fullResponseText = ""; let chunkAcc = ""; let lastEdit = 0; const minEdit = 1500, maxAcc = 100; let streamErr = false; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) chunkAcc += content; const now = Date.now(); if (thinkingMessage && chunkAcc.length > 0 && (chunkAcc.length >= maxAcc || now - lastEdit > minEdit)) { fullResponseText += chunkAcc; chunkAcc = ""; const currentEdit = fullResponseText + "..."; if (currentEdit.length <= 2000) { try { await thinkingMessage.edit(currentEdit); lastEdit = now; } catch (e) { /* Ignore */ } } else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } } catch (e) { console.error("AI stream error:", e); streamErr = true; fullResponseText = `AI analysis stream error: ${e.message}`; } if (!streamErr) { fullResponseText += chunkAcc; } if (fullResponseText.length === 0 && !streamErr) { fullResponseText = "AI analysis returned empty response."; }
                }
            }
        } // End standard query path

        // --- Final Discord Message Update ---
        // (Final message logic - Unchanged from previous version)
        console.log("[WhaleWatcher] Preparing final message edit..."); let finalReplyOptions = { content: null, embeds: [], files: [], components: [] }; if (!fullResponseText) { fullResponseText = skipAI ? `No specific data found for: \`${filterDescription}\`.` : "Sorry, couldn't generate response."; } if (fullResponseText.endsWith("...") && !fullResponseText.includes("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); } if (!skipAI && !fullResponseText.toLowerCase().startsWith("error") && !fullResponseText.toLowerCase().includes("failed")) { if (!fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: AI analysis, NOT financial advice.)*"; } } if (fullResponseText && fullResponseText.length > 2000) { fullResponseText = fullResponseText.substring(0, 1980) + "..."; } finalReplyOptions.content = fullResponseText; if (fileBuffer) { const attachment = new AttachmentBuilder(fileBuffer, { name: fileName }); finalReplyOptions.files.push(attachment); const fileNote = `\n\n*See attached \`${fileName}\` for full details.*`; if (finalReplyOptions.content && finalReplyOptions.content.length + fileNote.length <= 2000) { finalReplyOptions.content += fileNote; } else console.warn("Content too long for file note."); } else if (!requiresFeeCheck && !requiresBalanceCheck && !requiresRelationCheck && !requiresMostActiveCheck) { const noteType = analyzedMovements?.length > 0 ? `\n\n*(Note: Failed to generate detailed CSV report)*` : `\n\n*(No significant external movements found to generate CSV)*`; if (finalReplyOptions.content && finalReplyOptions.content.length + noteType.length <= 2000) { finalReplyOptions.content += noteType; } } console.log('[WhaleWatcher] Final Reply:', {content: finalReplyOptions.content?.substring(0,100)+'...', files: finalReplyOptions.files.length}); await thinkingMessage.edit(finalReplyOptions); console.log("[WhaleWatcher] Final message sent.");

    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
        const prefixRegex = /^\[(DS|GE|CMC|BCR|BNB|OAI|DB|System|QN)\]/;
        let errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;
        const paramErrors = [ "invalid command format", "target address missing", "invalid range", "invalid block number", "invalid block range", "unhandled time word", ];
        if (paramErrors.some(phrase => errorMsgContent.toLowerCase().includes(phrase))) errorMsgContent += " Use `!help`.";
        const finalErrorMsg = `Sorry, encountered an error: ${errorMsgContent}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: finalErrorMsg.substring(0, 2000), embeds: [], files: [], components:[] }); } catch (e) { await message.reply(finalErrorMsg.substring(0, 2000)); } }
        else { await message.reply(finalErrorMsg.substring(0, 2000)); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };
