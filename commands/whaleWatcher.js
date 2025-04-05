// commands/whaleWatcher.js
const { ObjectId } = require('mongodb');
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

// --- Helper: Generate File ---
function generateTxFile(topNData, filterDescription, format = 'csv') {
    console.log(`[WhaleWatcher] Generating ${format.toUpperCase()} file for Top ${topNData.length} transactions...`);
    const dataForFile = topNData.map(tx => {
        let timestamp = null;
        if (tx?._id && typeof tx._id.getTimestamp === 'function') { try { timestamp = tx._id.getTimestamp().toISOString(); } catch(e){ console.error("Error getting timestamp:",e); } }
        const valueBTC = Number(tx?.value || 0) / 1e8;
        return {
            Timestamp: timestamp,
            Block: tx?.block?.$numberInt || tx?.block?.$numberLong || tx?.block,
            Value_BTC: valueBTC.toFixed(8),
            TxHash: tx?.txHash || 'N/A',
            From_Addresses: tx?.from?.join(', ') || '',
            From_Labels: tx?.fromLabels?.join(' | ') || '',
            To_Addresses: tx?.to?.join(', ') || '',
            To_Labels: tx?.toLabels?.join(' | ') || '',
            Explorer_Link: `${BLOCK_EXPLORER_URL}${tx?.txHash || ''}`,
        };
    });
    try {
        if (format === 'csv' && stringify) { const columns = dataForFile.length > 0 ? Object.keys(dataForFile[0]) : ['Timestamp', 'Block', 'Value_BTC', 'TxHash', 'From_Addresses', 'From_Labels', 'To_Addresses', 'To_Labels', 'Explorer_Link']; const csvString = stringify(dataForFile, { header: true, columns: columns }); return Buffer.from(csvString, 'utf-8'); }
        else if (format === 'json') { const jsonString = JSON.stringify(dataForFile, null, 2); return Buffer.from(jsonString, 'utf-8'); }
        else { throw new Error("Invalid format or csv-stringify missing."); }
    } catch (fileError) { console.error(`[WhaleWatcher] Error generating ${format} file:`, fileError); return null; }
}

// --- CORRECTED Helper: Construct AI Prompt ---
const constructWhalePrompt = (summary, topNData, query) => {
    // --- USE BACKTICKS (`) for the entire template literal ---
    let prompt = `You are an AI assistant analyzing large Bitcoin (BTC) transactions (>1 BTC).
User Query: "${query}"
Filter Applied: "${summary.filter || 'N/A'}"

== Overall Summary (Based on ALL ${summary.totalTxCount || 0} matching transactions) ==
Total Volume: ${summary.totalVolumeBTC?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0} BTC
Block Range: ${summary.minBlock && summary.maxBlock ? `${summary.minBlock} - ${summary.maxBlock}` : 'N/A'}
---

Below are the Top ${topNData.length} transactions from this set, sorted by highest value (includes derived timestamp and known wallet labels):
\`\`\`json
`; // End initial part of prompt string with json code block start

    // Carefully process data separately
    const processedData = topNData.map(doc => {
        const newDoc = {
             txHash: doc?.txHash,
             timestamp: null,
             block: doc?.block?.$numberInt || doc?.block?.$numberLong || doc?.block,
             valueBTC: parseFloat((Number(doc?.value?.$numberLong || doc?.value?.$numberInt || doc?.value || 0) / 1e8).toFixed(4)),
             // Corrected label access with optional chaining and index check
             from: doc?.from?.map((addr, i) => `${addr}${doc.fromLabels && doc.fromLabels[i] ? ` (${doc.fromLabels[i]})` : ''}`) || [],
             to: doc?.to?.map((addr, i) => `${addr}${doc.toLabels && doc.toLabels[i] ? ` (${doc.toLabels[i]})` : ''}`) || []
         };
         if (doc?._id && typeof doc._id.getTimestamp === 'function') { try { newDoc.timestamp = doc._id.getTimestamp().toISOString(); } catch {} }
        return newDoc;
    });

    // Add the processed data JSON to the prompt, handle potential stringify errors
    try {
        prompt += JSON.stringify(processedData, null, 2);
    } catch (stringifyError) {
         console.error("[constructWhalePrompt] Error stringifying processedData:", stringifyError);
         prompt += `[Error processing transaction details: ${stringifyError.message}]`;
     }

    // Add the final instructions part using backticks
    prompt += `
\`\`\`

Analysis Task: Based *only* on the Summary and Top ${topNData.length} Transactions:
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
    let thinkingMessage = null; let fullResponseText = ""; let fileBuffer = null; let fileName = 'whale_transactions.csv';
    let plan = {}; let finalPrompt = ""; // Define higher scope

    try { // Outer try block
        thinkingMessage = await message.reply("🐳 Preparing whale report...");

        // --- Corrected Filter Determination Logic ---
        let mongoFilter = {}; let filterDescription = ""; const lowerCaseQuery = userQuery.toLowerCase().trim();
        const txHashMatch = lowerCaseQuery.match(/\b([a-fA-F0-9]{64})\b/); const blockRegex = /(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)/i; const blockMatch = lowerCaseQuery.match(blockRegex); const addressMatch = lowerCaseQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i); const valueMatch = lowerCaseQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i); const lastHourMatch = lowerCaseQuery.includes("last hour") || lowerCaseQuery.includes("past hour"); const timeMatch = lowerCaseQuery.match(/today|yesterday|last day|last 24 hours|last month|last week|last\s+(\d+)\s+(hour|day|week|month)s?/); const latestMatch = lowerCaseQuery === 'latest' || lowerCaseQuery === 'latest transfers';
        if (txHashMatch) { mongoFilter = { txHash: txHashMatch[0] }; filterDescription = `tx ${txHashMatch[0].substring(0,4)}...`; }
        else if (blockMatch) { try { const b = parseInt(blockMatch[1]); if(!isNaN(b)){ mongoFilter={block:b}; filterDescription=`block ${b}`; }} catch(e){ console.warn("Block parse error"); } }
        else if (lastHourMatch) { const now=new Date(); const s = Math.floor((now.getTime() - 60*60*1000)/1000); mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}}; filterDescription="last hour"; }
        else if (latestMatch) { const now = new Date(); const s = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000); mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } }; filterDescription = "latest 24 hours"; }
        else if (timeMatch) { const now = new Date(); let startSeconds; let endSeconds = null; const tq=timeMatch[0]; const numMatch = tq.match(/last\s+(\d+)\s+(hour|day|week|month)/); if (numMatch) { const num=parseInt(numMatch[1]); const unit=numMatch[2]; if (!isNaN(num)) { let mult = unit==='hour'?3600000:unit==='day'?86400000:unit==='week'?604800000:unit==='month'?2592000000:0; startSeconds=Math.floor((now.getTime() - num*mult)/1000); filterDescription = `last ${num} ${unit}(s)`; } } else if (tq.includes("today")) { const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); filterDescription = "today"; } else if (tq.includes("yesterday")) { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; } else if (tq.includes("last 24 hour")||tq.includes("last day")) { startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); filterDescription="last 24 hours";} else if (tq.includes("last week")||tq.includes("last 7 day")) { startSeconds=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days";} else if (tq.includes("last month")||tq.includes("last 30 day")) { startSeconds=Math.floor((now.getTime()-30*24*60*60*1000)/1000); filterDescription="last 30 days";} if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; } else { mongoFilter={_id:{$gte:sO}}; } } else { console.warn("Could not parse time match:", tq); } }
        else if (addressMatch && Object.keys(mongoFilter).length === 0) { const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; filterDescription = `address ${a.substring(0,6)}...`; }
        else if (valueMatch && Object.keys(mongoFilter).length === 0) { try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break;case'<':mOp='$lt';break;case'>=':mOp='$gte';break;case'<=':mOp='$lte';break;default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; filterDescription=`value ${op} ${v}`; }} catch(e){} }
        if (Object.keys(mongoFilter).length === 0) { const now = new Date(); const s = Math.floor((now.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000); mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } }; filterDescription = "latest activity (last 3 days)"; console.log(`[WhaleWatcher] Applied default filter: ${filterDescription}`); }
        console.log(`[WhaleWatcher] FINAL Filter Applied: ${filterDescription} - ${JSON.stringify(mongoFilter)}`);
        // --- End Filter Determination ---


        // --- Query MongoDB ---
        await thinkingMessage.edit(`🐳 Fetching summary & top ${TOP_N_FOR_AI} txs for: ${filterDescription}...`);
        let summaryData, topTransactions;
        try { const results = await mongoHelper.getWhaleSummaryAndTopTransactions(mongoFilter, TOP_N_FOR_AI); summaryData = results.summary; topTransactions = results.topTransactions; summaryData.filter = filterDescription; if (!summaryData || topTransactions.length === 0) { await thinkingMessage.edit(`No whale data for: \`${filterDescription}\``); return; } console.log(`Received summary and top ${topTransactions.length} txs.`); }
        catch (error) { throw error; }

        // --- Generate File ---
        await thinkingMessage.edit("💾 Generating data file...");
        fileName = `whale_txs_${filterDescription.replace(/[^a-z0-9]/gi, '_') || 'latest'}_top${topTransactions.length}byValue.csv`;
        fileBuffer = generateTxFile(topTransactions, 'csv'); // Use enriched Top N

        // --- Construct Final AI Prompt ---
        finalPrompt = constructWhalePrompt(summaryData, topTransactions, userQuery); // Use corrected function

        // --- Token Check with Logging & Validation ---
        let encoding;
        try {
            console.log("[WhaleWatcher] Constructing prompt for token check (first 100):", finalPrompt?.substring(0, 100)); // Debug Log
            if (typeof finalPrompt !== 'string' || finalPrompt.length === 0) {
                console.error("[WhaleWatcher] Invalid finalPrompt generated."); // Log if invalid
                throw new Error('Constructed final prompt is invalid or empty BEFORE encoding.');
            }
            encoding = get_encoding(TOKENIZER_ENCODING);
            let estimatedTokens = encoding.encode(finalPrompt).length;
            console.log(`[WhaleWatcher] Estimated prompt tokens (Summary + Top ${topTransactions.length}): ${estimatedTokens}`);
            if (estimatedTokens > MAX_PROMPT_TOKENS) { console.warn(`Prompt tokens (${estimatedTokens}) > limit (${MAX_PROMPT_TOKENS}).`); }
            encoding.free();
        } catch (tokenError) {
            console.error("[WhaleWatcher] Token estimation error:", tokenError);
            console.error("[WhaleWatcher] Prompt causing token error (first 100 chars):", typeof finalPrompt === 'string' ? finalPrompt.substring(0,100) : String(finalPrompt)); // Log prompt on error safely
            if(encoding) encoding.free();
            throw new Error("Error estimating AI tokens.");
        }
        // --- End Token Check ---

        // --- Get Response from AI (Streaming) ---
        await thinkingMessage.edit(`🐳 Analyzing summary & top ${topTransactions.length} txs...`);
        let stream = null;
        try { stream = await aiHelper.getAIStream(finalPrompt); console.log("[WhaleWatcher] AI Stream object received. Processing chunks..."); }
        catch(aiError) { throw new Error(`AI stream init failed: ${aiError.message}`); }

        fullResponseText = ""; // Reset before accumulating stream
        let accumulatedChunk = ""; let lastEditTime = 0; const minEditInterval = 1500; const maxAccumulatedLength = 100; let chunkCount = 0; let streamErrored = false;
        try { // Wrap stream processing
             for await (const chunk of stream) {
                  chunkCount++; const content = chunk.choices[0]?.delta?.content || '';
                  if (content) accumulatedChunk += content;
                  const now = Date.now();
                  if (thinkingMessage && accumulatedChunk.length > 0 && (accumulatedChunk.length >= maxAccumulatedLength || now - lastEditTime > minEditInterval)) {
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
        let finalReplyOptions = {}; // Define here

        if (fullResponseText.length === 0) fullResponseText = "Sorry, couldn't generate an analysis.";
        if (fullResponseText.endsWith("...") && !fullResponseText.endsWith("(truncated)")) { fullResponseText = fullResponseText.slice(0, -3); }
        if (fullResponseText.length > 1980) fullResponseText = fullResponseText.substring(0, 1980) + "...";

        finalReplyOptions.content = fullResponseText; // Assign content

        if (fileBuffer) { const attachment = new AttachmentBuilder(fileBuffer, { name: fileName }); finalReplyOptions.files = [attachment]; finalReplyOptions.content += `\n\n*See attached \`${fileName}\` for Top ${topTransactions.length} tx details.*`; }
        else { finalReplyOptions.content += `\n\n*(Error generating file)*`; }

        // Final check before editing
        console.log('[WhaleWatcher] DEBUG: Before final edit...'); console.log('[WhaleWatcher] DEBUG: typeof thinkingMessage:', typeof thinkingMessage); console.log('[WhaleWatcher] DEBUG: typeof finalReplyOptions:', typeof finalReplyOptions);
        if (!thinkingMessage) { console.error("Cannot edit: thinkingMessage null!"); await message.reply(finalReplyOptions); }
        else if (typeof finalReplyOptions !== 'object' || finalReplyOptions === null) { console.error("Cannot edit: finalReplyOptions invalid!", finalReplyOptions); await thinkingMessage.edit("Internal error preparing reply."); }
        else { await thinkingMessage.edit(finalReplyOptions); console.log("[WhaleWatcher] Final message sent/edited."); }

    } catch (error) { // Catch top-level errors
        console.error(`[WhaleWatcher] Top-level error processing query "${userQuery}":`, error); const errorMsg = `Sorry, encountered an error: ${error.message}`; if (thinkingMessage) { try { await thinkingMessage.edit({ content: errorMsg, embeds: [], files: [], components:[] }); } catch (e) { await message.reply(errorMsg); } } else { await message.reply(errorMsg); }
    }
} // End handleWhaleCommand

module.exports = { handleWhaleCommand };


