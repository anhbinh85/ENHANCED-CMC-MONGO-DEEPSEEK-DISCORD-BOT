// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const mongoHelper = require('../services/mongoHelper'); // Correct path
// const aiHelper = require('../services/aiHelper'); // Correct path

// // --- Configuration ---
// const BTC_WHALE_COLLECTION = mongoHelper.WHALE_TRANSFERS_COLLECTION;
// const INITIAL_QUERY_LIMIT = 20; // Max records to fetch initially
// const REDUCED_QUERY_LIMIT = 10; // Reduce to this if prompt too long (Adjust!)
// const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "6000"); // Use variable from .env or default
// const TOKENIZER_ENCODING = 'cl100k_base';
// // --- WARNING --- Consider reducing limits or summarizing data ---

// // --- UPDATED Helper to construct prompt for whale watching ---
// const constructWhalePrompt = (dataToUse, sortUsed, query) => {
//     let prompt = `You are an AI assistant analyzing a database of large Bitcoin (BTC) transactions (>1 BTC) from the '${BTC_WHALE_COLLECTION}' collection.\n`;
//     // Ensure txHash is mentioned in the description
//     prompt += `Database records include fields like 'block', 'timestamp' (ISO 8601 derived from record ID), 'from' (array), 'to' (array), 'txHash' (the unique transaction hash/ID), 'value' (in satoshis).\n\n`;
//     prompt += `User's question: "${query}"\n\n`;
//     prompt += `I found the following relevant data (${dataToUse.length} records, sorted ${sortUsed ? JSON.stringify(sortUsed) : 'by time descending'}):\n`; // Clarify default sort
//     prompt += "```json\n";
//     const processedData = dataToUse.map(doc => {
//         const newDoc = { ...doc };
//         // Derive timestamp
//         if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
//         // Format numbers
//         if (newDoc.value && typeof newDoc.value === 'object') newDoc.value = parseInt(newDoc.value.$numberInt || newDoc.value.$numberLong || newDoc.value);
//         if (newDoc.block && typeof newDoc.block === 'object') newDoc.block = parseInt(newDoc.block.$numberInt || newDoc.block.$numberLong || newDoc.block);
//         // Keep txHash, remove _id
//         delete newDoc._id;
//         return newDoc;
//     });
//     prompt += JSON.stringify(processedData, null, 2);
//     prompt += "\n```\n\n";
//     // --- ADDED INSTRUCTION FOR LINKING ---
//     prompt += `Based *only* on the provided data, answer the user's query concisely. If data doesn't contain the answer, state that clearly. Values are in satoshis unless asked to convert. Use derived timestamp if relevant.
// IMPORTANT: When you mention a specific transaction from the provided data, **include its 'txHash' formatted as a clickable Markdown link** using the pattern: \`[<first 8 chars>...<last 8 chars>](https://www.blockchain.com/btc/tx/<full_txHash>)\`.
// Example: For txHash '06671caf783048dcaa80c32db04b599c6d6720b4325c8cc3bbfcf2fc89791bf6', format it as \`[06671caf...89791bf6](https://www.blockchain.com/btc/tx/06671caf783048dcaa80c32db04b599c6d6720b4325c8cc3bbfcf2fc89791bf6)\`. Only do this for hashes present in the JSON data above.`;
//     // --- END ADDED INSTRUCTION ---
//     return prompt;
// };

// // Main handler function for !whale commands
// async function handleWhaleCommand(message, userQuery) {
//     if (!userQuery) { message.reply(`Please provide a question after \`!whale\`!`); return; }

//     console.log(`[WhaleWatcher] Query: "${userQuery}"`);
//     await message.channel.sendTyping();

//     let mongoFilter = {};
//     let mongoSort = { _id: -1 }; // Default sort: newest first (already descending)
//     let limit = INITIAL_QUERY_LIMIT;
//     let specificQueryType = null;
//     let initialDataFetchLimit = INITIAL_QUERY_LIMIT;

