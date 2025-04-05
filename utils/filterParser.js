// // utils/filterParser.js
// const { ObjectId } = require('mongodb'); // Needs mongodb ObjectId

// /**
//  * Parses the user query for the !whale command and returns filter object + description.
//  * @param {string} userQuery - The text following the !whale prefix.
//  * @returns {{mongoFilter: object, filterDescription: string, sortOverride: object|null}}
//  */
// function parseWhaleQuery(userQuery) {
//     let mongoFilter = {};
//     let filterDescription = "latest activity"; // Default description
//     let sortOverride = null; // Usually null, sort by value happens later unless value filter used
//     const lowerCaseQuery = userQuery.toLowerCase().trim();

//     // Define Regex patterns
//     const txHashMatch = lowerCaseQuery.match(/\b([a-fA-F0-9]{64})\b/);
//     const blockRegex = /(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)/i;
//     const blockMatch = lowerCaseQuery.match(blockRegex);
//     // Match block range: block X to Y | block X-Y
//     const blockRangeRegex = /(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)/i;
//     const blockRangeMatch = lowerCaseQuery.match(blockRangeRegex);
//     const addressMatch = lowerCaseQuery.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}\b/i);
//     const valueMatch = lowerCaseQuery.match(/(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)/i);
//     const lastHourMatch = lowerCaseQuery.includes("last hour") || lowerCaseQuery.includes("past hour");
//     const timeMatch = lowerCaseQuery.match(/today|yesterday|last day|last 24 hours|last month|last week|last\s+(\d+)\s+(hour|day|week|month)s?/);
//     const latestMatch = lowerCaseQuery === 'latest' || lowerCaseQuery === 'latest transfers';
//     // Simple check for "most active" - further logic needed in handler/mongoHelper
//     const mostActiveMatch = lowerCaseQuery.includes("most active");

//     // --- Apply Filters with Priority ---
//     if (txHashMatch) {
//         mongoFilter = { txHash: txHashMatch[0] };
//         filterDescription = `transaction ${txHashMatch[0].substring(0, 8)}...`;
//     } else if (blockRangeMatch) {
//         // Block Range Query
//         try {
//             const blockStart = parseInt(blockRangeMatch[1]);
//             const blockEnd = parseInt(blockRangeMatch[2]);
//             if (!isNaN(blockStart) && !isNaN(blockEnd)) {
//                 if (blockEnd < blockStart) throw new Error("End block must be greater than start block.");
//                 // Optional: Add check for max range (e.g., 7 days) - requires getting block times, complex. Add note?
//                 mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } };
//                 filterDescription = `block range ${blockStart}-${blockEnd}`;
//                 console.log(`[FilterParser] Parsed Block Range Filter: ${JSON.stringify(mongoFilter)}`);
//             } else { throw new Error("Invalid block numbers in range."); }
//         } catch (e) { console.warn("Block range parse error:", e.message); filterDescription = "Invalid block range"; mongoFilter = { _id: null }; } // Force no results
//     } else if (blockMatch) {
//         // Single Block Query
//         try {
//             const b = parseInt(blockMatch[1]);
//             if (!isNaN(b)) { mongoFilter = { block: b }; filterDescription = `block ${b}`; }
//             else { throw new Error("Invalid block number."); }
//         } catch (e) { console.warn("Block parse error:", e.message); filterDescription = "Invalid block number"; mongoFilter = { _id: null }; } // Force no results
//     } else if (lastHourMatch) {
//          // Last Hour Time Filter
//          const now = new Date(); const startSeconds = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000);
//          mongoFilter = { _id: { $gte: ObjectId.createFromTime(startSeconds) } }; filterDescription = "last hour";
//          console.log(`[FilterParser] Parsed Time Filter: ${filterDescription} - ${JSON.stringify(mongoFilter)}`);
//     } else if (latestMatch) {
//          // "Latest" Time Filter (e.g., Last 24 Hours)
//          const now = new Date(); const startSeconds = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000);
//          mongoFilter = { _id: { $gte: ObjectId.createFromTime(startSeconds) } };
//          filterDescription = "latest 24 hours";
//          console.log(`[FilterParser] Parsed Time Filter: ${filterDescription} - ${JSON.stringify(mongoFilter)}`);
//     } else if (timeMatch) {
//          // Other Time Filters
//          const now = new Date(); let startSeconds; let endSeconds = null; const timeQuery = timeMatch[0];
//          const numMatch = timeQuery.match(/last\s+(\d+)\s+(hour|day|week|month)/);
//          try {
//              if (numMatch) { const num = parseInt(numMatch[1]); const unit = numMatch[2]; if (!isNaN(num) && num > 0) { let multiplier = unit === 'hour' ? 3600000 : unit === 'day' ? 86400000 : unit === 'week' ? 604800000 : unit === 'month' ? 2592000000 : 0; if(multiplier === 0) throw new Error("Invalid time unit."); /* Add limits X <= 24h or 7d */ if((unit === 'hour' && num > 24) || (unit === 'day' && num > 7) || (unit === 'week' && num > 1) || (unit === 'month')) { throw new Error(`Max range supported is 24 hours or 7 days.`); } startSeconds = Math.floor((now.getTime() - num * multiplier) / 1000); filterDescription = `last ${num} ${unit}(s)`; } else { throw new Error("Invalid number for time range."); } }
//              else if (timeQuery.includes("today")) { const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); filterDescription = "today"; }
//              else if (timeQuery.includes("yesterday")) { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; }
//              else if (timeQuery.includes("last 24 hour")||timeQuery.includes("last day")) { startSeconds=Math.floor((now.getTime() - 24*60*60*1000)/1000); filterDescription = "last 24 hours"; }
//              else if (timeQuery.includes("last week")||timeQuery.includes("last 7 day")) { startSeconds=Math.floor((now.getTime() - 7*24*60*60*1000)/1000); filterDescription = "last 7 days"; }
//              // Removed "last month" as it likely exceeds reasonable processing without better DB queries/summaries

