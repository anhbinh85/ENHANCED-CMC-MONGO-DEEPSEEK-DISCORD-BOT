// // commands/whaleWatcher.js
// const { ObjectId } = require('mongodb');
// const { get_encoding } = require('tiktoken');
// const mongoHelper = require('../services/mongoHelper'); // Correct path
// const aiHelper = require('../services/aiHelper'); // Correct path

// // --- Configuration (can be moved to central config.js later) ---
// const BTC_WHALE_COLLECTION = mongoHelper.WHALE_TRANSFERS_COLLECTION;
// const INITIAL_QUERY_LIMIT = 50; // Max records to fetch for context
// const REDUCED_QUERY_LIMIT = 10; // Reduce to this if prompt is too long (Adjust!)
// const MAX_PROMPT_TOKENS = 6000; // Max tokens for AI prompt (Adjust!)
// const TOKENIZER_ENCODING = 'cl100k_base';
// // --- WARNING --- Keep limit low or implement summarization ---

// // Helper to construct prompt for whale watching
// const constructWhalePrompt = (dataToUse, sortUsed, query) => {
//     let prompt = `You are an AI assistant analyzing a database of large Bitcoin (BTC) transactions (>1 BTC) from the '${BTC_WHALE_COLLECTION}' collection.\n`;
//     prompt += `Database records include fields like 'block', 'timestamp' (ISO 8601 derived from record ID), 'from' (array), 'to' (array), 'txHash', 'value' (in satoshis).\n\n`;
//     prompt += `User's question: "${query}"\n\n`;
//     prompt += `I found the following relevant data (${dataToUse.length} records, sorted ${sortUsed ? JSON.stringify(sortUsed) : 'default'}):\n`;
//     prompt += "```json\n";
//     const processedData = dataToUse.map(doc => {
//         const newDoc = { ...doc };
//         if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
//         if (newDoc.value && typeof newDoc.value === 'object') newDoc.value = parseInt(newDoc.value.$numberInt || newDoc.value.$numberLong || newDoc.value);
//         if (newDoc.block && typeof newDoc.block === 'object') newDoc.block = parseInt(newDoc.block.$numberInt || newDoc.block.$numberLong || newDoc.block);
//         delete newDoc._id; return newDoc;
//     });
//     prompt += JSON.stringify(processedData, null, 2);
//     prompt += "\n```\n\n";
//     prompt += `Based *only* on the provided data, answer the user's query concisely. If data doesn't contain the answer, state that clearly. Values are in satoshis unless asked to convert. Use derived timestamp if relevant.`;
//     return prompt;
// };

// // Main handler function for !whale commands
// async function handleWhaleCommand(message, userQuery) {
//     if (!userQuery) {
//         message.reply(`Please provide a question after \`!whale\`! Example: \`!whale latest transfers\``);
//         return;
//     }

//     console.log(`[WhaleWatcher] Query: "${userQuery}"`);
//     await message.channel.sendTyping();

//     let mongoFilter = {};
//     let mongoSort = { _id: -1 }; // Default sort by ObjectId (time)
//     let limit = INITIAL_QUERY_LIMIT;
//     let specificQueryType = null;
//     let initialDataFetchLimit = INITIAL_QUERY_LIMIT;

//     // --- Keyword/Pattern Matching ---
//     // (Same logic as before to set filter, sort, limit based on query)
//      const lowerCaseQuery = userQuery.toLowerCase();
//      const txHashMatch = userQuery.match(/\b([a-fA-F0-9]{64})\b/);
//      const blockMatch = userQuery.match(/(?:block|block number)\s+(\d+)/i);
//      const addressMatch = userQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i);
//      const valueMatch = userQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i);
//      const timeMatch = lowerCaseQuery.match(/today|yesterday|last hour|last day|last 24 hours/);

