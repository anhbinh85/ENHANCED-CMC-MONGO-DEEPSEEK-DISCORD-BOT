// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const { AttachmentBuilder } = require('discord.js');
// const mongoHelper = require('../services/mongoHelper');
// const aiHelper = require('../services/aiHelper');
// const { parseWhaleQuery } = require('../utils/filterParser'); // Import the refined parser
// const { stringify } = require('csv-stringify/sync');

// // --- Configuration ---
// const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
// const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';
// const MOST_ACTIVE_LIMIT = 10; // How many most active addresses to show

// // --- Helper: Generate File (Unchanged) ---
// function generateTxFile(topNData, format = 'csv') { /**/
//     console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for Top ${topNData.length} transactions...`);
//     const dataForFile = topNData.map(tx => {
//         let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} }
//         const valueBTC = Number(tx?.value || 0) / 1e8;
//         return { Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block, Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A', From_Addresses: tx?.from?.join(', ') || '', From_Labels: tx?.fromLabels?.join(' | ') || '', To_Addresses: tx?.to?.join(', ') || '', To_Labels: tx?.toLabels?.join(' | ') || '', Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`, };
//     });
//     try {
//         if (format === 'csv' && stringify) { const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : []; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
//         else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
//         else { throw new Error("Invalid format or csv-stringify missing."); }
//     } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file:`, fileError); return null; }
// }

// // --- Helper: Construct AI Prompt (Unchanged - Used for transaction summaries) ---
// const constructWhalePrompt = (summary, topNData, query) => { /**/
//     let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\nUser Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`;
//     const processedData = topNData.map(doc => { const newDoc = { txHash: doc?.txHash, timestamp: null, block: doc?.block?.$numberInt || doc?.block?.$numberLong || doc?.block, valueBTC: parseFloat((Number(doc?.value?.$numberLong || doc?.value?.$numberInt || doc?.value || 0) / 1e8).toFixed(4)), from: doc?.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc?.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] }; if (doc?._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} } return newDoc; });
//     try { prompt += JSON.stringify(processedData, null, 2); }
//     catch (stringifyError) { console.error("[constructWhalePrompt] Error stringifying processedData:", stringifyError); prompt += `[Error processing transaction details: ${stringifyError.message}]`; }
//     prompt += `\n\`\`\`\n\nAnalysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions:\n1. Comment on overall activity (volume, tx count, block range).\n2. Highlight significant transactions from the Top ${topNData.length} list, mentioning labels/exchanges. Note the largest ones by value.\n3. If user query implies interest in price, comment cautiously on potential implications of overall volume/flows.\n4. **Be concise: Keep response under ~450 tokens.**\n5. Mention txHashes (e.g., \`abc...xyz\`). **DO NOT format as markdown links.**`;
//     return prompt;
// };


// // --- Main Handler Function ---
// async function handleWhaleCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Use \`!whale <query>\` e.g., \`!whale last hour\``); return; }

//     console.log(`[WhaleWatcher] Query: "${userQuery}"`);
//     let thinkingMessage = null;
//     let fullResponseText = "";
//     let fileBuffer = null;
//     let fileName = 'whale_transactions.csv';
//     let finalPrompt = "";
//     let skipAI = false; // Flag to skip AI analysis for certain commands

//     try {
//         thinkingMessage = await message.reply("⏳ Preparing whale report...");

//         // Step 1: Parse the user query
//         const parseResult = parseWhaleQuery(userQuery);

//         if (parseResult.parseError) {
//             throw new Error(`Invalid command format: ${parseResult.parseError}. Use \`!help\` for examples.`);
//         }

//         let mongoFilter = parseResult.mongoFilter;
//         let filterDescription = parseResult.filterDescription;
//         const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
//         const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
//         const requiresRelationCheck = parseResult.requiresRelationCheck;
//         const targetAddress = parseResult.targetAddress;

//         // Step 1b: Handle 'latest block' lookups (before other queries)
//         if (requiresLatestBlockLookup) {
//             await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
//             const latestBlock = await mongoHelper.getLatestBlockNumber();
//             if (latestBlock === null) {
//                 throw new Error("Could not determine the latest block number from the database.");
//             }
//             const blockFilter = { block: latestBlock };
//             // Combine with existing filter carefully (especially if $or exists)
//              if (mongoFilter && Object.keys(mongoFilter).length > 0) {
//                  // If existing filter is complex (e.g., $or for address), combine using $and
//                  if (mongoFilter['$or']) {
//                      mongoFilter = { $and: [mongoFilter, blockFilter] };
//                  } else {
//                      // If simple filter, merge (this shouldn't happen if parser logic is correct)
//                      Object.assign(mongoFilter, blockFilter);
//                  }
//              } else {
//                  mongoFilter = blockFilter; // Only the block filter applies
//              }
//             filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
//             console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
//         }

//         // --- Step 2: Branch based on query type ---

//         if (requiresRelationCheck) {
//             // --- Handle "Relation Cluster" Query ---
//             if (!targetAddress) { throw new Error("Target address missing for relation check."); }

//             await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}... (${filterDescription})...`);
//             // Ensure findAddressRelations is exported from mongoHelper
//             if (typeof mongoHelper.findAddressRelations !== 'function') {
//                  throw new Error("Relation query function not available.");
//             }
//             const relations = await mongoHelper.findAddressRelations(targetAddress, mongoFilter);

//             const counterparties = Object.keys(relations);
//             if (counterparties.length === 0) {
//                 fullResponseText = `No direct interactions found for \`${targetAddress}\` within the specified period (${filterDescription}).`;
//             } else {
//                 const cpAddresses = counterparties;
//                 const labelsMap = await mongoHelper.getLabelsForAddresses(cpAddresses); // Fetch labels
//                 console.log(`[WhaleWatcher] Fetched ${labelsMap.size} labels for relation counterparties.`);

//                 fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n\n`;
//                 counterparties.sort((a, b) => (relations[b].totalInBTC + relations[b].totalOutBTC) - (relations[a].totalInBTC + relations[a].totalOutBTC)); // Sort by total volume

//                 counterparties.forEach((cpAddr, index) => {
//                     const data = relations[cpAddr];
//                     const label = labelsMap.get(cpAddr);
//                     const inBTC = data.totalInBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
//                     const outBTC = data.totalOutBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
//                     const types = data.types.join(', ').replace(/_/g, ' ');

//                     // Discord limits embed field values, keep lines concise
//                     const line = `${index + 1}. \`${cpAddr}\`${label ? ` (*${label}*)` : ''}: IN **${inBTC}** | OUT **${outBTC}** | (${data.txCount} txs) | Types: *${types}*\n`;

//                     // Check length before appending
//                     if (fullResponseText.length + line.length < 1900) {
//                         fullResponseText += line;
//                     } else {
//                          console.warn("[WhaleWatcher] Relation summary truncated due to length limit.");
//                          // Add truncation note if this is the first time hitting the limit
//                          if (!fullResponseText.endsWith("...")) fullResponseText += "...(more counterparties exist)";
//                          return; // Stop adding more lines
//                     }
//                 });
//                  fullResponseText += `\n*Tx Types key: single=1 sender/1 receiver, consolidation=many senders/1 receiver(target), distribution=1 sender(target)/many receivers.*`;
//             }
//             skipAI = true; // Skip AI analysis and file generation
//             fileBuffer = null;

//         } else if (requiresMostActiveCheck) {
//             // --- Handle "Most Active" Query ---
//             await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`);
//             const activeAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_LIMIT);

//             if (!activeAddresses || activeAddresses.length === 0) {
//                 fullResponseText = `No significant address activity found for: \`${filterDescription}\``;
//             } else {
//                 fullResponseText = `**Most Active Addresses (${filterDescription}):**\n`;
//                 activeAddresses.forEach((item, index) => {
//                     const inBTC = item.totalInBTC.toLocaleString(undefined, { maximumFractionDigits: 4 });
//                     const outBTC = item.totalOutBTC.toLocaleString(undefined, { maximumFractionDigits: 4 });
//                     const line = `${index + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`;
//                     if (fullResponseText.length + line.length < 1900) {
//                          fullResponseText += line;
//                     } else if (!fullResponseText.endsWith("...")) {
//                          fullResponseText += "...";
//                          return;
//                     }
//                 });
//             }
//             skipAI = true; // Skip AI analysis and file generation
//             fileBuffer = null;

//         } else {
//             // --- Handle Standard Transaction Summary Query ---
//             await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
//             let summaryData, topTransactions;
//             try {
//                 const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI);
//                 summaryData = results.summary;
//                 topTransactions = results.topTransactions;
//                 summaryData.filter = filterDescription; // Add final description

//                 if (!summaryData || topTransactions.length === 0) {
//                     await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``);
//                     return; // Exit
//                 }
//                 console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`);
//             } catch (dbError) { throw dbError; }

//             // Generate File
//             if (topTransactions.length > 0) {
//                 await thinkingMessage.edit("⏳ Generating data file...");
//                 fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}.csv`;
//                 fileBuffer = generateTxFile(topTransactions, 'csv'); // Use enriched data
//             }

//             // Construct AI Prompt
//             finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery);

//             // Token Check
//             // ... (Token check - unchanged) ...
//             let encoding; try { if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) { throw new Error('Constructed final prompt is invalid.'); } encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Estimated prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}).`); } encoding.free(); } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating AI tokens."); }


//             // Get AI Response (Streaming)
//             await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs...`);
//             // ... (Streaming logic - unchanged) ...
//             let stream = null; try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); } catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }
//             fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } } else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } console.log(`[WhaleWatcher] Stream finished.`); } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; } if (!streamErrored) { fullResponseText += accumulatedChunk; } if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }

//         } // End else block for standard query

//         // --- Final Discord Message Update ---
//         console.log("[WhaleWatcher] Preparing final message edit...");
//         let finalReplyOptions = {};

//         if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response or analysis.";
//         if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
//         if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";

//         finalReplyOptions.content = fullResponseText;

//         // Add file attachment only if generated (i.e., not for 'most active' or 'relation check')
//         if (fileBuffer) {
//             const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
//             finalReplyOptions.files = [attachment];
//             const attachmentNote = `\n\n*See attached \`${fileName}\` for Top ${TOP_N_FOR_AI} tx details.*`;
//             if (finalReplyOptions.content.length + attachmentNote.length <= 2000) {
//                  finalReplyOptions.content += attachmentNote;
//             } else { console.warn("[WhaleWatcher] Content too long to add file attachment note."); }
//         } else if (!requiresMostActiveCheck && !requiresRelationCheck) {
//              // Add file error note only if a file was EXPECTED for standard summary but not generated
//              const fileErrorNote = `\n\n*(Error generating transaction data file)*`;
//              if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) {
//                   finalReplyOptions.content += fileErrorNote;
//              }
//         }

//         if (!finalReplyOptions.files) { finalReplyOptions.files = []; } // Ensure files array exists

//         console.log('[WhaleWatcher] Final Reply Options:', {content: finalReplyOptions.content.substring(0,100)+'...', fileCount: finalReplyOptions.files.length});
//         await thinkingMessage.edit(finalReplyOptions);
//         console.log("[WhaleWatcher] Final message sent/edited.");

//     } catch (error) { // Catch top-level errors
//         console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
//         const errorMsg = `Sorry, encountered an error processing the whale command: ${error.message}`;
//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } }
//         else { await message.reply(errorMsg); }
//     }
// } // End handleWhaleCommand

// module.exports = { handleWhaleCommand };

// commands/whaleWatcher.js
const { ObjectId } = require('mongodb');
const { get_encoding } = require('tiktoken');
const { AttachmentBuilder } = require('discord.js');
const mongoHelper = require('../services/mongoHelper');
const aiHelper = require('../services/aiHelper');
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

// --- Helper: Generate Data File (Handles transactions, most_active, relations with labels) ---
// Added labelsMap parameter
function generateDataFile(data, type = 'transactions', format = 'csv', labelsMap = new Map()) {
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${data.length} ${type}...`);
    let dataForFile;
    let columns;
    let defaultColumns;

    try {
        if (type === 'transactions') {
             defaultColumns = ['Timestamp', 'Block', 'Value_BTC', 'TxHash', 'From_Addresses', 'From_Labels', 'To_Addresses', 'To_Labels', 'Explorer_Link'];
             dataForFile = data.map(tx => {
                let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} }
                const valueBTC = Number(tx?.value || 0) / 1e8;
                return { Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block, Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A', From_Addresses: tx?.from?.join(', ') || '', From_Labels: tx?.fromLabels?.join(' | ') || '', To_Addresses: tx?.to?.join(', ') || '', To_Labels: tx?.toLabels?.join(' | ') || '', Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`, };
             });
        } else if (type === 'most_active') {
             defaultColumns = ['Rank', 'Address', 'Label', 'Tx_Count', 'Total_IN_BTC', 'Total_OUT_BTC'];
             dataForFile = data.map((item, index) => ({ Rank: index + 1, Address: item.address, Label: item.label || '', Tx_Count: item.count, Total_IN_BTC: item.totalInBTC.toFixed(8), Total_OUT_BTC: item.totalOutBTC.toFixed(8) }));
        } else if (type === 'relations') {
            // Added Counterparty_Label
            defaultColumns = ['TxHash', 'Timestamp', 'Block', 'Counterparty', 'Counterparty_Label', 'Direction', 'Value_BTC', 'Tx_Type'];
            dataForFile = data.map(item => ({
                TxHash: item.txHash || 'N/A',
                Timestamp: item.timestamp || '',
                Block: item.block,
                Counterparty: item.counterparty,
                Counterparty_Label: labelsMap.get(item.counterparty) || '', // Use labelsMap
                Direction: item.direction,
                Value_BTC: item.valueBTC.toFixed(8),
                Tx_Type: item.txType
            }));
            dataForFile.sort((a, b) => (a.Timestamp && b.Timestamp) ? new Date(a.Timestamp) - new Date(b.Timestamp) : 0);
        } else { throw new Error(`Unknown data type: ${type}`); }

        // CSV Generation
        if (format === 'csv' && stringify) { columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : defaultColumns; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
        else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
        else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file for type ${type}:`, fileError); return null; }
}

// --- Helper: Construct AI Prompt (Added input validation) ---
const constructWhalePrompt = (summary, topNData, query) => {
    // --- Added Input Validation ---
    if (!summary || typeof summary !== 'object' || !topNData || !Array.isArray(topNData)) {
        console.error('[constructWhalePrompt] Invalid summary or topNData received.');
        return null; // Return null if basic data structure is wrong
    }
    // --- End Validation ---

    let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\nUser Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`;
    let processedData; // Define before try block
    try {
        processedData = topNData.map(doc => {
            const newDoc = { txHash: doc?.txHash, timestamp: null, block: doc?.block?.$numberInt || doc?.block?.$numberLong || doc?.block, valueBTC: parseFloat((Number(doc?.value?.$numberLong || doc?.value?.$numberInt || doc?.value || 0) / 1e8).toFixed(4)), from: doc?.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc?.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] };
            if (doc?._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} } return newDoc;
        });
        // Add the processed data JSON to the prompt
        prompt += JSON.stringify(processedData, null, 2);

    } catch (stringifyError) {
         console.error("[constructWhalePrompt] Error processing/stringifying transaction data:", stringifyError);
         prompt += `[Error processing transaction details: ${stringifyError.message}]`; // Append error info
    }

    prompt += `\n\`\`\`\n\nAnalysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions:\n1. Comment on overall activity (volume, tx count, block range).\n2. Highlight significant transactions from the Top ${topNData.length} list, mentioning labels/exchanges. Note the largest ones by value.\n3. If user query implies interest in price, comment cautiously on potential implications of overall volume/flows.\n4. **Be concise: Keep response under ~450 tokens.**\n5. Mention txHashes (e.g., \`abc...xyz\`). **DO NOT format as markdown links.**`;
    return prompt;
};

// --- Main Handler Function ---
async function handleWhaleCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Use \`!whale <query>\` e.g., \`!whale last hour\``); return; }

    console.log(`[WhaleWatcher] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = "";
    let fileBuffer = null;
    let fileName = 'whale_report.csv';
    let finalPrompt = "";
    let skipAI = false;

    try {
        thinkingMessage = await message.reply("⏳ Preparing whale report...");
        const parseResult = parseWhaleQuery(userQuery);
        if (parseResult.parseError) { throw new Error(`Invalid command format: ${parseResult.parseError}. Use \`!help\` for examples.`); }

        let mongoFilter = parseResult.mongoFilter;
        let filterDescription = parseResult.filterDescription;
        const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
        const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;
        const requiresRelationCheck = parseResult.requiresRelationCheck;
        const targetAddress = parseResult.targetAddress;

        if (requiresLatestBlockLookup) {
            await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
            const latestBlock = await mongoHelper.getLatestBlockNumber();
            if (latestBlock === null) {
                throw new Error("Could not determine the latest block number from the database.");
            }
            const blockFilter = { block: latestBlock };
            // Combine with existing filter carefully (especially if $or exists)
             if (mongoFilter && Object.keys(mongoFilter).length > 0) {
                 // If existing filter is complex (e.g., $or for address), combine using $and
                 if (mongoFilter['$or']) {
                     mongoFilter = { $and: [mongoFilter, blockFilter] };
                 } else {
                     // If simple filter, merge (this shouldn't happen if parser logic is correct)
                     Object.assign(mongoFilter, blockFilter);
                 }
             } else {
                 mongoFilter = blockFilter; // Only the block filter applies
             }
            filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
            console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
        }

        // --- Step 2: Branch based on query type ---

        if (requiresRelationCheck) {
            // --- Handle "Relation Cluster" Query ---
            if (!targetAddress) { throw new Error("Target address missing for relation check."); }
            await thinkingMessage.edit(`⏳ Analyzing relations for ${targetAddress.substring(0,6)}... (${filterDescription})...`);
            if (typeof mongoHelper.findAddressRelations !== 'function') { throw new Error("Relation query function not available."); }

            const allInteractions = await mongoHelper.findAddressRelations(targetAddress, mongoFilter);

            if (!allInteractions || allInteractions.length === 0) {
                fullResponseText = `No direct interactions found for \`${targetAddress}\` within the specified period (${filterDescription}).`;
                fileBuffer = null; // Ensure null
            } else {
                 // --- Fetch labels for ALL counterparties for the CSV ---
                 const allInteractionCounterparties = [...new Set(allInteractions.map(i => i.counterparty))];
                 const allLabelsMap = await mongoHelper.getLabelsForAddresses(allInteractionCounterparties);
                 console.log(`[WhaleWatcher] Fetched ${allLabelsMap.size} labels for ${allInteractionCounterparties.length} total counterparties for CSV.`);
                 // --- End Fetch Labels for CSV ---

                // Generate CSV from ALL interactions, passing the labelsMap
                fileName = `relations_${targetAddress.substring(0,10)}_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`;
                fileBuffer = generateDataFile(allInteractions, 'relations', 'csv', allLabelsMap); // Pass map to helper

                // --- Aggregate data for Discord summary ---
                const summaryRelations = {};
                allInteractions.forEach(interaction => { /* ... aggregation logic ... */
                     const cpAddr = interaction.counterparty; if (!summaryRelations[cpAddr]) { summaryRelations[cpAddr] = { totalInBTC: 0, totalOutBTC: 0, txCount: 0, types: new Set() }; } summaryRelations[cpAddr].txCount++; summaryRelations[cpAddr].types.add(interaction.txType); if (interaction.direction === 'IN') { summaryRelations[cpAddr].totalInBTC += interaction.valueBTC; } else if (interaction.direction === 'OUT') { summaryRelations[cpAddr].totalOutBTC += interaction.valueBTC; }
                 });
                // --- End Aggregation ---

                const allCounterparties = Object.keys(summaryRelations);
                const sortedCounterparties = allCounterparties.sort((a, b) => (summaryRelations[b].totalInBTC + summaryRelations[b].totalOutBTC) - (summaryRelations[a].totalInBTC + summaryRelations[a].totalOutBTC) );
                const limitedCounterparties = sortedCounterparties.slice(0, RELATION_DISPLAY_LIMIT); // Limit for display

                // Use the already fetched labelsMap for the limited display
                const displayLabelsMap = new Map(limitedCounterparties.map(addr => [addr, allLabelsMap.get(addr)]).filter(entry => entry[1]));

                fullResponseText = `**Interaction Summary for \`${targetAddress}\` (${filterDescription}):**\n*(Showing Top ${limitedCounterparties.length} of ${allCounterparties.length} total counterparties)*\n\n`;
                limitedCounterparties.forEach((cpAddr, index) => { /* ... formatting logic for display ... */
                    const data = summaryRelations[cpAddr]; const label = displayLabelsMap.get(cpAddr); const inBTC = data.totalInBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const outBTC = data.totalOutBTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }); const types = Array.from(data.types).join(', ').replace(/_/g, ' '); const line = `${index + 1}. \`${cpAddr}\`${label ? ` (*${label}*)` : ''}: IN **${inBTC}** | OUT **${outBTC}** | (${data.txCount} txs) | Types: *${types}*\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; }
                 });
                 if (allCounterparties.length > RELATION_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allCounterparties.length - RELATION_DISPLAY_LIMIT} more interactions.`; }
                 fullResponseText += `\n\n*See attached CSV for all ${allInteractions.length} interactions, including TxHashes & Labels.*`;
                 fullResponseText += `\n*Tx Types key: single=1:1, consolidation=many:1(target), distribution=1(target):many.*`;
            }
            skipAI = true; // Skip AI for this

        } else if (requiresMostActiveCheck) {
            // --- Handle "Most Active" Query ---
             await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`);
             const allActiveAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_FETCH_LIMIT);
             if (!allActiveAddresses || allActiveAddresses.length === 0) { fullResponseText = `No significant address activity found for: \`${filterDescription}\``; fileBuffer = null; }
             else {
                  fileName = `most_active_${filterDescription.replace(/[^a-z0-9]/gi, '_')}.csv`;
                  // Pass labels fetched inside getMostActiveAddresses if available, or fetch again if needed by generateDataFile
                  // Assuming getMostActiveAddresses returns labels in the objects:
                  fileBuffer = generateDataFile(allActiveAddresses, 'most_active', 'csv');
                  const limitedActiveAddresses = allActiveAddresses.slice(0, MOST_ACTIVE_DISPLAY_LIMIT);
                  fullResponseText = `**Most Active Addresses (${filterDescription}):**\n*(Showing Top ${limitedActiveAddresses.length} of ${allActiveAddresses.length} found)*\n\n`;
                  limitedActiveAddresses.forEach((item, index) => { /* ... formatting logic ... */
                      const inBTC = item.totalInBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const outBTC = item.totalOutBTC.toLocaleString(undefined, { maximumFractionDigits: 4 }); const line = `${index + 1}. \`${item.address}\` (${item.count} txs, IN: ${inBTC} BTC, OUT: ${outBTC} BTC)${item.label ? ` - *${item.label}*` : ''}\n`; if (fullResponseText.length + line.length < 1900) { fullResponseText += line; } else if (!fullResponseText.endsWith("...")) { fullResponseText += "..."; return; }
                   });
                   if (allActiveAddresses.length > MOST_ACTIVE_DISPLAY_LIMIT) { fullResponseText += `\n...and ${allActiveAddresses.length - MOST_ACTIVE_DISPLAY_LIMIT} more (see attached CSV).`; }
             }
             skipAI = true; // Skip AI

        } else {
            // --- Handle Standard Transaction Summary Query ---
             await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`); let summaryData, topTransactions; try { const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI); summaryData = results.summary; topTransactions = results.topTransactions; summaryData.filter = filterDescription; if (!summaryData || topTransactions.length === 0) { await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``); return; } console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`); } catch (dbError) { throw dbError; }
             if (topTransactions.length > 0) { await thinkingMessage.edit("⏳ Generating data file..."); fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}byValue.csv`; fileBuffer = generateDataFile(topTransactions, 'transactions', 'csv'); } // Pass topTransactions directly
             finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery);

             // --- **Log finalPrompt before token check** ---
             console.log("[WhaleWatcher] Final prompt BEFORE token check (first 100):", finalPrompt ? finalPrompt.substring(0,100) + '...' : finalPrompt);
             // --- End Log ---

             let encoding; try {
                 // --- **Stricter Prompt Validation** ---
                 if (typeof finalPrompt !== 'string' || finalPrompt.length === 0 || finalPrompt.includes('[Error processing transaction details')) {
                      console.error("[WhaleWatcher] Invalid or error-containing finalPrompt generated. Prompt snippet:", finalPrompt ? finalPrompt.substring(0, 500) : finalPrompt);
                      throw new Error('Constructed final prompt is invalid or contains processing errors.');
                 }
                 // --- End Validation ---
                 encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Estimated prompt tokens: ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}).`); } encoding.free();
            } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); if(encoding) encoding.free(); throw new Error(`Error estimating AI tokens: ${tokenError.message}`); } // Pass specific error

             // Get AI Response (Streaming)
             await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs...`);
             // ... (Streaming logic - unchanged) ...
              let stream = null; try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); } catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }
             fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false; try { for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; if (content) accumulatedChunk += content; const now = Date.now(); if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "..."; if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } } else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } } } console.log(`[WhaleWatcher] Stream finished.`); } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; } if (!streamErrored) { fullResponseText += accumulatedChunk; } if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }
        } // End standard query path

        // --- Final Discord Message Update ---
        console.log("[WhaleWatcher] Preparing final message edit...");
        // ... (Final message construction & sending - unchanged) ...
        let finalReplyOptions = {}; if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response or analysis."; if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); } if (!skipAI && fullResponseText.length > 0 && !fullResponseText.toLowerCase().includes("not financial advice")) { fullResponseText += "\n\n*(Disclaimer: AI analysis, NOT financial advice.)*"; } if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "..."; finalReplyOptions.content = fullResponseText; finalReplyOptions.files = []; if (fileBuffer) { const attachment = new AttachmentBuilder(fileBuffer, { name: fileName }); finalReplyOptions.files.push(attachment); const fileNote = `\n\n*See attached \`${fileName}\` for full details.*`; if (finalReplyOptions.content.length + fileNote.length <= 2000) { finalReplyOptions.content += fileNote; } else { console.warn("[WhaleWatcher] Content too long to add file attachment note."); } } else { if (!requiresMostActiveCheck && !requiresRelationCheck) { const fileErrorNote = `\n\n*(Error generating data file)*`; if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) { finalReplyOptions.content += fileErrorNote; } } } console.log('[WhaleWatcher] Final Reply Options:', {content: finalReplyOptions.content.substring(0,100)+'...', fileCount: finalReplyOptions.files.length}); await thinkingMessage.edit(finalReplyOptions); console.log("[WhaleWatcher] Final message sent/edited.");


    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
        const errorMsg = `Sorry, encountered an error processing the whale command: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };


