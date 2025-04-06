// // utils/filterParser.js
// const { ObjectId } = require('mongodb'); // Needs mongodb ObjectId

// /**
//  * Parses the !whale command query string.
//  * @param {string} userQuery - The query text after "!whale ".
//  * @returns {{mongoFilter: object, filterDescription: string, requiresLatestBlockLookup: boolean, requiresMostActiveCheck: boolean, sortOverride: object|null, limitOverride: number|null, parseError: string|null}}
//  */
// function parseWhaleQuery(userQuery) {
//     let mongoFilter = {};
//     let filterDescription = "";
//     let requiresLatestBlockLookup = false; // Flag for '!whale latest' variants
//     let requiresMostActiveCheck = false; // Flag for 'most active'
//     let sortOverride = null;
//     let limitOverride = null;
//     let parseError = null;

//     const lowerCaseQuery = userQuery.toLowerCase().trim();
//     const now = new Date();

//     // Define Regex patterns (Order Matters!)
//     const txHashMatch = lowerCaseQuery.match(/^hash\s+([a-fA-F0-9]{64})$/i);
//     const blockRangeMatch = lowerCaseQuery.match(/^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i);
//     const blockMatch = lowerCaseQuery.match(/^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i);
//     const latestBlockDirectMatch = lowerCaseQuery === 'latest block';
//     const addressLatestBlockMatch = lowerCaseQuery.match(/^address\s+(\w+)\s+latest$/i);
//     const addressTimeMatch = lowerCaseQuery.match(/^address\s+(\w+)\s+(last\s+\d+\s+hour|last\s+\d+\s+day|today|yesterday|last\s+week|last\s+7\s+days)/i);
//     const addressMatch = lowerCaseQuery.match(/^address\s+(\w+)$/i);
//     const valueMatch = lowerCaseQuery.match(/^(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)$/i);
//     const mostActiveMatch = lowerCaseQuery === 'most active last hour';
//     const lastHourMatch = lowerCaseQuery === 'last hour' || lowerCaseQuery === 'past hour';
//     const timeMatch = lowerCaseQuery.match(/^last\s+(\d+)\s+(hour|day|week|month)s?|^(today|yesterday|last\s+week|last\s+7\s+days|last\s+month|last\s+30\s+days|last\s+24\s+hours|last\s+day)$/i);
//     const latestCommandMatch = lowerCaseQuery === 'latest' || lowerCaseQuery === 'latest transfers'; // "!whale latest" command

//     try {
//         // --- Apply Filters with Priority ---
//         if (txHashMatch) {
//             mongoFilter = { txHash: txHashMatch[1] }; filterDescription = `transaction ${txHashMatch[1].substring(0, 8)}...`; limitOverride = 1;
//         } else if (blockRangeMatch) {
//             const blockStart = parseInt(blockRangeMatch[1]); const blockEnd = parseInt(blockRangeMatch[2]);
//             if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) throw new Error("Invalid block range.");
//             // TODO: Add max 7 day gap check if needed
//             mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } }; filterDescription = `block range ${blockStart}-${blockEnd}`;
//         } else if (blockMatch) {
//             const b = parseInt(blockMatch[1]); if (isNaN(b)) throw new Error("Invalid block number.");
//             mongoFilter = { block: b }; filterDescription = `block ${b}`;
//         } else if (latestBlockDirectMatch || addressLatestBlockMatch || latestCommandMatch) { // <<< GROUP 'LATEST BLOCK' INTENTS
//              requiresLatestBlockLookup = true; // Signal handler to find block number FIRST
//              if (addressLatestBlockMatch) {
//                  const addr = addressLatestBlockMatch[1];
//                  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}$/i.test(addr)) throw new Error("Invalid address format.");
//                  mongoFilter = { $or: [{ from: addr }, { to: addr }] }; // Set address filter initially
//                  filterDescription = `address ${addr.substring(0, 6)}... in latest block`;
//              } else { // Handle '!whale latest block' or just '!whale latest'
//                   filterDescription = "latest block"; // Desc updated later by handler
//                   // Keep mongoFilter = {} for now
//              }
//         } else if (mostActiveMatch) { // Handle specific command before general time/address
//             requiresMostActiveCheck = true; filterDescription = "most active last hour";
//             const s = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000); mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } }; // Time filter for helper
//         } else if (addressTimeMatch) {
//             const addr = addressTimeMatch[1]; const timeQueryPart = addressTimeMatch[2];
//             if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}$/i.test(addr)) throw new Error("Invalid address format.");
//             const addressFilter = { $or: [{ from: addr }, { to: addr }] }; let timeFilterPart = {}; let timeDesc = "";
//             const numMatch = timeQueryPart.match(/last\s+(\d+)\s+(hour|day)/); // Only hours/days specified for address combo
//             if (numMatch) { const num = parseInt(numMatch[1]); const unit = numMatch[2]; if (!isNaN(num) && num > 0 && ((unit === 'hour' && num <= 24) || (unit === 'day' && num <= 7))) { const mult = unit === 'hour' ? 3600000 : 86400000; const startS = Math.floor((now.getTime() - num * mult) / 1000); timeFilterPart = { _id: { $gte: ObjectId.createFromTime(startS) } }; timeDesc = `last ${num} ${unit}(s)`; } else { throw new Error(`Invalid range for ${unit} (1-24h, 1-7d).`); } }
//             else if (timeQueryPart === 'today') { /*...*/ const s=new Date(now); s.setHours(0,0,0,0); timeFilterPart={_id:{$gte:ObjectId.createFromTime(Math.floor(s.getTime()/1000))}}; timeDesc="today"; }
//             else if (timeQueryPart === 'yesterday') { /*...*/ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); const startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); const endS=Math.floor(e.getTime()/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS),$lte:ObjectId.createFromTime(endS)}}; timeDesc="yesterday"; }
//             else if (timeQueryPart.includes("last hour")) { /*...*/ const startS=Math.floor((now.getTime()-60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last hour"; }
//             else if (timeQueryPart.includes("last day") || timeQueryPart.includes("last 24 hours")) { /*...*/ const startS=Math.floor((now.getTime()-24*60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last 24 hours"; }
//             else if (timeQueryPart.includes("last week") || timeQueryPart.includes("last 7 days")) { /*...*/ const startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last 7 days"; }
//             if (Object.keys(timeFilterPart).length > 0) { mongoFilter = { $and: [addressFilter, timeFilterPart] }; filterDescription = `address ${addr.substring(0, 6)}... (${timeDesc})`; }
//             else { throw new Error("Could not parse time range for address query."); }
//         } else if (addressMatch && Object.keys(mongoFilter).length === 0) { // Address only (apply default time range)
//             const a = addressMatch[1]; mongoFilter = { $or: [{ from: a }, { to: a }] };
//             const s = Math.floor((now.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000); // Default last 3 days
//             mongoFilter = { $and: [mongoFilter, { _id: { $gte: ObjectId.createFromTime(s) } }] };
//             filterDescription = `address ${a.substring(0, 6)}... (last 3 days)`;
//         } else if (lastHourMatch) { // Time only
//              const s = Math.floor((now.getTime() - 60*60*1000)/1000); mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}}; filterDescription="last hour";
//         } else if (timeMatch) { // Other times only
//              let startSeconds; let endSeconds = null; const timeQuery=timeMatch[0]; const numMatch = timeQuery.match(/last\s+(\d+)\s+(hour|day|week|month)/); // Check specific N units first
//              if (numMatch) { /* ... parse num/unit, check limits ... */ startSeconds=Math.floor((now.getTime() - num * mult)/1000); filterDescription=`last ${num} ${unit}(s)`;}
//              else if (timeQuery === 'today') { /*...*/ startSeconds=Math.floor(new Date(now.setHours(0,0,0,0))/1000); filterDescription = "today"; }
//              else if (timeQuery === 'yesterday') { /*...*/ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; }
//              else if (timeQuery === 'last 24 hours' || timeQuery === 'last day') { /*...*/ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); filterDescription="last 24 hours";}
//              else if (timeQuery === 'last week' || timeQuery === 'last 7 days') { /*...*/ startSeconds=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days";}
//              else if (timeQuery === 'last month' || timeQuery === 'last 30 days') { /*...*/ startSeconds=Math.floor((now.getTime()-30*24*60*60*1000)/1000); filterDescription="last 30 days";}
//              if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; } else { mongoFilter={_id:{$gte:sO}}; } } else { /* Use default or error */ }
//              if (Object.keys(mongoFilter).length === 0) {parseError="Could not parse time range.";} // Error if time match but no filter set
//         } else if (valueMatch && Object.keys(mongoFilter).length === 0) { // Value only
//              try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){/*...*/} mongoFilter={value:{[mOp]:v}}; filterDescription=`value ${op} ${v}`; sortOverride={value:-1}; } else {throw new Error("Invalid value");}} catch(e){throw e;}
//         }
//         // If NO filter has been set by any specific command structure, it's invalid
//         else if (Object.keys(mongoFilter).length === 0 && !requiresLatestBlockLookup && !requiresMostActiveCheck) {
//             parseError = "Unknown command format or parameters. Use !help for examples.";
//         }

//     } catch (error) {
//         parseError = error.message || "Failed to parse query parameters.";
//     }

//     // Final check and return
//     if (parseError) {
//         console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
//         return { parseError };
//     } else {
//         console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestBlockLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}`);
//         return { mongoFilter, filterDescription, sortOverride, requiresLatestBlockLookup, requiresMostActiveCheck, parseError: null };
//     }
// }

// module.exports = { parseWhaleQuery };

// utils/filterParser.js
const { ObjectId } = require('mongodb'); // Needs mongodb ObjectId

/**
 * Parses the !whale command query string precisely based on defined formats.
 * @param {string} userQuery - The query text after "!whale ".
 * @returns {{mongoFilter: object, filterDescription: string, requiresLatestBlockLookup: boolean, requiresMostActiveCheck: boolean, sortOverride: object|null, limitOverride: number|null, parseError: string|null}}
 */
function parseWhaleQuery(userQuery) {
    let mongoFilter = {};
    let filterDescription = "";
    let requiresLatestBlockLookup = false;
    let requiresMostActiveCheck = false;
    let sortOverride = null;
    let limitOverride = null;
    let parseError = null;

    const lowerCaseQuery = userQuery.toLowerCase().trim();
    const now = new Date();

    // --- Define Regex patterns for specific commands ---
    // Order matters - more specific patterns first
    const patterns = [
        { name: 'TX_HASH', regex: /^(?:txhash|hash)\s+([a-fA-F0-9]{64})$/i },
        { name: 'ADDRESS_LATEST', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+latest$/i },
        { name: 'ADDRESS_TIME_RANGE', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+(hour|day)s?$/i },
        { name: 'ADDRESS_TIME_WORD', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+(today|yesterday|last\s+week|last\s+7\s+days)$/i }, // Added last week/7 days
        { name: 'ADDRESS_ONLY', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
        { name: 'BLOCK_RANGE', regex: /^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i },
        { name: 'BLOCK_SINGLE', regex: /^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i },
        { name: 'LATEST_BLOCK_DIRECT', regex: /^latest\s+block$/i },
        { name: 'LATEST_ALIAS', regex: /^(latest|latest\s+transfers)$/i },
        { name: 'MOST_ACTIVE', regex: /^most\s+active\s+last\s+hour$/i },
        { name: 'TIME_RANGE', regex: /^last\s+(\d+)\s+(hour|day)s?$/i }, // Specific hour/day range
        { name: 'TIME_WORD', regex: /^(last\s+hour|past\s+hour|today|yesterday|last\s+week|last\s+7\s+days)$/i } // Specific word ranges
        // Note: Value filter removed as standalone, could be added back or combined if needed
    ];

    let matchFound = false;

    try {
        for (const p of patterns) {
            const match = lowerCaseQuery.match(p.regex);
            if (match) {
                console.log(`[FilterParser] Matched pattern: ${p.name}`);
                matchFound = true;
                let addr, num, unit, startS, endS, blockStart, blockEnd; // Declare vars locally

                switch (p.name) {
                    case 'TX_HASH':
                        mongoFilter = { txHash: match[1] };
                        filterDescription = `transaction ${match[1].substring(0, 8)}...`;
                        limitOverride = 1;
                        break;

                    case 'ADDRESS_LATEST':
                        addr = match[1];
                        requiresLatestBlockLookup = true;
                        mongoFilter = { $or: [{ from: addr }, { to: addr }] };
                        filterDescription = `address ${addr.substring(0, 6)}... in latest block`;
                        break;

                    case 'ADDRESS_TIME_RANGE':
                        addr = match[1];
                        num = parseInt(match[2], 10);
                        unit = match[3];
                        if (unit === 'hour' && num >= 1 && num <= 24) {
                            startS = Math.floor((now.getTime() - num * 3600000) / 1000);
                        } else if (unit === 'day' && num >= 1 && num <= 7) {
                            startS = Math.floor((now.getTime() - num * 86400000) / 1000);
                        } else {
                            throw new Error(`Invalid range for ${unit}: must be 1-24 hours or 1-7 days.`);
                        }
                        mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, { _id: { $gte: ObjectId.createFromTime(startS) } } ] };
                        filterDescription = `address ${addr.substring(0, 6)}... (last ${num} ${unit}${num > 1 ? 's' : ''})`;
                        break;

                     case 'ADDRESS_TIME_WORD':
                        addr = match[1];
                        const timeWordAddr = match[2];
                        let timeFilterPartAddr = {};
                        let timeDescAddr = "";
                        if (timeWordAddr === 'today') { const s=new Date(now); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDescAddr="today"; }
                        else if (timeWordAddr === 'yesterday') { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endS=Math.floor(e.getTime()/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS),$lte:ObjectId.createFromTime(endS)}}; timeDescAddr="yesterday"; }
                        else if (timeWordAddr === 'last week' || timeWordAddr === 'last 7 days') { startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDescAddr="last 7 days"; }
                        else { throw new Error(`Unhandled time word for address: ${timeWordAddr}`);}
                        mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, timeFilterPartAddr ] };
                        filterDescription = `address ${addr.substring(0, 6)}... (${timeDescAddr})`;
                        break;

                    case 'ADDRESS_ONLY': // Apply default time range (e.g., last 3 days)
                        addr = match[1];
                        startS = Math.floor((now.getTime() - 3 * 86400000) / 1000); // 3 days
                        mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, { _id: { $gte: ObjectId.createFromTime(startS) } } ] };
                        filterDescription = `address ${addr.substring(0, 6)}... (default: last 3 days)`;
                        break;

                    case 'BLOCK_RANGE':
                        blockStart = parseInt(match[1], 10);
                        blockEnd = parseInt(match[2], 10);
                        if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) throw new Error("Invalid block range.");
                        // Note: 7-day gap check omitted due to complexity
                        mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } };
                        filterDescription = `block range ${blockStart}-${blockEnd} (Note: 7-day gap check not applied)`;
                        break;

                    case 'BLOCK_SINGLE':
                        const b = parseInt(match[1], 10);
                        if (isNaN(b)) throw new Error("Invalid block number.");
                        mongoFilter = { block: b };
                        filterDescription = `block ${b}`;
                        break;

                    case 'LATEST_BLOCK_DIRECT':
                    case 'LATEST_ALIAS':
                        requiresLatestBlockLookup = true;
                        filterDescription = "latest block"; // Handler will refine this
                        break;

                    case 'MOST_ACTIVE':
                        requiresMostActiveCheck = true;
                        filterDescription = "most active last hour";
                        startS = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000); // 1 hour
                        mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } }; // Time filter for the helper
                        break;

                    case 'TIME_RANGE':
                        num = parseInt(match[1], 10);
                        unit = match[2];
                        if (unit === 'hour' && num >= 1 && num <= 24) {
                            startS = Math.floor((now.getTime() - num * 3600000) / 1000);
                        } else if (unit === 'day' && num >= 1 && num <= 7) {
                            startS = Math.floor((now.getTime() - num * 86400000) / 1000);
                        } else {
                            throw new Error(`Invalid range: must be 1-24 hours or 1-7 days.`);
                        }
                        mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        filterDescription = `last ${num} ${unit}${num > 1 ? 's' : ''}`;
                        break;

                     case 'TIME_WORD':
                        const timeWord = match[1];
                        if (timeWord === 'last hour' || timeWord === 'past hour') { startS = Math.floor((now.getTime() - 60*60*1000)/1000); filterDescription="last hour"; }
                        else if (timeWord === 'today') { const s=new Date(now); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); filterDescription = "today"; }
                        else if (timeWord === 'yesterday') { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endS=Math.floor(e.getTime()/1000); }
                        else if (timeWord === 'last week' || timeWord === 'last 7 days') { startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days"; }
                        else { throw new Error(`Unhandled time word: ${timeWord}`);} // Should not happen if regex matches

                        if(startSeconds!==undefined){
                            const sO=ObjectId.createFromTime(startSeconds);
                            if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; }
                            else { mongoFilter={_id:{$gte:sO}}; }
                        } else { throw new Error(`Could not calculate start time for ${timeWord}`); }
                        break;
                }
                break; // Exit loop once a match is found
            }
        } // End for loop

        // If no specific pattern matched
        if (!matchFound) {
            parseError = "Unknown command format. Use `!help` for examples.";
        }

    } catch (error) {
        parseError = error.message || "Failed to parse query parameters.";
    }

    // Final check and return
    if (parseError) {
        console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
        return { parseError }; // Return only error if parsing failed
    } else {
        console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestBlockLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}`);
        return { mongoFilter, filterDescription, sortOverride, limitOverride, requiresLatestBlockLookup, requiresMostActiveCheck, parseError: null };
    }
}

module.exports = { parseWhaleQuery };