//              if(startSeconds!==undefined){ const startObjId=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const endObjId=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:startObjId, $lte:endObjId}}; } else { mongoFilter={_id:{$gte:startObjId}}; } console.log(`[FilterParser] Parsed Time Filter: ${filterDescription} - ${JSON.stringify(mongoFilter)}`); }
//              else { throw new Error(`Could not parse time range: ${timeQuery}`); }
//         } catch(e) { console.warn("Time parse error:", e.message); filterDescription = "Invalid time range"; mongoFilter = { _id: null }; } // Force no results on time parse error
//     }
//     // Apply address/value only if NO primary filter was applied yet
//     else if (addressMatch && Object.keys(mongoFilter).length === 0) {
//         const a = addressMatch[0]; mongoFilter = { $or: [{ from: a }, { to: a }] }; filterDescription = `address ${a.substring(0, 6)}...`;
//         console.log(`[FilterParser] Parsed Address Filter: ${filterDescription}`);
//         // --- Handle combined Address + Time cases (e.g., !whale address# latest) ---
//          // Check AGAIN for time keywords after matching address
//          const innerTimeMatch = lowerCaseQuery.match(/latest|last hour|past hour|today|yesterday|last day|last 24 hours|last week|last 7 days/); // Simpler list
//          let timeFilterForAddress = null;
//          if (innerTimeMatch) {
//              const innerTimeQuery = innerTimeMatch[0];
//              const now = new Date(); let startSeconds; let endSeconds = null;
//              if (innerTimeQuery === 'latest' || innerTimeQuery.includes("last 24 hour") || innerTimeQuery.includes("last day")) { startSeconds=Math.floor((now.getTime() - 24*60*60*1000)/1000); filterDescription += " (last 24h)"; }
//              else if (innerTimeQuery.includes("last hour") || innerTimeQuery.includes("past hour")) { startSeconds = Math.floor((now.getTime() - 60*60*1000)/1000); filterDescription += " (last hour)";}
//              else if (innerTimeQuery.includes("today")) { const s=new Date(now); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); filterDescription += " (today)"; }
//              else if (innerTimeQuery.includes("yesterday")) { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription += " (yesterday)"; }
//              else if (innerTimeQuery.includes("last week") || innerTimeQuery.includes("last 7 day")) { startSeconds=Math.floor((now.getTime() - 7*24*60*60*1000)/1000); filterDescription += " (last 7 days)"; }
//              // Build time filter part
//              if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); timeFilterForAddress={_id:{$gte:sO,$lte:eO}}; } else { timeFilterForAddress={_id:{$gte:sO}}; } }
//          }
//          // Combine address filter and time filter if time was found
//          if (timeFilterForAddress) {
//               mongoFilter = { $and: [mongoFilter, timeFilterForAddress] };
//               console.log(`[FilterParser] Combined Address + Time filter: ${JSON.stringify(mongoFilter)}`);
//          }
//     }
//     else if (valueMatch && Object.keys(mongoFilter).length === 0) {
//         try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){case'>':mOp='$gt';break;case'<':mOp='$lt';break;case'>=':mOp='$gte';break;case'<=':mOp='$lte';break;default:mOp='$eq';break;} mongoFilter={value:{[mOp]:v}}; filterDescription=`value ${op} ${v}`; sortOverride = { value: -1 }; /* Override sort when filtering by value */ console.log(`[FilterParser] Parsed Value Filter: ${filterDescription}`); }} catch(e){}
//     }

//     // Final Default if filter is still empty (should only happen on invalid query now)
//     if (Object.keys(mongoFilter).length === 0 && !txHashMatch && !blockMatch && !lastHourMatch && !latestMatch && !timeMatch && !addressMatch && !valueMatch) {
//          const now = new Date(); const s = Math.floor((now.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000); // Default: last 3 days
//          mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } };
//          filterDescription = "latest activity (last 3 days)";
//          console.log(`[FilterParser] No specific filter matched. Applied default: ${filterDescription}`);
//     }

//     // Flags for special handling (only basic latest block check implemented for now)
//     let requiresLatestBlockCheck = (blockMatch === 'LATEST_BLOCK');
//     let requiresMostActiveCheck = (mostActiveMatch && lastHourMatch); // Only support "most active last hour" for now

//      if (requiresMostActiveCheck) {
//          // Override description - NOTE: "Most Active" logic is NOT implemented in mongoHelper yet
//           filterDescription = "most active wallets last hour";
//           console.warn("[FilterParser] 'Most Active' query detected but full implementation is pending.");
//           // Reset filter to just last hour for now, handler needs to know to call a different mongo function
//           const now=new Date(); const s = Math.floor((now.getTime() - 60*60*1000)/1000);
//           mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}};
//      }


//     console.log(`[FilterParser] FINAL Filter: ${filterDescription} - ${JSON.stringify(mongoFilter)}`);
//     return { mongoFilter, filterDescription, sortOverride, requiresLatestBlockCheck, requiresMostActiveCheck };
// }

// module.exports = { parseWhaleQuery };

// utils/filterParser.js
const { ObjectId } = require('mongodb'); // Needs mongodb ObjectId

/**
 * Parses the !whale command query string.
 * @param {string} userQuery - The query text after "!whale ".
 * @returns {{mongoFilter: object, filterDescription: string, requiresLatestBlockLookup: boolean, requiresMostActiveCheck: boolean, sortOverride: object|null, limitOverride: number|null, parseError: string|null}}
 */
function parseWhaleQuery(userQuery) {
    let mongoFilter = {};
    let filterDescription = "";
    let requiresLatestBlockLookup = false; // Flag for '!whale latest' variants
    let requiresMostActiveCheck = false; // Flag for 'most active'
    let sortOverride = null;
    let limitOverride = null;
    let parseError = null;

    const lowerCaseQuery = userQuery.toLowerCase().trim();
    const now = new Date();

    // Define Regex patterns (Order Matters!)
    const txHashMatch = lowerCaseQuery.match(/^hash\s+([a-fA-F0-9]{64})$/i);
    const blockRangeMatch = lowerCaseQuery.match(/^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i);
    const blockMatch = lowerCaseQuery.match(/^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i);
    const latestBlockDirectMatch = lowerCaseQuery === 'latest block';
    const addressLatestBlockMatch = lowerCaseQuery.match(/^address\s+(\w+)\s+latest$/i);
    const addressTimeMatch = lowerCaseQuery.match(/^address\s+(\w+)\s+(last\s+\d+\s+hour|last\s+\d+\s+day|today|yesterday|last\s+week|last\s+7\s+days)/i);
    const addressMatch = lowerCaseQuery.match(/^address\s+(\w+)$/i);
    const valueMatch = lowerCaseQuery.match(/^(?:value|amount)\s*(>|<|>=|<=|=)\s*(\d+)$/i);
    const mostActiveMatch = lowerCaseQuery === 'most active last hour';
    const lastHourMatch = lowerCaseQuery === 'last hour' || lowerCaseQuery === 'past hour';
    const timeMatch = lowerCaseQuery.match(/^last\s+(\d+)\s+(hour|day|week|month)s?|^(today|yesterday|last\s+week|last\s+7\s+days|last\s+month|last\s+30\s+days|last\s+24\s+hours|last\s+day)$/i);
    const latestCommandMatch = lowerCaseQuery === 'latest' || lowerCaseQuery === 'latest transfers'; // "!whale latest" command

    try {
        // --- Apply Filters with Priority ---
        if (txHashMatch) {
            mongoFilter = { txHash: txHashMatch[1] }; filterDescription = `transaction ${txHashMatch[1].substring(0, 8)}...`; limitOverride = 1;
        } else if (blockRangeMatch) {
            const blockStart = parseInt(blockRangeMatch[1]); const blockEnd = parseInt(blockRangeMatch[2]);
            if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) throw new Error("Invalid block range.");
            // TODO: Add max 7 day gap check if needed
            mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } }; filterDescription = `block range ${blockStart}-${blockEnd}`;
        } else if (blockMatch) {
            const b = parseInt(blockMatch[1]); if (isNaN(b)) throw new Error("Invalid block number.");
            mongoFilter = { block: b }; filterDescription = `block ${b}`;
        } else if (latestBlockDirectMatch || addressLatestBlockMatch || latestCommandMatch) { // <<< GROUP 'LATEST BLOCK' INTENTS
             requiresLatestBlockLookup = true; // Signal handler to find block number FIRST
             if (addressLatestBlockMatch) {
                 const addr = addressLatestBlockMatch[1];
                 if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}$/i.test(addr)) throw new Error("Invalid address format.");
                 mongoFilter = { $or: [{ from: addr }, { to: addr }] }; // Set address filter initially
                 filterDescription = `address ${addr.substring(0, 6)}... in latest block`;
             } else { // Handle '!whale latest block' or just '!whale latest'
                  filterDescription = "latest block"; // Desc updated later by handler
                  // Keep mongoFilter = {} for now
             }
        } else if (mostActiveMatch) { // Handle specific command before general time/address
            requiresMostActiveCheck = true; filterDescription = "most active last hour";
            const s = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000); mongoFilter = { _id: { $gte: ObjectId.createFromTime(s) } }; // Time filter for helper
        } else if (addressTimeMatch) {
            const addr = addressTimeMatch[1]; const timeQueryPart = addressTimeMatch[2];
            if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60}$/i.test(addr)) throw new Error("Invalid address format.");
            const addressFilter = { $or: [{ from: addr }, { to: addr }] }; let timeFilterPart = {}; let timeDesc = "";
            const numMatch = timeQueryPart.match(/last\s+(\d+)\s+(hour|day)/); // Only hours/days specified for address combo
            if (numMatch) { const num = parseInt(numMatch[1]); const unit = numMatch[2]; if (!isNaN(num) && num > 0 && ((unit === 'hour' && num <= 24) || (unit === 'day' && num <= 7))) { const mult = unit === 'hour' ? 3600000 : 86400000; const startS = Math.floor((now.getTime() - num * mult) / 1000); timeFilterPart = { _id: { $gte: ObjectId.createFromTime(startS) } }; timeDesc = `last ${num} ${unit}(s)`; } else { throw new Error(`Invalid range for ${unit} (1-24h, 1-7d).`); } }
            else if (timeQueryPart === 'today') { /*...*/ const s=new Date(now); s.setHours(0,0,0,0); timeFilterPart={_id:{$gte:ObjectId.createFromTime(Math.floor(s.getTime()/1000))}}; timeDesc="today"; }
            else if (timeQueryPart === 'yesterday') { /*...*/ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); const startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); const endS=Math.floor(e.getTime()/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS),$lte:ObjectId.createFromTime(endS)}}; timeDesc="yesterday"; }
            else if (timeQueryPart.includes("last hour")) { /*...*/ const startS=Math.floor((now.getTime()-60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last hour"; }
            else if (timeQueryPart.includes("last day") || timeQueryPart.includes("last 24 hours")) { /*...*/ const startS=Math.floor((now.getTime()-24*60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last 24 hours"; }
            else if (timeQueryPart.includes("last week") || timeQueryPart.includes("last 7 days")) { /*...*/ const startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); timeFilterPart={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDesc="last 7 days"; }
            if (Object.keys(timeFilterPart).length > 0) { mongoFilter = { $and: [addressFilter, timeFilterPart] }; filterDescription = `address ${addr.substring(0, 6)}... (${timeDesc})`; }
            else { throw new Error("Could not parse time range for address query."); }
        } else if (addressMatch && Object.keys(mongoFilter).length === 0) { // Address only (apply default time range)
            const a = addressMatch[1]; mongoFilter = { $or: [{ from: a }, { to: a }] };
            const s = Math.floor((now.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000); // Default last 3 days
            mongoFilter = { $and: [mongoFilter, { _id: { $gte: ObjectId.createFromTime(s) } }] };
            filterDescription = `address ${a.substring(0, 6)}... (last 3 days)`;
        } else if (lastHourMatch) { // Time only
             const s = Math.floor((now.getTime() - 60*60*1000)/1000); mongoFilter = {_id: {$gte: ObjectId.createFromTime(s)}}; filterDescription="last hour";
        } else if (timeMatch) { // Other times only
             let startSeconds; let endSeconds = null; const timeQuery=timeMatch[0]; const numMatch = timeQuery.match(/last\s+(\d+)\s+(hour|day|week|month)/); // Check specific N units first
             if (numMatch) { /* ... parse num/unit, check limits ... */ startSeconds=Math.floor((now.getTime() - num * mult)/1000); filterDescription=`last ${num} ${unit}(s)`;}
             else if (timeQuery === 'today') { /*...*/ startSeconds=Math.floor(new Date(now.setHours(0,0,0,0))/1000); filterDescription = "today"; }
             else if (timeQuery === 'yesterday') { /*...*/ const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startSeconds=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endSeconds=Math.floor(e.getTime()/1000); filterDescription = "yesterday"; }
             else if (timeQuery === 'last 24 hours' || timeQuery === 'last day') { /*...*/ startSeconds=Math.floor((now.getTime()-24*60*60*1000)/1000); filterDescription="last 24 hours";}
             else if (timeQuery === 'last week' || timeQuery === 'last 7 days') { /*...*/ startSeconds=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days";}
             else if (timeQuery === 'last month' || timeQuery === 'last 30 days') { /*...*/ startSeconds=Math.floor((now.getTime()-30*24*60*60*1000)/1000); filterDescription="last 30 days";}
             if(startSeconds!==undefined){ const sO=ObjectId.createFromTime(startSeconds); if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; } else { mongoFilter={_id:{$gte:sO}}; } } else { /* Use default or error */ }
             if (Object.keys(mongoFilter).length === 0) {parseError="Could not parse time range.";} // Error if time match but no filter set
        } else if (valueMatch && Object.keys(mongoFilter).length === 0) { // Value only
             try { const op=valueMatch[1]; const v=parseInt(valueMatch[2]); if(!isNaN(v)){ let mOp; switch(op){/*...*/} mongoFilter={value:{[mOp]:v}}; filterDescription=`value ${op} ${v}`; sortOverride={value:-1}; } else {throw new Error("Invalid value");}} catch(e){throw e;}
        }
        // If NO filter has been set by any specific command structure, it's invalid
        else if (Object.keys(mongoFilter).length === 0 && !requiresLatestBlockLookup && !requiresMostActiveCheck) {
            parseError = "Unknown command format or parameters. Use !help for examples.";
        }

    } catch (error) {
        parseError = error.message || "Failed to parse query parameters.";
    }

    // Final check and return
    if (parseError) {
        console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
        return { parseError };
    } else {
        console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestBlockLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}`);
        return { mongoFilter, filterDescription, sortOverride, requiresLatestBlockLookup, requiresMostActiveCheck, parseError: null };
    }
}

module.exports = { parseWhaleQuery };