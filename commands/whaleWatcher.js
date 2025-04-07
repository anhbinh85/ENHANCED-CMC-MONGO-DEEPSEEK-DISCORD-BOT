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

// // --- Helper: Generate File ---
// function generateTxFile(topNData, format = 'csv') { /**/
//     console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for Top ${topNData.length} transactions...`);
//     const dataForFile = topNData.map(tx => {
//         let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} }
//         const valueBTC = Number(tx?.value || 0) / 1e8;
//         return {
//             Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block,
//             Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A',
//             From_Addresses: tx?.from?.join(', ') || '', From_Labels: tx?.fromLabels?.join(' | ') || '',
//             To_Addresses: tx?.to?.join(', ') || '', To_Labels: tx?.toLabels?.join(' | ') || '',
//             Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`,
//         };
//     });
//     try {
//         if (format === 'csv' && stringify) { const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : []; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
//         else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
//         else { throw new Error("Invalid format or csv-stringify missing."); }
//     } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file:`, fileError); return null; }
// }

// // --- Helper: Construct AI Prompt (for Transaction Summary) ---
// const constructWhalePrompt = (summary, topNData, query) => { /**/
//     let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\nUser Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`;
//     const processedData = topNData.map(doc => { /* ... mapping logic ... */
//          const newDoc = { txHash: doc?.txHash, timestamp: null, block: doc?.block?.$numberInt || doc?.block?.$numberLong || doc?.block, valueBTC: parseFloat((Number(doc?.value?.$numberLong || doc?.value?.$numberInt || doc?.value || 0) / 1e8).toFixed(4)), from: doc?.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc?.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] };
//          if (doc?._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} } return newDoc;
//     });
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
//     // let plan = {}; // Not using AI plan structure here anymore
//     let finalPrompt = "";

//     try {
//         thinkingMessage = await message.reply("⏳ Preparing whale report...");

//         // --- Step 1: Parse the user query ---
//         const parseResult = parseWhaleQuery(userQuery);

//         if (parseResult.parseError) {
//             throw new Error(parseResult.parseError); // Throw parsing errors
//         }

//         let mongoFilter = parseResult.mongoFilter;
//         let filterDescription = parseResult.filterDescription;
//         const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
//         const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;

//         // --- Step 1b: Handle 'latest block' lookups ---
//         if (requiresLatestBlockLookup) {
//             await thinkingMessage.edit(`⏳ Finding latest block...`);
//             const latestBlock = await mongoHelper.getLatestBlockNumber();
//             if (latestBlock === null) {
//                 throw new Error("Could not determine the latest block number from the database.");
//             }
//             // Combine with existing filter (if any, e.g., address)
//             const blockFilter = { block: latestBlock };
//             if (Object.keys(mongoFilter).length > 0) {
//                  mongoFilter = { $and: [mongoFilter, blockFilter] };
//             } else {
//                  mongoFilter = blockFilter;
//             }
//             // Update description if it was generic 'latest block'
//             if (filterDescription === "latest block") {
//                  filterDescription = `latest block (${latestBlock})`;
//             } else {
//                  filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
//             }
//             console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
//         }

//         // --- Step 2: Branch based on query type (Most Active vs. Transaction Summary) ---

//         if (requiresMostActiveCheck) {
//             // --- Handle "Most Active" Query ---
//             await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`);
//             const activeAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_LIMIT);

//             if (!activeAddresses || activeAddresses.length === 0) {
//                 fullResponseText = `No significant address activity found for: \`${filterDescription}\``;
//             } else {
//                 fullResponseText = `**Most Active Addresses (${filterDescription}):**\n`;
//                 activeAddresses.forEach((item, index) => {
//                     fullResponseText += `${index + 1}. ${item.address} (${item.count} txs)${item.label ? ` - ${item.label}` : ''}\n`;
//                 });
//                 // Limit response length just in case
//                 if (fullResponseText.length > 1900) fullResponseText = fullResponseText.substring(0, 1900) + "...";
//             }
//             // Skip file generation and AI analysis for this path for now
//             fileBuffer = null;

//         } else {
//             // --- Handle Standard Transaction Summary Query ---
//             await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
//             let summaryData, topTransactions;
//             try {
//                 const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI);
//                 summaryData = results.summary;
//                 topTransactions = results.topTransactions;
//                 // Add the final filter description to summary object for the prompt
//                 summaryData.filter = filterDescription;

//                 if (!summaryData || topTransactions.length === 0) {
//                     await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``);
//                     return; // Exit early if no data
//                 }
//                 console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`);
//             } catch (dbError) {
//                 console.error(`[WhaleWatcher] Database query error:`, dbError);
//                 throw new Error(`Database error fetching whale data: ${dbError.message}`);
//             }

//             // --- Generate File ---
//             if (topTransactions.length > 0) {
//                 await thinkingMessage.edit("⏳ Generating data file...");
//                 fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}.csv`;
//                 fileBuffer = generateTxFile(topTransactions, 'csv'); // Pass only topTransactions
//             }

//             // --- Construct Final AI Prompt ---
//             finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery);

//             // --- Token Check ---
//             let encoding; try {
//                 if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) { throw new Error('Constructed final prompt is invalid.'); }
//                 encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length;
//                 console.log(`[WhaleWatcher] Estimated prompt tokens (Summary + Top ${topTransactions.length}): ${estimatedTokens}`);
//                 if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}). AI analysis might fail.`); }
//                 encoding.free();
//             } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating AI tokens."); }

//             // --- Get Response from AI (Streaming) ---
//             await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs...`);
//             let stream = null; try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); }
//             catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }

//             fullResponseText = ""; // Reset before accumulating stream
//             let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false;
//             try {
//                  for await (const chunk of stream) {
//                       const content = chunk.choices[0]?.delta?.content || '';
//                       if (content) accumulatedChunk += content;
//                       const now = Date.now();
//                       if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
//                            fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
//                            if (currentEditText.length <= 2000) { console.log(`Editing msg (Len: ${currentEditText.length})...`); try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } }
//                            else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
//                       }
//                  } console.log(`[WhaleWatcher] Stream finished.`);
//             } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; }
//             if (!streamErrored) { fullResponseText += accumulatedChunk; }
//             if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }
//         } // End else block for standard query

//         // --- Final Discord Message Update ---
//         console.log("[WhaleWatcher] Preparing final message edit...");
//         let finalReplyOptions = {};

//         if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response or analysis.";
//         // Clean up trailing ellipsis if not truncated
//         if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
//         // Final length check
//         if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";

//         finalReplyOptions.content = fullResponseText;

//         // Add file if generated (only for non-'most active' path)
//         if (fileBuffer && !requiresMostActiveCheck) {
//             const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
//             finalReplyOptions.files = [attachment];
//             // Add note about attachment, ensuring total length constraint
//             const attachmentNote = `\n\n*See attached \`${fileName}\` for Top ${TOP_N_FOR_AI} tx details.*`;
//             if (finalReplyOptions.content.length + attachmentNote.length <= 2000) {
//                  finalReplyOptions.content += attachmentNote;
//             } else {
//                  console.warn("[WhaleWatcher] Content too long to add file attachment note.");
//             }
//         } else if (!requiresMostActiveCheck) {
//              // Add error note only if a file was EXPECTED but not generated
//              const fileErrorNote = `\n\n*(Error generating transaction data file)*`;
//              if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) {
//                   finalReplyOptions.content += fileErrorNote;
//              }
//         }

//         // Ensure files array exists even if empty for consistency
//         if (!finalReplyOptions.files) {
//              finalReplyOptions.files = [];
//         }

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
const { parseWhaleQuery } = require('../utils/filterParser'); // Import the refined parser
const { stringify } = require('csv-stringify/sync');

// --- Configuration ---
const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';
const MOST_ACTIVE_LIMIT = 10; // How many most active addresses to show

// --- Helper: Generate File (Unchanged) ---
function generateTxFile(topNData, format = 'csv') { /**/
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for Top ${topNData.length} transactions...`);
    const dataForFile = topNData.map(tx => {
        let timestamp = null; if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){} }
        const valueBTC = Number(tx?.value || 0) / 1e8;
        return { Timestamp: timestamp, Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block, Value_BTC: valueBTC.toFixed(8), TxHash: tx?.txHash || 'N/A', From_Addresses: tx?.from?.join(', ') || '', From_Labels: tx?.fromLabels?.join(' | ') || '', To_Addresses: tx?.to?.join(', ') || '', To_Labels: tx?.toLabels?.join(' | ') || '', Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`, };
    });
    try {
        if (format === 'csv' && stringify) { const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : []; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
        else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
        else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file:`, fileError); return null; }
}

// --- Helper: Construct AI Prompt (Unchanged) ---
const constructWhalePrompt = (summary, topNData, query) => { /**/
    let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\nUser Query: "${query}"\nFilter Applied: "${summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC\nBlock Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}\n---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n\`\`\`json\n`;
    const processedData = topNData.map(doc => { const newDoc = { txHash: doc?.txHash, timestamp: null, block: doc?.block?.$numberInt || doc?.block?.$numberLong || doc?.block, valueBTC: parseFloat((Number(doc?.value?.$numberLong || doc?.value?.$numberInt || doc?.value || 0) / 1e8).toFixed(4)), from: doc?.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [], to: doc?.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || [] }; if (doc?._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} } return newDoc; });
    try { prompt += JSON.stringify(processedData, null, 2); }
    catch (stringifyError) { console.error("[constructWhalePrompt] Error stringifying processedData:", stringifyError); prompt += `[Error processing transaction details: ${stringifyError.message}]`; }
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
    let fileName = 'whale_transactions.csv';
    let finalPrompt = "";

    try {
        thinkingMessage = await message.reply("⏳ Preparing whale report...");

        // Step 1: Parse the user query
        const parseResult = parseWhaleQuery(userQuery);

        if (parseResult.parseError) {
            throw new Error(parseResult.parseError);
        }

        let mongoFilter = parseResult.mongoFilter;
        let filterDescription = parseResult.filterDescription;
        const requiresLatestBlockLookup = parseResult.requiresLatestBlockLookup;
        const requiresMostActiveCheck = parseResult.requiresMostActiveCheck;

        // Step 1b: Handle 'latest block' lookups
        if (requiresLatestBlockLookup) {
            await thinkingMessage.edit(`⏳ Finding latest block for: ${filterDescription}...`);
            const latestBlock = await mongoHelper.getLatestBlockNumber();
            if (latestBlock === null) {
                throw new Error("Could not determine the latest block number.");
            }
            const blockFilter = { block: latestBlock };
            if (Object.keys(mongoFilter).length > 0 && mongoFilter.$or) { // If address filter exists
                 mongoFilter = { $and: [mongoFilter, blockFilter] };
            } else { // If it was just '!whale latest'
                 mongoFilter = blockFilter;
            }
            // Update description
            filterDescription = filterDescription.replace('latest block', `latest block (${latestBlock})`);
            console.log(`[WhaleWatcher] Updated filter for latest block ${latestBlock}: ${JSON.stringify(mongoFilter)}`);
        }

        // Step 2: Branch based on query type
        if (requiresMostActiveCheck) {
            // --- Handle "Most Active" Query ---
            await thinkingMessage.edit(`⏳ Finding most active addresses for: ${filterDescription}...`);
            const activeAddresses = await mongoHelper.getMostActiveAddresses(mongoFilter, MOST_ACTIVE_LIMIT);

            if (!activeAddresses || activeAddresses.length === 0) {
                fullResponseText = `No significant address activity found for: \`${filterDescription}\``;
            } else {
                fullResponseText = `**Most Active Addresses (${filterDescription}):**\n`;
                activeAddresses.forEach((item, index) => {
                    // Format IN/OUT values
                    const inBTC = item.totalInBTC.toLocaleString(undefined, { maximumFractionDigits: 4 });
                    const outBTC = item.totalOutBTC.toLocaleString(undefined, { maximumFractionDigits: 4 });

                    fullResponseText += `${index + 1}. \`${item.address}\` (${item.count} txs`;
                    fullResponseText += `, IN: ${inBTC} BTC`; // Add IN value
                    fullResponseText += `, OUT: ${outBTC} BTC`; // Add OUT value
                    fullResponseText += `)${item.label ? ` - *${item.label}*` : ''}\n`; // Add label if exists
                });
                if (fullResponseText.length > 1900) fullResponseText = fullResponseText.substring(0, 1900) + "..."; // Limit length
            }
            // Skip file generation and AI analysis for this path
            fileBuffer = null;

        } else {
            // --- Handle Standard Transaction Summary Query ---
            await thinkingMessage.edit(`⏳ Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
            let summaryData, topTransactions;
            try {
                const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI);
                summaryData = results.summary;
                topTransactions = results.topTransactions;
                summaryData.filter = filterDescription; // Add final description for prompt context

                if (!summaryData || topTransactions.length === 0) {
                    await thinkingMessage.edit(`No whale transaction data found for: \`${filterDescription}\``);
                    return;
                }
                console.log(`[WhaleWatcher] Received summary and top ${topTransactions.length} txs.`);
            } catch (dbError) { throw dbError; }

            // Generate File
            if (topTransactions.length > 0) {
                await thinkingMessage.edit("⏳ Generating data file...");
                fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'summary'}_top${topTransactions.length}.csv`;
                fileBuffer = generateTxFile(topTransactions, 'csv');
            }

            // Construct AI Prompt
            finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery);

            // Token Check
            let encoding; try {
                if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) { throw new Error('Constructed final prompt is invalid.'); }
                encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length;
                console.log(`[WhaleWatcher] Estimated prompt tokens (Summary + Top ${topTransactions.length}): ${estimatedTokens}`);
                if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}).`); }
                encoding.free();
            } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating AI tokens."); }

            // Get AI Response (Streaming)
            await thinkingMessage.edit(`⏳ Analyzing summary & top ${topTransactions.length} txs...`);
            let stream = null; try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received."); }
            catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }

            fullResponseText = ""; // Reset
            let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let streamErrored = false;
            try { // Wrap stream processing
                 for await (const chunk of stream) {
                      const content = chunk.choices[0]?.delta?.content || '';
                      if (content) accumulatedChunk += content;
                      const now = Date.now();
                      if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
                           fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
                           if (currentEditText.length <= 2000) { try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } }
                           else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
                      }
                 } console.log(`[WhaleWatcher] Stream finished.`);
            } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; }
            if (!streamErrored) { fullResponseText += accumulatedChunk; }
            if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }
        } // End else block for standard query

        // --- Final Discord Message Update ---
        console.log("[WhaleWatcher] Preparing final message edit...");
        let finalReplyOptions = {};

        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate a response or analysis.";
        if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
        if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";

        finalReplyOptions.content = fullResponseText;

        // Add file if generated (only for non-'most active' path)
        if (fileBuffer && !requiresMostActiveCheck) {
            const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
            finalReplyOptions.files = [attachment];
            const attachmentNote = `\n\n*See attached \`${fileName}\` for Top ${TOP_N_FOR_AI} tx details.*`;
            if (finalReplyOptions.content.length + attachmentNote.length <= 2000) {
                 finalReplyOptions.content += attachmentNote;
            } else { console.warn("[WhaleWatcher] Content too long to add file attachment note."); }
        } else if (!requiresMostActiveCheck && !fileBuffer) { // Add file error note only if a file was expected
             const fileErrorNote = `\n\n*(Error generating transaction data file)*`;
             if (finalReplyOptions.content.length + fileErrorNote.length <= 2000) {
                  finalReplyOptions.content += fileErrorNote;
             }
        }

        if (!finalReplyOptions.files) { finalReplyOptions.files = []; }

        console.log('[WhaleWatcher] Final Reply Options:', {content: finalReplyOptions.content.substring(0,100)+'...', fileCount: finalReplyOptions.files.length});
        await thinkingMessage.edit(finalReplyOptions);
        console.log("[WhaleWatcher] Final message sent/edited.");

    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
        const errorMsg = `Sorry, encountered an error processing the whale command: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };


