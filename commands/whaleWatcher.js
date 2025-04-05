// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const { AttachmentBuilder } = require('discord.js');
// const mongoHelper = require('../services/mongoHelper');
// const aiHelper = require('../services/aiHelper');
// // Optional: Use csv-stringify for robust CSV generation
// // If not installed (npm install csv-stringify), set USE_CSV_LIB to false
// const USE_CSV_LIB = true;
// let stringify;
// if (USE_CSV_LIB) {
//     try {
//         stringify = require('csv-stringify/sync').stringify;
//     } catch (e) {
//         console.warn("csv-stringify library not found, falling back to basic CSV generation. Run 'npm install csv-stringify'");
//         // stringify = null; // Or implement basic fallback
//         throw new Error("csv-stringify library not found. Please install it."); // Let's make it mandatory for cleaner code
//     }
// }


// // --- Configuration ---
// const BTC_WHALE_COLLECTION = mongoHelper.WHALE_TRANSFERS_COLLECTION;
// const INITIAL_FETCH_LIMIT = parseInt(process.env.WHALE_INITIAL_FETCH_LIMIT || "100");
// const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
// const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
// const TOKENIZER_ENCODING = 'cl100k_base';
// const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';

// // --- Helper: Summarize Fetched Data ---
// // (Keep summarizeWhaleData function exactly the same as previous version)
// function summarizeWhaleData(dbData, addressLabelMap, filterDescription) { /* ... same logic ... */
//     const summary = { filter: filterDescription, totalTxCount: dbData.length, totalVolumeBTC: 0, exchangeInflowCount: 0, exchangeInflowVolumeBTC: 0, exchangeOutflowCount: 0, exchangeOutflowVolumeBTC: 0, exchangeInternalCount: 0, exchangeInternalVolumeBTC: 0, labeledAddressCount: 0, involvedLabels: new Set(), }; const exchangeKeywords = ['exchange', 'binance', 'coinbase', 'kraken', 'okx', 'bybit', 'bitfinex', 'huobi', 'kucoin', 'gemini']; for (const tx of dbData) { const valueBTC = Number(tx.value?.$numberLong || tx.value?.$numberInt || tx.value || 0) / 1e8; summary.totalVolumeBTC += valueBTC; let fromLabels = tx.from.map(addr => addressLabelMap.get(addr)).filter(label => label); let toLabels = tx.to.map(addr => addressLabelMap.get(addr)).filter(label => label); let isFromExchange = fromLabels.some(label => exchangeKeywords.some(kw => label.toLowerCase().includes(kw))); let isToExchange = toLabels.some(label => exchangeKeywords.some(kw => label.toLowerCase().includes(kw))); if (fromLabels.length > 0 || toLabels.length > 0) { summary.labeledAddressCount++; fromLabels.forEach(label => summary.involvedLabels.add(label)); toLabels.forEach(label => summary.involvedLabels.add(label)); } if (isToExchange && !isFromExchange) { summary.exchangeInflowCount++; summary.exchangeInflowVolumeBTC += valueBTC; } else if (isFromExchange && !isToExchange) { summary.exchangeOutflowCount++; summary.exchangeOutflowVolumeBTC += valueBTC; } else if (isFromExchange && isToExchange) { summary.exchangeInternalCount++; summary.exchangeInternalVolumeBTC += valueBTC; } } summary.involvedLabels = Array.from(summary.involvedLabels); summary.totalVolumeBTC = parseFloat(summary.totalVolumeBTC.toFixed(2)); summary.exchangeInflowVolumeBTC = parseFloat(summary.exchangeInflowVolumeBTC.toFixed(2)); summary.exchangeOutflowVolumeBTC = parseFloat(summary.exchangeOutflowVolumeBTC.toFixed(2)); summary.exchangeInternalVolumeBTC = parseFloat(summary.exchangeInternalVolumeBTC.toFixed(2)); return summary;
// }


// // --- UPDATED Helper: Generate Transaction File with Labels ---
// function generateTxFile(allDbData, addressLabelMap, format = 'csv') {
//     console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for ${allDbData.length} transactions...`);
//     const dataForFile = allDbData.map(tx => {
//         let timestamp = null;
//         if (tx._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch {} }
//         const valueBTC = Number(tx.value?.$numberLong || tx.value?.$numberInt || tx.value || 0) / 1e8;
//         // Separate Addresses and Labels
//         const fromAddresses = tx.from?.join(', ') || '';
//         const toAddresses = tx.to?.join(', ') || '';
//         const fromLabels = tx.from?.map(addr => addressLabelMap.get(addr) || '').filter(Boolean).join(' | ') || ''; // Join multiple labels with |
//         const toLabels = tx.to?.map(addr => addressLabelMap.get(addr) || '').filter(Boolean).join(' | ') || ''; // Join multiple labels with |
//         const link = `${BLOCK_EXPLORER_URL}${tx.txHash}`;

//         return {
//             Timestamp: timestamp,
//             Block: tx.block?.$numberInt || tx.block,
//             Value_BTC: valueBTC.toFixed(8),
//             TxHash: tx.txHash,
//             From_Addresses: fromAddresses, // Just addresses
//             From_Labels: fromLabels,       // Just labels
//             To_Addresses: toAddresses,       // Just addresses
//             To_Labels: toLabels,         // Just labels
//             Explorer_Link: link,
//         };
//     });

//     if (format === 'csv' && stringify) {
//         try {
//             const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : [];
//             const csvString = stringify(dataForFile, { header: true, columns: columns });
//             return Buffer.from(csvString, 'utf-8');
//         } catch (csvError) { console.error("[WhaleWatcher] Error generating CSV:", csvError); return null; }
//     } else if (format === 'json') {
//         try { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
//         catch (jsonError) { console.error("[WhaleWatcher] Error generating JSON:", jsonError); return null; }
//     } else {
//          console.error(`[WhaleWatcher] Invalid format or csv-stringify missing for file generation.`);
//          return null; // Fallback if format unknown or lib missing
//      }
// }

// // --- UPDATED Helper: Construct AI Prompt (No Link Instruction) ---
// const constructWhalePrompt = (summary, topNData, query) => {
//     let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\n`;
//     prompt += `User Query: "${query}"\n\n`;
//     prompt += `== Data Summary (${summary.filter || 'General'}) ==\n`;
//     prompt += `Total Transactions Found: ${summary.totalTxCount}\n`; // ... (include other summary fields) ...
//     prompt += `Total Volume: ${summary.totalVolumeBTC.toLocaleString()} BTC\n`;
//     prompt += `Exchange Inflows: ${summary.exchangeInflowCount} txs / ${summary.exchangeInflowVolumeBTC.toLocaleString()} BTC\n`;
//     prompt += `Exchange Outflows: ${summary.exchangeOutflowCount} txs / ${summary.exchangeOutflowVolumeBTC.toLocaleString()} BTC\n`;
//     if (summary.exchangeInternalCount > 0) prompt += `Exchange Internal: ${summary.exchangeInternalCount} txs / ${summary.exchangeInternalVolumeBTC.toLocaleString()} BTC\n`;
//     prompt += `Labeled Wallet Txs: ${summary.labeledAddressCount}\n`;
//     if (summary.involvedLabels.length > 0) prompt += `Labels Involved: ${summary.involvedLabels.slice(0, 10).join(', ')}${summary.involvedLabels.length > 10 ? '...' : ''}\n`;
//     prompt += `---\n\n`;

//     prompt += `Below are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n`;
//     prompt += "```json\n";
//     const processedData = topNData.map(doc => {
//         const newDoc = { ...doc };
//         if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
//         newDoc.value = Number(doc.value?.$numberLong || doc.value?.$numberInt || doc.value || 0);
//         if (newDoc.block && typeof newDoc.block === 'object') newDoc.block = parseInt(newDoc.block.$numberInt || newDoc.block.$numberLong || newDoc.block);
//         // Add labels from the map passed previously (assuming map was added to doc temporarily)
//         newDoc.from = doc.from?.map(addr => `${addr}${doc.addressLabelMap?.has(addr) ? ` (${doc.addressLabelMap.get(addr)})` : ''}`);
//         newDoc.to = doc.to?.map(addr => `${addr}${doc.addressLabelMap?.has(addr) ? ` (${doc.addressLabelMap.get(addr)})` : ''}`);
//         delete newDoc._id;
//         delete newDoc.addressLabelMap;
//         return newDoc;
//     });
//     prompt += JSON.stringify(processedData, null, 2);
//     prompt += "\n```\n\n";