//      if (txHashMatch) { mongoFilter = { txHash: txHashMatch[0] }; mongoSort = null; limit = 1; initialDataFetchLimit = 1; specificQueryType = "Tx Hash"; }
//      else if (blockMatch) { try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; mongoSort={_id:-1}; specificQueryType="Block"; }} catch(e){} }
//      else if (addressMatch) { const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; mongoSort = { _id: -1 }; specificQueryType = "Address"; }
//      else if (valueMatch) { try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break; case'<':mOp='$lt';break; case'>=':mOp='$gte';break; case'<=':mOp='$lte';break; default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; mongoSort={value:-1}; specificQueryType="Value"; }} catch(e){} }
//      else if (timeMatch) {
//          // Time Filter Logic using ObjectId (same as previous)
//           const now=new Date(); let startSeconds, endSeconds=null;
//           if(lowerCaseQuery.includes("today")){ const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); }
//           else if(lowerCaseQuery.includes("yesterday")){ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); }
//           else if(lowerCaseQuery.includes("last hour")){ startSeconds=Math.floor((now.getTime()-60*60*1000)/1000); }
//           else if(lowerCaseQuery.includes("last day")||lowerCaseQuery.includes("last 24 hours")){ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); }
//           if(startSeconds!==undefined){ const startObjId=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const endObjId=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:startObjId, $lte:endObjId}}; } else { mongoFilter={_id:{$gte:startObjId}}; } mongoSort={_id:-1}; specificQueryType="Time"; console.log(`Time Query Filter: ${JSON.stringify(mongoFilter)}`); }
//      }
//      else { console.log(`General query - fetching recent ${INITIAL_QUERY_LIMIT} by ObjectId.`); mongoFilter={}; mongoSort={_id:-1}; limit=INITIAL_QUERY_LIMIT; }


//     // --- Query MongoDB ---
//     let dbData = null;
//     try {
//         dbData = await mongoHelper.queryCollection(BTC_WHALE_COLLECTION, mongoFilter, initialDataFetchLimit, mongoSort);
//         if (!dbData || dbData.length === 0) { message.reply(`I found no whale transaction data matching: ${userQuery}`); return; }
//         console.log(`[WhaleWatcher] Fetched ${dbData.length} records.`);
//     } catch (error) { console.error("[WhaleWatcher] DB query error:", error); message.reply("Sorry, DB error occurred while fetching whale data."); return; }

//     // --- Construct Prompt & Check Tokens ---
//     let finalDbDataUsed = dbData;
//     let finalPrompt = "";
//     let currentPrompt = constructWhalePrompt(finalDbDataUsed, mongoSort, userQuery); // Use helper
//     let encoding;
//     try {
//         // Token Estimation & Reduction Logic (same as before)
//         encoding = get_encoding(TOKENIZER_ENCODING);
//         let estimatedTokens = encoding.encode(currentPrompt).length;
//         console.log(`[WhaleWatcher] Initial prompt tokens: ${estimatedTokens}`);
//         if (estimatedTokens > MAX_PROMPT_TOKENS) {
//             console.warn(`[WhaleWatcher] Token estimate exceeds limit. Reducing to ${REDUCED_QUERY_LIMIT}`);
//             if (initialDataFetchLimit > REDUCED_QUERY_LIMIT && dbData.length > REDUCED_QUERY_LIMIT) { finalDbDataUsed = dbData.slice(0, REDUCED_QUERY_LIMIT); }
//             else { finalDbDataUsed = dbData; } // Use all if less than reduced limit already
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
//         thinkingMessage = await message.reply("🐳 Analyzing whale data..."); // Whale specific placeholder
//         const stream = await aiHelper.getAIStream(finalPrompt); // Use AI helper

//         // (Streaming logic - message editing - identical to previous main.js version)
//         let fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0;
//         const minEditInterval = 1500; const maxAccumulatedLength = 100;
//         for await (const chunk of stream) { /* ... process chunk, check length, edit message ... */
//              const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now();
//              if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit(fullResponseText); } catch(e){} break; } try { await thinkingMessage.edit(fullResponseText + "..."); lastEditTime = now; } catch (editError) { console.error("Discord edit error:", editError.message); }}
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
const mongoHelper = require('../services/mongoHelper'); // Correct path
const aiHelper = require('../services/aiHelper'); // Correct path

// --- Configuration ---
const BTC_WHALE_COLLECTION = mongoHelper.WHALE_TRANSFERS_COLLECTION;
const INITIAL_QUERY_LIMIT = 20; // Max records to fetch initially
const REDUCED_QUERY_LIMIT = 10; // Reduce to this if prompt too long (Adjust!)
const MAX_PROMPT_TOKENS = parseInt(process.env.MAX_PROMPT_TOKENS || "6000"); // Use variable from .env or default
const TOKENIZER_ENCODING = 'cl100k_base';
// --- WARNING --- Consider reducing limits or summarizing data ---

// --- UPDATED Helper to construct prompt for whale watching ---
const constructWhalePrompt = (dataToUse, sortUsed, query) => {
    let prompt = `You are an AI assistant analyzing a database of large Bitcoin (BTC) transactions (>1 BTC) from the '${BTC_WHALE_COLLECTION}' collection.\n`;
    // Ensure txHash is mentioned in the description
    prompt += `Database records include fields like 'block', 'timestamp' (ISO 8601 derived from record ID), 'from' (array), 'to' (array), 'txHash' (the unique transaction hash/ID), 'value' (in satoshis).\n\n`;
    prompt += `User's question: "${query}"\n\n`;
    prompt += `I found the following relevant data (${dataToUse.length} records, sorted ${sortUsed ? JSON.stringify(sortUsed) : 'by time descending'}):\n`; // Clarify default sort
    prompt += "```json\n";
    const processedData = dataToUse.map(doc => {
        const newDoc = { ...doc };
        // Derive timestamp
        if (doc._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
        // Format numbers
        if (newDoc.value && typeof newDoc.value === 'object') newDoc.value = parseInt(newDoc.value.$numberInt || newDoc.value.$numberLong || newDoc.value);
        if (newDoc.block && typeof newDoc.block === 'object') newDoc.block = parseInt(newDoc.block.$numberInt || newDoc.block.$numberLong || newDoc.block);
        // Keep txHash, remove _id
        delete newDoc._id;
        return newDoc;
    });
    prompt += JSON.stringify(processedData, null, 2);
    prompt += "\n```\n\n";
    // --- ADDED INSTRUCTION FOR LINKING ---
    prompt += `Based *only* on the provided data, answer the user's query concisely. If data doesn't contain the answer, state that clearly. Values are in satoshis unless asked to convert. Use derived timestamp if relevant.
IMPORTANT: When you mention a specific transaction from the provided data, **include its 'txHash' formatted as a clickable Markdown link** using the pattern: \`[<first 8 chars>...<last 8 chars>](https://www.blockchain.com/btc/tx/<full_txHash>)\`.
Example: For txHash '06671caf783048dcaa80c32db04b599c6d6720b4325c8cc3bbfcf2fc89791bf6', format it as \`[06671caf...89791bf6](https://www.blockchain.com/btc/tx/06671caf783048dcaa80c32db04b599c6d6720b4325c8cc3bbfcf2fc89791bf6)\`. Only do this for hashes present in the JSON data above.`;
    // --- END ADDED INSTRUCTION ---
    return prompt;
};

// Main handler function for !whale commands
async function handleWhaleCommand(message, userQuery) {
    if (!userQuery) { message.reply(`Please provide a question after \`!whale\`!`); return; }

    console.log(`[WhaleWatcher] Query: "${userQuery}"`);
    await message.channel.sendTyping();

    let mongoFilter = {};
    let mongoSort = { _id: -1 }; // Default sort: newest first (already descending)
    let limit = INITIAL_QUERY_LIMIT;
    let specificQueryType = null;
    let initialDataFetchLimit = INITIAL_QUERY_LIMIT;

    // --- Keyword/Pattern Matching (No changes needed here for sorting) ---
    // (Same logic as before)
    const lowerCaseQuery = userQuery.toLowerCase(); const txHashMatch = userQuery.match(/\b([a-fA-F0-9]{64})\b/); const blockMatch = userQuery.match(/(?:block|block number)\s+(\d+)/i); const addressMatch = userQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i); const valueMatch = userQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i); const timeMatch = lowerCaseQuery.match(/today|yesterday|last hour|last day|last 24 hours/);
    if (txHashMatch) { mongoFilter = { txHash: txHashMatch[0] }; mongoSort = null; limit = 1; initialDataFetchLimit = 1; specificQueryType = "Tx Hash"; }
    else if (blockMatch) { try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; mongoSort={_id:-1}; specificQueryType="Block"; }} catch(e){} }
    else if (addressMatch) { const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; mongoSort = { _id: -1 }; specificQueryType = "Address"; }
    else if (valueMatch) { try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break; case'<':mOp='$lt';break; case'>=':mOp='$gte';break; case'<=':mOp='$lte';break; default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; mongoSort={value:-1}; specificQueryType="Value"; }} catch(e){} }
    else if (timeMatch) { const now=new Date(); let startSeconds, endSeconds=null; if(lowerCaseQuery.includes("today")){ const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); } else if(lowerCaseQuery.includes("yesterday")){ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); } else if(lowerCaseQuery.includes("last hour")){ startSeconds=Math.floor((now.getTime()-60*60*1000)/1000); } else if(lowerCaseQuery.includes("last day")||lowerCaseQuery.includes("last 24 hours")){ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); } if(startSeconds!==undefined){ const startObjId=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const endObjId=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:startObjId, $lte:endObjId}}; } else { mongoFilter={_id:{$gte:startObjId}}; } mongoSort={_id:-1}; specificQueryType="Time"; console.log(`Time Query Filter: ${JSON.stringify(mongoFilter)}`); } }
    else { console.log(`General query - fetching recent ${INITIAL_QUERY_LIMIT} by ObjectId (desc).`); mongoFilter={}; mongoSort={_id:-1}; limit=INITIAL_QUERY_LIMIT; }


    // --- Query MongoDB ---
    let dbData = null;
    try {
        // Query already includes mongoSort = { _id: -1 } for descending time
        dbData = await mongoHelper.queryCollection(BTC_WHALE_COLLECTION, mongoFilter, initialDataFetchLimit, mongoSort);
        if (!dbData || dbData.length === 0) { message.reply(`I found no whale transaction data matching: ${userQuery}`); return; }
        console.log(`[WhaleWatcher] Fetched ${dbData.length} records (sorted: ${JSON.stringify(mongoSort)}).`); // Log sort used
    } catch (error) { console.error("[WhaleWatcher] DB query error:", error); message.reply("Sorry, DB error occurred while fetching whale data."); return; }

    // --- Construct Prompt & Check Tokens ---
    let finalDbDataUsed = dbData;
    let finalPrompt = "";
    // Pass the sort object to the prompt constructor for context
    let currentPrompt = constructWhalePrompt(finalDbDataUsed, mongoSort, userQuery);
    let encoding;
    try {
        // Token Estimation & Reduction Logic (same as before)
        encoding = get_encoding(TOKENIZER_ENCODING);
        let estimatedTokens = encoding.encode(currentPrompt).length;
        console.log(`[WhaleWatcher] Initial prompt tokens: ${estimatedTokens}`);
        if (estimatedTokens > MAX_PROMPT_TOKENS) {
            console.warn(`[WhaleWatcher] Token estimate exceeds limit. Reducing to ${REDUCED_QUERY_LIMIT}`);
            if (initialDataFetchLimit > REDUCED_QUERY_LIMIT && dbData.length > REDUCED_QUERY_LIMIT) { finalDbDataUsed = dbData.slice(0, REDUCED_QUERY_LIMIT); }
            else { finalDbDataUsed = dbData; }
            currentPrompt = constructWhalePrompt(finalDbDataUsed, mongoSort, userQuery); // Rebuild prompt
            estimatedTokens = encoding.encode(currentPrompt).length;
            console.log(`[WhaleWatcher] Reduced prompt tokens: ${estimatedTokens}`);
            currentPrompt += "\n\n(Note: Data shortened due to length limits.)";
        }
        encoding.free();
        finalPrompt = currentPrompt;
    } catch (tokenError) { console.error("[WhaleWatcher] Token estimation error:", tokenError); message.reply("Error preparing AI request."); if (encoding) encoding.free(); return; }

    // --- Get Response from AI (Streaming) ---
    let thinkingMessage = null;
    try {
        thinkingMessage = await message.reply("🐳 Analyzing whale data...");
        const stream = await aiHelper.getAIStream(finalPrompt); // Use AI helper

        // (Streaming logic - message editing - identical)
        let fullResponseText = ""; let accumulatedChunk = ""; let lastEditTime = 0;
        const minEditInterval = 1500; const maxAccumulatedLength = 100;
        for await (const chunk of stream) { /* ... process chunk, check length, edit message ... */
             const content = chunk.choices[0]?.delta?.content || ''; accumulatedChunk += content; const now = Date.now(); if (accumulatedChunk.length > maxAccumulatedLength || (now - lastEditTime > minEditInterval && accumulatedChunk.length > 0)) { fullResponseText += accumulatedChunk; accumulatedChunk = ""; if (fullResponseText.length > 1950) { fullResponseText = fullResponseText.substring(0, 1950) + "...(truncated)"; try { await thinkingMessage.edit(fullResponseText); } catch(e){} break; } try { await thinkingMessage.edit(fullResponseText + "..."); lastEditTime = now; } catch (editError) { console.error("Discord edit error:", editError.message); }}
        }
        fullResponseText += accumulatedChunk; if (fullResponseText.length === 0) fullResponseText = "AI gave empty response."; if (fullResponseText.length > 2000) fullResponseText = fullResponseText.substring(0, 2000);
        try { await thinkingMessage.edit(fullResponseText); } catch (editError) { console.error("Discord final edit error:", editError.message); }

    } catch (error) { // Catch errors from getAIStream or stream processing
        console.error("[WhaleWatcher] AI stream processing error:", error);
        const errorMsg = `Sorry, AI error processing whale data: ${error.message}`;
        if (thinkingMessage) { try { await thinkingMessage.edit(errorMsg); } catch (e) { message.reply(errorMsg); } } else { message.reply(errorMsg); }
    }
}

module.exports = { handleWhaleCommand };