//     // --- Keyword/Pattern Matching (No changes needed here for sorting) ---
//     // (Same logic as before)
//     const lowerCaseQuery = userQuery.toLowerCase(); const txHashMatch = userQuery.match(/\b([a-fA-F0-9]{64})\b/); const blockMatch = userQuery.match(/(?:block|block number)\s+(\d+)/i); const addressMatch = userQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i); const valueMatch = userQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i); const timeMatch = lowerCaseQuery.match(/today|yesterday|last hour|last day|last 24 hours/);
//     if (txHashMatch) { mongoFilter = { txHash: txHashMatch[0] }; mongoSort = null; limit = 1; initialDataFetchLimit = 1; specificQueryType = "Tx Hash"; }
//     else if (blockMatch) { try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; mongoSort={_id:-1}; specificQueryType="Block"; }} catch(e){} }
//     else if (addressMatch) { const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; mongoSort = { _id: -1 }; specificQueryType = "Address"; }
//     else if (valueMatch) { try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break; case'<':mOp='$lt';break; case'>=':mOp='$gte';break; case'<=':mOp='$lte';break; default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; mongoSort={value:-1}; specificQueryType="Value"; }} catch(e){} }
//     else if (timeMatch) { const now=new Date(); let startSeconds, endSeconds=null; if(lowerCaseQuery.includes("today")){ const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); } else if(lowerCaseQuery.includes("yesterday")){ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); } else if(lowerCaseQuery.includes("last hour")){ startSeconds=Math.floor((now.getTime()-60*60*1000)/1000); } else if(lowerCaseQuery.includes("last day")||lowerCaseQuery.includes("last 24 hours")){ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); } if(startSeconds!==undefined){ const startObjId=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const endObjId=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:startObjId, $lte:endObjId}}; } else { mongoFilter={_id:{$gte:startObjId}}; } mongoSort={_id:-1}; specificQueryType="Time"; console.log(`Time Query Filter: ${JSON.stringify(mongoFilter)}`); } }
//     else { console.log(`General query - fetching recent ${INITIAL_QUERY_LIMIT} by ObjectId (desc).`); mongoFilter={}; mongoSort={_id:-1}; limit=INITIAL_QUERY_LIMIT; }


//     // --- Query MongoDB ---
//     let dbData = null;
//     try {
//         // Query already includes mongoSort = { _id: -1 } for descending time
//         dbData = await mongoHelper.queryCollection(BTC_WHALE_COLLECTION, mongoFilter, initialDataFetchLimit, mongoSort);
//         if (!dbData || dbData.length === 0) { message.reply(`I found no whale transaction data matching: ${userQuery}`); return; }
//         console.log(`[WhaleWatcher] Fetched ${dbData.length} records (sorted: ${JSON.stringify(mongoSort)}).`); // Log sort used
//     } catch (error) { console.error("[WhaleWatcher] DB query error:", error); message.reply("Sorry, DB error occurred while fetching whale data."); return; }

//     // --- Construct Prompt & Check Tokens ---
//     let finalDbDataUsed = dbData;
//     let finalPrompt = "";
//     // Pass the sort object to the prompt constructor for context
//     let currentPrompt = constructWhalePrompt(finalDbDataUsed, mongoSort, userQuery);
//     let encoding;
//     try {
//         // Token Estimation & Reduction Logic (same as before)
//         encoding = get_encoding(TOKENIZER_ENCODING);
//         let estimatedTokens = encoding.encode(currentPrompt).length;
//         console.log(`[WhaleWatcher] Initial prompt tokens: ${estimatedTokens}`);
//         if (estimatedTokens > MAX_PROMPT_TOKENS) {
//             console.warn(`[WhaleWatcher] Token estimate exceeds limit. Reducing to ${REDUCED_QUERY_LIMIT}`);
//             if (initialDataFetchLimit > REDUCED_QUERY_LIMIT && dbData.length > REDUCED_QUERY_LIMIT) { finalDbDataUsed = dbData.slice(0, REDUCED_QUERY_LIMIT); }
//             else { finalDbDataUsed = dbData; }
//             currentPrompt = constructWhalePrompt(finalDbDataUsed, mongoSort, userQuery); // Rebuild prompt
//             estimatedTokens = encoding.encode(currentPrompt).length;
//             console.log(`[WhaleWatcher] Reduced prompt tokens: ${estimatedTokens}`);
//             currentPrompt += "\n\n(Note: Data shortened due to length limits.)";
//         }
//         encoding.free();
//         finalPrompt = currentPrompt;
//     } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); message.reply("Error preparing AI request."); if (encoding) encoding.free(); return; }

//     // --- Get Response from AI (Streaming) ---
//     let thinkingMessage = null;
//     try {
//         thinkingMessage = await message.reply("🐳 Analyzing whale data...");
//         const stream = await aiHelper.getAIStream(finalPrompt); // Use AI helper

//         // (Streaming logic - message editing - identical)
//         let fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0;
//         const minEditInterval = 1500; const maxAccumulatedLength = 100;
//         for await (const chunk of stream) { /* ... process chunk, check length, edit message ... */
//              const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit(fullResponseText); } catch(e){} break; } try { await thinkingMessage.edit(fullResponseText + "..."); lastEditTime = now; } catch (editError) { console.error("Discord edit error:", editError.message); }}
//         }
//         fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI gave empty response."; if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
//         try { await thinkingMessage.edit(fullResponseText); } catch (editError) { console.error("Discord final edit error:", editError.message); }

//     } catch (error) { // Catch errors from getAIStream or stream processing
//         console.error("[WhaleWatcher] AI stream processing error:", error);
//         const errorMsg = `Sorry, AI error processing whale data: ${error.message}`;
//         if (thinkingMessage) { try { await thinkingMessage.edit(errorMsg); } catch (e) { message.reply(errorMsg); } } else { message.reply(errorMsg); }
//     }
// }

// module.exports = { handleWhaleCommand };

// commands/whaleWatcher.js
const { ObjectId } = require('mongodb');
const { get_encoding } = require('tiktoken');
const mongoHelper = require('../services/mongoHelper');
const aiHelper = require('../services/aiHelper');

// --- Configuration ---
const BTC_WHALE_COLLECTION = mongoHelper.WHALE_TRANSFERS_COLLECTION;
// Fetch a larger batch initially to get a good sample for value sorting
const INITIAL_FETCH_LIMIT = 100; // Fetch up to 100 txs matching filter (sorted by time)
const FINAL_DATA_LIMIT = 10; // Send only the Top 10 (by value) to the AI
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "10000"); // Allow slightly larger prompt for Top 10 maybe
const TOKENIZER_ENCODING = 'cl100k_base';

// --- UPDATED Helper to construct prompt for whale watching ---
// Now explains data is Top 10 by Value within the filter
const constructWhalePrompt = (dataToUse, filterDescription, query) => {
    let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC) from the '${BTC_WHALE_COLLECTION}' collection.\n`;
    prompt += `Database records include 'block', 'timestamp' (ISO 8601 derived), 'from' (array), 'to' (array), 'txHash', 'value' (in satoshis).\n\n`;
    prompt += `User's question: "${query}"\n\n`;
    // Describe the data provided
    prompt += `Below are the Top ${dataToUse.length} transactions matching the criteria "${filterDescription}", sorted descending by BTC value (highest value first):\n`;
    prompt += "```json\n";
    const processedData = dataToUse.map(doc => {
        const newDoc = { ...doc };
        if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
        // Ensure value is a number for AI processing
        newDoc.value = (doc.value && typeof doc.value === 'object') ? parseInt(doc.value.$numberInt || doc.value.$numberLong || doc.value) : doc.value;
        if (newDoc.block && typeof newDoc.block === 'object') newDoc.block = parseInt(newDoc.block.$numberInt || newDoc.block.$numberLong || newDoc.block);
        delete newDoc._id; // Remove internal ID
        return newDoc; // Return processed doc WITH txHash
    });
    prompt += JSON.stringify(processedData, null, 2);
    prompt += "\n```\n\n";
    // Update instructions
    prompt += `Based *only* on the provided Top ${dataToUse.length} transactions (sorted by value DESC), answer the user's query.
**Be concise and keep your response well under 2000 characters (aim for ~450 output tokens maximum).**
Summarize findings. Do not just list all transactions unless asked.
IMPORTANT: When mentioning specific transactions, include the 'txHash' in full text `;
    return prompt;
};

// --- Main Handler Function ---
async function handleWhaleCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Please provide a question after \`!whale\`!`); return; }

    console.log(`[WhaleWatcher] Query: "${userQuery}"`);
    await message.channel.sendTyping();

    let mongoFilter = {};
    let mongoSort = { _id: -1 }; // Initial sort by time (newest first) to get relevant window
    let limit = INITIAL_FETCH_LIMIT; // Fetch initial larger batch
    let filterDescription = "latest activity"; // For prompt context

    // --- Updated Keyword/Pattern Matching ---
    const lowerCaseQuery = userQuery.toLowerCase();
    const txHashMatch = userQuery.match(/\b([a-fA-F0-9]{64})\b/);
    const blockMatch = userQuery.match(/(?:block|in block)\s+(\d+)/i); // Match "in block" too
    const addressMatch = userQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i);
    const valueMatch = userQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i);
    // Prioritize specific time filters
    const lastHourMatch = lowerCaseQuery.includes("last hour") || lowerCaseQuery.includes("past hour");
    const timeMatch = lowerCaseQuery.match(/today|yesterday|last day|last 24 hours/);


    if (txHashMatch) {
        mongoFilter = { txHash: txHashMatch[0] }; mongoSort = null; limit = 1; filterDescription = `transaction ${txHashMatch[0].substring(0,8)}...`;
    } else if (blockMatch) {
        try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; mongoSort={_id:-1}; /* Sort by time within block */ filterDescription=`block ${b}`; }} catch(e){}
    } else if (lastHourMatch) { // Handle "last hour" specifically
         const now = new Date();
         const startSeconds = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000);
         const startObjectId = ObjectId.createFromTime(startSeconds);
         mongoFilter = { _id: { $gte: startObjectId } };
         mongoSort = { _id: -1 }; // Still get latest first within hour
         filterDescription = "last hour";
         console.log(`Time Query Filter (Last Hour): ${JSON.stringify(mongoFilter)}`);
    } else if (addressMatch) {
        const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; mongoSort = { _id: -1 }; filterDescription = `address ${a.substring(0,6)}...`;
    } else if (valueMatch) {
        try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break; case'<':mOp='$lt';break; case'>=':mOp='$gte';break; case'<=':mOp='$lte';break; default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; mongoSort={value:-1}; /* Override sort for value queries */ filterDescription=`value ${op} ${v}`; }} catch(e){}
    } else if (timeMatch) { // Handle other timeframes (today, yesterday...)
          const now=new Date(); let startSeconds, endSeconds=null;
          if(lowerCaseQuery.includes("today")){ const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); filterDescription = "today"; }
          else if(lowerCaseQuery.includes("yesterday")){ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; }
          else if(lowerCaseQuery.includes("last day")||lowerCaseQuery.includes("last 24 hours")){ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); filterDescription = "last 24 hours"; }
          if(startSeconds!==undefined){ const startObjId=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const endObjId=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:startObjId, $lte:endObjId}}; } else { mongoFilter={_id:{$gte:startObjId}}; } mongoSort={_id:-1}; console.log(`Time Query Filter: ${JSON.stringify(mongoFilter)}`); }
     }
     else { // General query
        console.log(`General query - fetching recent ${INITIAL_FETCH_LIMIT} by time for value sorting.`);
        mongoFilter={}; mongoSort={_id:-1}; limit=INITIAL_FETCH_LIMIT; filterDescription="latest activity";
    }


    // --- Query MongoDB ---
    let dbData = null;
    try {
        // Fetch initial batch (e.g., up to 100) sorted by time/ID as default
        dbData = await mongoHelper.queryCollection(BTC_WHALE_COLLECTION, mongoFilter, limit, mongoSort);
        if (!dbData || dbData.length === 0) { message.reply(`I found no whale transaction data matching: ${userQuery}`); return; }
        console.log(`[WhaleWatcher] Fetched ${dbData.length} records initially (Sort: ${JSON.stringify(mongoSort)}).`);
    } catch (error) { console.error("[WhaleWatcher] DB query error:", error); message.reply("Sorry, DB error occurred while fetching whale data."); return; }

    // --- Feature: Sort Fetched Data by Value Descending ---
    console.log(`[WhaleWatcher] Sorting ${dbData.length} records by value descending...`);
    dbData.sort((a, b) => {
        // Handle potential BSON number types robustly
        const valA = Number(a.value?.$numberLong || a.value?.$numberInt || a.value || 0);
        const valB = Number(b.value?.$numberLong || b.value?.$numberInt || b.value || 0);
        return valB - valA; // Descending sort (b - a)
    });

    // --- Feature: Take Top 10 ---
    const finalDbDataUsed = dbData.slice(0, FINAL_DATA_LIMIT); // Take top 10 (or fewer if less fetched)
    console.log(`[WhaleWatcher] Using top ${finalDbDataUsed.length} records sorted by value for AI prompt.`);


    // --- Construct Prompt & Check Tokens ---
    let finalPrompt = "";
    // Pass description of filter, not the mongoSort object used for fetching
    let currentPrompt = constructWhalePrompt(finalDbDataUsed, filterDescription, userQuery);
    let encoding;
    try {
        // Token Estimation (Still useful as a check even with only 10 records)
        encoding = get_encoding(TOKENIZER_ENCODING);
        let estimatedTokens = encoding.encode(currentPrompt).length;
        console.log(`[WhaleWatcher] Estimated prompt tokens for Top ${FINAL_DATA_LIMIT}: ${estimatedTokens}`);
        if (estimatedTokens > MAX_PROMPT_TOKENS) {
            // This is less likely with only 10 records, but keep check
            console.warn(`[WhaleWatcher] Token estimate (${estimatedTokens}) STILL exceeds limit (${MAX_PROMPT_TOKENS}) even with Top ${FINAL_DATA_LIMIT}! Prompt may be truncated by API.`);
            // Cannot reduce further easily, maybe add note to prompt?
            // currentPrompt += "\n\n(Note: Data provided is Top 10 by value, but prompt is very large.)";
        }
        encoding.free();
        finalPrompt = currentPrompt;
    } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); message.reply("Error preparing AI request."); if (encoding) encoding.free(); return; }

    // --- Get Response from AI (Streaming) ---
    let thinkingMessage = null;
    try {
        thinkingMessage = await message.reply(`🐳 Analyzing Top ${finalDbDataUsed.length} whale transactions (by value)...`);
        const stream = await aiHelper.getAIStream(finalPrompt); // Use AI helper (DeepSeek)

        // (Streaming logic - updates message - identical)
        let fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; for await (const chunk of stream) { const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit(fullResponseText); } catch(e){} break; } try { await thinkingMessage.edit(fullResponseText + "..."); lastEditTime = now; } catch (editError) { console.error("Discord edit error:", editError.message); }} } fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI gave empty response."; if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000); try { await thinkingMessage.edit(fullResponseText); } catch (editError) { console.error("Discord final edit error:", editError.message); }

    } catch (error) { // Catch errors from getAIStream or stream processing
        console.error("[WhaleWatcher] AI stream processing error:", error); const errorMsg = `Sorry, AI error processing whale data: ${error.message}`; if (thinkingMessage) { try { await thinkingMessage.edit(errorMsg); } catch (e) { message.reply(errorMsg); } } else { message.reply(errorMsg); }
    }
}

module.exports = { handleWhaleCommand };