//     // --- MODIFIED INSTRUCTION: REMOVED LINK REQUEST ---
//     prompt += `Analysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions:
// 1. Comment on overall activity (volume, exchange flows).
// 2. Highlight significant transactions from the Top ${topNData.length} list, mentioning labels/exchanges.
// 3. Comment on potential price impact context if possible (use cautious language).
// 4. **Be concise: Keep response well under 2000 chars / ~450 tokens.**
// 5. When mentioning transactions, include the 'txHash' (e.g., \`0x123...abc\`). **DO NOT format it as a markdown link.**`;
//     // --- END MODIFIED INSTRUCTION ---
//     return prompt;
// };


// // --- Main Handler Function ---
// async function handleWhaleCommand(message, userQuery) {
//     if (!userQuery) { /* ... handle empty ... */ }
//     console.log(`[WhaleWatcher] Query: "${userQuery}"`);
//     let thinkingMessage = null; let fullResponseText = ""; let fileBuffer = null; let fileName = 'whale_transactions.csv';

//     try {
//         thinkingMessage = await message.reply("🐳 Fetching whale data...");

//         // --- Determine Filter/Sort/Limit (Same logic as before) ---
//         let mongoFilter = {}; let mongoSort = { _id: -1 }; let limit = INITIAL_FETCH_LIMIT; let filterDescription = "latest activity";
//         // ... (Keep the full block of if/else if conditions for parsing userQuery - txHash, block, last hour, timeMatch, address, value, general) ...
//          const lowerCaseQuery = userQuery.toLowerCase(); const txHashMatch = userQuery.match(/\b([a-fA-F0-9]{64})\b/); const blockMatch = lowerCaseQuery.match(/(?:latest block|block latest)/) ? 'LATEST_BLOCK' : lowerCaseQuery.match(/(?:block|in block)\s+(\d+)/i); const addressMatch = userQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i); const valueMatch = lowerCaseQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i); const lastHourMatch = lowerCaseQuery.includes("last hour") || lowerCaseQuery.includes("past hour"); const timeMatch = lowerCaseQuery.match(/today|yesterday|last day|last 24 hours|last month|last week|last \d+ hour|last \d+ day/);
//          if (txHashMatch) { mongoFilter = { txHash: txHashMatch[0] }; mongoSort = null; limit = 1; filterDescription = `tx ${txHashMatch[0].substring(0,4)}...`; }
//          else if (blockMatch === 'LATEST_BLOCK') { mongoSort = { block: -1, _id: -1 }; limit = INITIAL_FETCH_LIMIT; filterDescription = "latest block found"; }
//          else if (blockMatch) { try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; mongoSort={_id:-1}; filterDescription=`block ${b}`; }} catch(e){} }
//          else if (lastHourMatch) { const now=new Date(); const s = Math.floor((now.getTime() - 60*60*1000)/1000); mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}}; mongoSort={_id:-1}; filterDescription="last hour"; }
//          else if (timeMatch) { const now = new Date(); let startSeconds, endSeconds = null; const timeQuery=timeMatch[0]; /* ... logic to set startSeconds/endSeconds/filterDescription based on timeQuery ... */ if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; } else { mongoFilter={_id:{$gte:sO}}; } mongoSort={_id:-1}; console.log(`Time Filter: ${JSON.stringify(mongoFilter)}`); } }
//          else if (addressMatch) { const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; mongoSort = { _id: -1 }; filterDescription = `address ${a.substring(0,6)}...`; }
//          else if (valueMatch) { try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break;case'<':mOp='$lt';break;case'>=':mOp='$gte';break;case'<=':mOp='$lte';break; default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; mongoSort={value:-1}; filterDescription=`value ${op} ${v}`; }} catch(e){} }
//          else { mongoFilter={}; mongoSort={_id:-1}; limit=INITIAL_FETCH_LIMIT; filterDescription="latest activity"; }

//         // --- Query MongoDB ---
//         await thinkingMessage.edit("🐳 Fetching transactions...");
//         let dbData = null;
//         try {
//             dbData = await mongoHelper.queryCollection(BTC_WHALE_COLLECTION, mongoFilter, limit, mongoSort);
//             if (!dbData || dbData.length === 0) { await thinkingMessage.edit(`No whale data found for: ${filterDescription}`); return; }
//             console.log(`[WhaleWatcher] Fetched ${dbData.length} records initially.`);
//             // Handle latest block filtering if needed
//              if (blockMatch === 'LATEST_BLOCK' && dbData.length > 0) { const latestBlock = dbData[0].block?.$numberInt || dbData[0].block; if (latestBlock) { console.log(`Filtering for latest block: ${latestBlock}`); dbData = dbData.filter(tx => (tx.block?.$numberInt || tx.block) === latestBlock); filterDescription = `latest block (${latestBlock})`; if (dbData.length === 0) { await thinkingMessage.edit(`No txs found in latest block ${latestBlock}.`); return; } } }
//         } catch (error) { /* ... handle DB error ... */ throw error; }

//         // --- Enrich with Labels ---
//         await thinkingMessage.edit("🏷️ Looking up labels...");
//         let addressLabelMap = new Map();
//         try {
//              const allAddresses = new Set(); dbData.forEach(tx => { tx.from?.forEach(a => allAddresses.add(a)); tx.to?.forEach(a => allAddresses.add(a)); });
//              if (allAddresses.size > 0) { addressLabelMap = await mongoHelper.getLabelsForAddresses(Array.from(allAddresses)); console.log(`Enriched with ${addressLabelMap.size} labels.`); }
//         } catch (labelError) { console.error("Label lookup error:", labelError); /* Continue anyway */ }
//         // Temporarily add map to each doc for easier access in helpers below
//         dbData.forEach(tx => { tx.addressLabelMap = addressLabelMap; });

//         // --- Summarize ALL Fetched Data ---
//         const summary = summarizeWhaleData(dbData, addressLabelMap, filterDescription);

//         // --- Sort ALL Fetched Data by Value ---
//         dbData.sort((a, b) => { const vA=Number(a.value?.$numberLong||a.value?.$numberInt||a.value||0); const vB=Number(b.value?.$numberLong||b.value?.$numberInt||b.value||0); return vB-vA; });

//         // --- Select Top N for AI ---
//         const topNDataForAI = dbData.slice(0, TOP_N_FOR_AI);

//         // --- Generate File (CSV/JSON) with ALL Data & Labels ---
//         await thinkingMessage.edit("💾 Generating data file...");
//         fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'latest'}.csv`;
//         fileBuffer = generateTxFile(dbData, addressLabelMap, 'csv'); // Use updated generator

//         // --- Construct Final AI Prompt (Summary + Top N, No Link Instruction) ---
//         finalPrompt = constructWhalePrompt(summary, topNDataForAI, userQuery); // Uses updated prompt constructor

//         // --- Token Check ---
//         let encoding; try { encoding = get_encoding(TOKENIZER_ENCODING); let estimatedTokens = encoding.encode(finalPrompt).length; console.log(`[WhaleWatcher] Est prompt tokens (Summary + Top ${topNDataForAI.length}): ${estimatedTokens}`); if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}).`); /* Warn only */ } encoding.free(); } catch (tokenError) { console.error("Token estimation error:", tokenError); if(encoding) encoding.free(); throw new Error("Error estimating AI tokens."); }

//         // --- Get Response from AI (Streaming) ---
//         await thinkingMessage.edit(`🐳 Analyzing summary & top ${topNDataForAI.length} transactions...`);
//         const stream = await aiHelper.getAIStream(finalPrompt);

//         // (Streaming logic - updates outer fullResponseText - identical)
//         let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; } try { await thinkingMessage.edit({ content: fullResponseText + "..." }); lastEditTime = now; } catch (e) { console.error("Edit error:", e.message); } } } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI analysis returned empty response.";


//         // --- Final Discord Message Update ---
//         if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate an analysis.";
//         if (fullResponseText.length > 1950) fullResponseText = fullResponseText.substring(0, 1950) + "..."; // Leave room for file note

//         const finalReplyOptions = { content: fullResponseText };
//         if (fileBuffer) {
//             const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
//             finalReplyOptions.files = [attachment];
//             finalReplyOptions.content += `\n\n*See attached \`${fileName}\` for full details (incl. labels & links).*`; // Update note
//         } else {
//              console.warn("[WhaleWatcher] File buffer was null.");
//              finalReplyOptions.content += `\n\n*(Error generating detailed file)*`;
//         }
//         await thinkingMessage.edit(finalReplyOptions);

//     } catch (error) { // Catch top-level errors
//         console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error);
//         const errorMsg = `Sorry, encountered an error processing whale data: ${error.message}`;
//         if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } }
//         else { await message.reply(errorMsg); }
//     }
// } // End handleWhaleCommand

// module.exports = { handleWhaleCommand };

// // commands/whaleWatcher.js
const { ObjectId } = require('mongodb'); // Ensure ObjectId is required
const { get_encoding } = require('tiktoken');
const { AttachmentBuilder } = require('discord.js');
const mongoHelper = require('../services/mongoHelper');
const aiHelper = require('../services/aiHelper');
const { stringify } = require('csv-stringify/sync'); // Ensure installed: npm install csv-stringify

// --- Configuration ---
const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "16000");
const TOKENIZER_ENCODING = 'cl100k_base';
const BLOCK_EXPLORER_URL = 'https://www.blockchain.com/btc/tx/';

// --- Helper: Generate File from Top N Data ---
// Uses enriched topNData which includes fromLabels/toLabels arrays
function generateTxFile(topNData, filterDescription, format = 'csv') {
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for Top ${topNData.length} transactions...`);
    const dataForFile = topNData.map(tx => {
        let timestamp = null;
        if (tx._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch {} }
        const valueBTC = Number(tx.value?.$numberLong || tx.value?.$numberInt || tx.value || 0) / 1e8;

        return { // Column names for CSV/JSON keys
            Timestamp: timestamp,
            Block: tx.block?.$numberInt || tx.block,
            Value_BTC: valueBTC.toFixed(8),
            TxHash: tx.txHash,
            From_Addresses: tx.from?.join(', ') || '',
            From_Labels: tx.fromLabels?.join(' | ') || '', // Use labels array added by mongoHelper
            To_Addresses: tx.to?.join(', ') || '',
            To_Labels: tx.toLabels?.join(' | ') || '',     // Use labels array added by mongoHelper
            Explorer_Link: `${BLOCK_EXPLORER_URL}${tx.txHash}`,
        };
    });

    try {
        if (format === 'csv' && stringify) {
            const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : ['Timestamp', 'Block', 'Value_BTC', 'TxHash', 'From_Addresses', 'From_Labels', 'To_Addresses', 'To_Labels', 'Explorer_Link']; // Define default columns
            const csvString = stringify(dataForFile, { header: true, columns: columns });
            return Buffer.from(csvString, 'utf-8');
        } else if (format === 'json') {
            const jsonString = JSON.stringify(dataForFile, null, 2);
            return Buffer.from(jsonString, 'utf-8');
        } else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file:`, fileError); return null; }
}

// --- CORRECTED Helper: Construct AI Prompt ---
const constructWhalePrompt = (summary, topNData, query) => {
    // Use backticks (`) for the entire template literal
    let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).\nUser Query: "<span class="math-inline">\{query\}"\\nFilter Applied\: "</span>{summary.filter || 'N/A'}"\n\n== Overall Summary (Based on ALL ${summary.totalTxCount} matching transactions) ==\nTotal Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2})} BTC\n`;
    if (summary.minBlock && summary.maxBlock) prompt += `Block Range: ${summary.minBlock} - ${summary.maxBlock}\n`;
    // Add other relevant summary fields here if they exist in the summary object
    prompt += `---\n\nBelow are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):\n`;
    // Use correct backticks for code block fence
    prompt += "```json\n";
    const processedData = topNData.map(doc => {
        const newDoc = { // Create clean object for AI
             txHash: doc.txHash,
             timestamp: null, // Will be filled below
             block: doc.block?.$numberInt || doc.block,
             valueBTC: parseFloat((Number(doc.value?.$numberLong || doc.value?.$numberInt || doc.value || 0) / 1e8).toFixed(4)),
             // Corrected label access - uses labels already added in mongoHelper
             from: doc.from?.map((addr, i) => `${addr}${doc.fromLabels?.[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [],
             to: doc.to?.map((addr, i) => `${addr}${doc.toLabels?.[i] ? ` (${doc.toLabels[i]})` : ''}`) || []
         };
         // Derive timestamp safely
         if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
        return newDoc;
    });
    // Safely stringify the processed data
    try {
        prompt += JSON.stringify(processedData, null, 2);
    } catch (stringifyError) {
         console.error("[constructWhalePrompt] Error stringifying processedData:", stringifyError);
         prompt += `[Error processing transaction details: ${stringifyError.message}]`; // Add error note instead of JSON
     }
    // Use correct backticks for code block fence
    prompt += "\n```\n\n";
    // Use backticks for the final instruction block
    prompt += `Analysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions:
1. Comment on overall activity (volume, tx count, block range).
2. Highlight significant transactions from the Top ${topNData.length} list, mentioning labels/exchanges. Note the largest ones by value.
3. If user query implies interest in price, comment cautiously on potential implications of overall volume/flows.
4. **Be concise: Keep response under ~450 tokens.**
5. Mention txHashes (e.g., \`abc...xyz\`). **DO NOT format as markdown links.**`; // End instruction block with backtick
    return prompt;
};


// --- Main Handler Function ---
async function handleWhaleCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Use \`!whale <query>\` e.g., \`!whale last hour\``); return; }

    console.log(`[WhaleWatcher] Query: "${userQuery}"`);
    let thinkingMessage = null;
    let fullResponseText = ""; // Declare high level
    let fileBuffer = null;
    let fileName = 'whale_transactions.csv';
    let plan = {}; // Keep for potential future use or error logging
    let finalPrompt = ""; // Declare high level

    try { // Outer try block covers everything
        thinkingMessage = await message.reply("🐳 Preparing whale report...");

        // --- Corrected Filter Determination Logic ---
        let mongoFilter = {};
        let filterDescription = ""; // Initialize blank
        const lowerCaseQuery = userQuery.toLowerCase().trim();

        const txHashMatch = lowerCaseQuery.match(/\b([a-fA-F0-9]{64})\b/);
        const blockRegex = /(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)/i;
        const blockMatch = lowerCaseQuery.match(blockRegex);
        const addressMatch = lowerCaseQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i);
        const valueMatch = lowerCaseQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i);
        const lastHourMatch = lowerCaseQuery.includes("last hour") || lowerCaseQuery.includes("past hour");
        const timeMatch = lowerCaseQuery.match(/today|yesterday|last day|last 24 hours|last month|last week|last\s+(\d+)\s+(hour|day|week|month)s?/);
        const latestMatch = lowerCaseQuery === 'latest' || lowerCaseQuery === 'latest transfers';

        // Apply Filters with Priority
        if (txHashMatch) {
            mongoFilter = { txHash: txHashMatch[0] }; filterDescription = `tx ${txHashMatch[0].substring(0,4)}...`;
        } else if (blockMatch) {
            try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; filterDescription=`block ${b}`; }} catch(e){ console.warn("Block parse error"); }
        } else if (lastHourMatch) {
             const now=new Date(); const s = Math.floor((now.getTime() - 60*60*1000)/1000);
             mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}}; filterDescription="last hour";
        } else if (latestMatch) { // <<< FIX: Handle "latest" explicitly
             const now = new Date(); const s = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000); // Default to last 24 hours
             mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } };
             filterDescription = "latest 24 hours";
        } else if (timeMatch) {
             const now = new Date(); let startSeconds; let endSeconds = null; const timeQuery=timeMatch[0];
             const numMatch = timeQuery.match(/last\s+(\d+)\s+(hour|day|week|month)/);
             if (numMatch) { const num=parseInt(numMatch[1]); const unit=numMatch[2]; if (!isNaN(num)) { let mult = unit==='hour'?3600000:unit==='day'?86400000:unit==='week'?604800000:unit==='month'?2592000000:0; startSeconds=Math.floor((now.getTime() - num*mult)/1000); filterDescription = `last ${num} ${unit}(s)`; } }
             else if (timeQuery.includes("today")) { const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); filterDescription = "today"; }
             else if (timeQuery.includes("yesterday")) { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; }
             else if (timeQuery.includes("last 24 hour")||timeQuery.includes("last day")) { startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); filterDescription="last 24 hours";}
             else if (timeQuery.includes("last week")||timeQuery.includes("last 7 day")) { startSeconds=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days";}
             else if (timeQuery.includes("last month")||timeQuery.includes("last 30 day")) { startSeconds=Math.floor((now.getTime()-30*24*60*60*1000)/1000); filterDescription="last 30 days";}
             if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; } else { mongoFilter={_id:{$gte:sO}}; } } else { console.warn("Could not parse time match:", timeQuery); /* Allow default */ }
        }
        // Apply address/value only if NO specific filter applied yet
        else if (addressMatch && Object.keys(mongoFilter).length === 0) {
             const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; filterDescription = `address ${a.substring(0,6)}...`;
        }
        else if (valueMatch && Object.keys(mongoFilter).length === 0) {
             try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break;case'<':mOp='$lt';break;case'>=':mOp='$gte';break;case'<=':mOp='$lte';break;default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; filterDescription=`value ${op} ${v}`; }} catch(e){}
        }

        // If filter is STILL empty, apply default time filter
        if (Object.keys(mongoFilter).length === 0) {
             const now = new Date(); const s = Math.floor((now.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000); // Default: last 3 days
             mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } };
             filterDescription = "latest activity (last 3 days)"; // Set description for default
             console.log(`[WhaleWatcher] No specific filter matched. Applied default: ${filterDescription}`);
        }
        // Ensure filterDescription has a value if mongoFilter was set by timeMatch but not other description logic
        filterDescription = filterDescription || "specified time range";
        console.log(`[WhaleWatcher] FINAL Filter Applied: ${filterDescription} - ${JSON.stringify(mongoFilter)}`);
        // --- End Filter Determination ---


        // --- Query MongoDB ---
        await thinkingMessage.edit(`🐳 Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
        let summaryData, topTransactions;
        try { const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI); summaryData = results.summary; topTransactions = results.topTransactions; summaryData.filter = filterDescription; if (!summaryData || topTransactions.length === 0) { await thinkingMessage.edit(`No whale data for: \`${filterDescription}\``); return; } console.log(`Received summary and top ${topTransactions.length} txs.`); }
        catch (error) { throw error; } // Rethrow DB errors

        // --- Generate File ---
        await thinkingMessage.edit("💾 Generating data file...");
        fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'latest'}_top${topTransactions.length}byValue.csv`;
        fileBuffer = generateTxFile(topTransactions, 'csv');

        // --- Construct Final AI Prompt ---
        finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery); // Use corrected function

        // --- Token Check with Logging & Validation ---
        let encoding;
        try {
            console.log("[WhaleWatcher] Constructing prompt for token check (first 100):", finalPrompt?.substring(0, 100));
            if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) {
                console.error("[WhaleWatcher] Invalid finalPrompt generated. Summary:", JSON.stringify(summaryData), "Top Txs Count:", topTransactions.length);
                throw new Error('Constructed final prompt is invalid or empty BEFORE encoding.');
            }
            encoding = get_encoding(TOKENIZER_ENCODING);
            let estimatedTokens = encoding.encode(finalPrompt).length;
            console.log(`[WhaleWatcher] Estimated prompt tokens (Summary + Top ${topTransactions.length}): ${estimatedTokens}`);
            if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (<span class="math-inline">\{estimatedTokens\}\) \> limit \(</span>{MAX_PROMPT_TOKENS}).`); }
            encoding.free();
        } catch (tokenError) {
            console.error("[WhaleWatcher] Token estimation error:", tokenError);
            console.error("[WhaleWatcher] Prompt causing token error (first 100 chars):", typeof finalPrompt === 'string' ? finalPrompt.substring(0,100) : finalPrompt); // Log prompt on error
            if(encoding) encoding.free();
            throw new Error("Error estimating AI tokens.");
        }
        // --- End Token Check ---

        // --- Get Response from AI (Streaming with added logs) ---
        await thinkingMessage.edit(`🐳 Analyzing summary & top ${topTransactions.length} txs...`);
        let stream = null;
        try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received. Processing chunks..."); }
        catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }

        let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let chunkCount = 0; let streamErrored = false;
        try { // Wrap stream processing
             for await (const chunk of stream) {
                  chunkCount++; const content = chunk.choices[0]?.delta?.content || '';
                  if (content) { console.log(`[WhaleWatcher] Stream Chunk ${chunkCount}...`); accumulatedChunk += content; }
                  const now = Date.now();
                  if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length > maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
                       fullResponseText += accumulatedChunk; accumulatedChunk = ""; const currentEditText = fullResponseText + "...";
                       if (currentEditText.length <= 2000) { console.log(`Editing msg (Len: ${currentEditText.length})...`); try { await thinkingMessage.edit(currentEditText); lastEditTime = now; } catch (e) { console.error("Stream edit error:", e.message); } }
                       else { console.warn("Truncating stream."); fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit({ content: fullResponseText }); } catch(e){} break; }
                  }
             } console.log(`[WhaleWatcher] Stream finished after ${chunkCount} chunks.`);
        } catch (streamError) { console.error("Error DURING AI stream:", streamError); streamErrored = true; fullResponseText = `AI analysis stream error: ${streamError.message}`; }
        if (!streamErrored) { fullResponseText += accumulatedChunk; }
        if (fullResponseText.length === 0 && !streamErrored) { fullResponseText = "AI analysis returned empty response."; }

        // --- Final Discord Message Update ---
        console.log("[WhaleWatcher] Preparing final message edit...");
        // Declare finalReplyOptions here, ensuring scope
        let finalReplyOptions = {};
        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate an analysis.";
        if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
        if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";
        finalReplyOptions.content = fullResponseText; // Assign content

        if (fileBuffer) {
            const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });
            finalReplyOptions.files = [attachment];
            finalReplyOptions.content += `\n\n*See attached \`${fileName}\` for Top ${topTransactions.length} transaction details (by value).*`;
        } else { finalReplyOptions.content += `\n\n*(Error generating detailed file)*`; }

        // Final check before editing
        console.log('[WhaleWatcher] DEBUG: Before final edit...'); console.log('[WhaleWatcher] DEBUG: typeof thinkingMessage:', typeof thinkingMessage); console.log('[WhaleWatcher] DEBUG: typeof finalReplyOptions:', typeof finalReplyOptions);
        if (!thinkingMessage) { console.error("Cannot perform final edit: thinkingMessage is null!"); await message.reply(finalReplyOptions); } // Fallback reply
        else if (typeof finalReplyOptions !== 'object' || finalReplyOptions === null) { console.error("Cannot perform final edit: finalReplyOptions is invalid!", finalReplyOptions); await thinkingMessage.edit("Internal error preparing reply."); }
        else { await thinkingMessage.edit(finalReplyOptions); console.log("[WhaleWatcher] Final message sent/edited."); }

    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error); const errorMsg = `Sorry, encountered an error: ${error.message}`; if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } } else { await message.reply(errorMsg); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };