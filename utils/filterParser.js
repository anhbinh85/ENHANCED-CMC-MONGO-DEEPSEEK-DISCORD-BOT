// // utils/filterParser.js
// const { ObjectId } = require('mongodb'); // Needs mongodb ObjectId

// /**
//  * Parses the !whale command query string precisely based on defined formats.
//  * @param {string} userQuery - The query text after "!whale ".
//  * @returns {{mongoFilter: object, filterDescription: string, requiresLatestBlockLookup: boolean, requiresMostActiveCheck: boolean, sortOverride: object|null, limitOverride: number|null, parseError: string|null}}
//  */
// function parseWhaleQuery(userQuery) {
//     let mongoFilter = {};
//     let filterDescription = "";
//     let requiresLatestBlockLookup = false;
//     let requiresMostActiveCheck = false;
//     let sortOverride = null;
//     let limitOverride = null;
//     let parseError = null;

//     const lowerCaseQuery = userQuery.toLowerCase().trim();
//     const now = new Date();

//     // --- Define Regex patterns for specific commands ---
//     // Order matters - more specific patterns first
//     const patterns = [
//         { name: 'TX_HASH', regex: /^(?:txhash|hash)\s+([a-fA-F0-9]{64})$/i },
//         { name: 'ADDRESS_LATEST', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+latest$/i },
//         { name: 'ADDRESS_TIME_RANGE', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+(hour|day)s?$/i },
//         { name: 'ADDRESS_TIME_WORD', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+(today|yesterday|last\s+week|last\s+7\s+days)$/i }, // Added last week/7 days
//         { name: 'ADDRESS_ONLY', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
//         { name: 'BLOCK_RANGE', regex: /^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i },
//         { name: 'BLOCK_SINGLE', regex: /^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i },
//         { name: 'LATEST_BLOCK_DIRECT', regex: /^latest\s+block$/i },
//         { name: 'LATEST_ALIAS', regex: /^(latest|latest\s+transfers)$/i },
//         { name: 'MOST_ACTIVE', regex: /^most\s+active\s+last\s+hour$/i },
//         { name: 'TIME_RANGE', regex: /^last\s+(\d+)\s+(hour|day)s?$/i }, // Specific hour/day range
//         { name: 'TIME_WORD', regex: /^(last\s+hour|past\s+hour|today|yesterday|last\s+week|last\s+7\s+days)$/i } // Specific word ranges
//         // Note: Value filter removed as standalone, could be added back or combined if needed
//     ];

//     let matchFound = false;

//     try {
//         for (const p of patterns) {
//             const match = lowerCaseQuery.match(p.regex);
//             if (match) {
//                 console.log(`[FilterParser] Matched pattern: ${p.name}`);
//                 matchFound = true;
//                 let addr, num, unit, startS, endS, blockStart, blockEnd; // Declare vars locally

//                 switch (p.name) {
//                     case 'TX_HASH':
//                         mongoFilter = { txHash: match[1] };
//                         filterDescription = `transaction ${match[1].substring(0, 8)}...`;
//                         limitOverride = 1;
//                         break;

//                     case 'ADDRESS_LATEST':
//                         addr = match[1];
//                         requiresLatestBlockLookup = true;
//                         mongoFilter = { $or: [{ from: addr }, { to: addr }] };
//                         filterDescription = `address ${addr.substring(0, 6)}... in latest block`;
//                         break;

//                     case 'ADDRESS_TIME_RANGE':
//                         addr = match[1];
//                         num = parseInt(match[2], 10);
//                         unit = match[3];
//                         if (unit === 'hour' && num >= 1 && num <= 24) {
//                             startS = Math.floor((now.getTime() - num * 3600000) / 1000);
//                         } else if (unit === 'day' && num >= 1 && num <= 7) {
//                             startS = Math.floor((now.getTime() - num * 86400000) / 1000);
//                         } else {
//                             throw new Error(`Invalid range for ${unit}: must be 1-24 hours or 1-7 days.`);
//                         }
//                         mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, { _id: { $gte: ObjectId.createFromTime(startS) } } ] };
//                         filterDescription = `address ${addr.substring(0, 6)}... (last ${num} ${unit}${num > 1 ? 's' : ''})`;
//                         break;

//                      case 'ADDRESS_TIME_WORD':
//                         addr = match[1];
//                         const timeWordAddr = match[2];
//                         let timeFilterPartAddr = {};
//                         let timeDescAddr = "";
//                         if (timeWordAddr === 'today') { const s=new Date(now); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDescAddr="today"; }
//                         else if (timeWordAddr === 'yesterday') { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endS=Math.floor(e.getTime()/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS),$lte:ObjectId.createFromTime(endS)}}; timeDescAddr="yesterday"; }
//                         else if (timeWordAddr === 'last week' || timeWordAddr === 'last 7 days') { startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); timeFilterPartAddr={_id:{$gte:ObjectId.createFromTime(startS)}}; timeDescAddr="last 7 days"; }
//                         else { throw new Error(`Unhandled time word for address: ${timeWordAddr}`);}
//                         mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, timeFilterPartAddr ] };
//                         filterDescription = `address ${addr.substring(0, 6)}... (${timeDescAddr})`;
//                         break;

//                     case 'ADDRESS_ONLY': // Apply default time range (e.g., last 3 days)
//                         addr = match[1];
//                         startS = Math.floor((now.getTime() - 3 * 86400000) / 1000); // 3 days
//                         mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, { _id: { $gte: ObjectId.createFromTime(startS) } } ] };
//                         filterDescription = `address ${addr.substring(0, 6)}... (default: last 3 days)`;
//                         break;

//                     case 'BLOCK_RANGE':
//                         blockStart = parseInt(match[1], 10);
//                         blockEnd = parseInt(match[2], 10);
//                         if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) throw new Error("Invalid block range.");
//                         // Note: 7-day gap check omitted due to complexity
//                         mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } };
//                         filterDescription = `block range ${blockStart}-${blockEnd} (Note: 7-day gap check not applied)`;
//                         break;

//                     case 'BLOCK_SINGLE':
//                         const b = parseInt(match[1], 10);
//                         if (isNaN(b)) throw new Error("Invalid block number.");
//                         mongoFilter = { block: b };
//                         filterDescription = `block ${b}`;
//                         break;

//                     case 'LATEST_BLOCK_DIRECT':
//                     case 'LATEST_ALIAS':
//                         requiresLatestBlockLookup = true;
//                         filterDescription = "latest block"; // Handler will refine this
//                         break;

//                     case 'MOST_ACTIVE':
//                         requiresMostActiveCheck = true;
//                         filterDescription = "most active last hour";
//                         startS = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000); // 1 hour
//                         mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } }; // Time filter for the helper
//                         break;

//                     case 'TIME_RANGE':
//                         num = parseInt(match[1], 10);
//                         unit = match[2];
//                         if (unit === 'hour' && num >= 1 && num <= 24) {
//                             startS = Math.floor((now.getTime() - num * 3600000) / 1000);
//                         } else if (unit === 'day' && num >= 1 && num <= 7) {
//                             startS = Math.floor((now.getTime() - num * 86400000) / 1000);
//                         } else {
//                             throw new Error(`Invalid range: must be 1-24 hours or 1-7 days.`);
//                         }
//                         mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                         filterDescription = `last ${num} ${unit}${num > 1 ? 's' : ''}`;
//                         break;

//                      case 'TIME_WORD':
//                         const timeWord = match[1];
//                         if (timeWord === 'last hour' || timeWord === 'past hour') { startS = Math.floor((now.getTime() - 60*60*1000)/1000); filterDescription="last hour"; }
//                         else if (timeWord === 'today') { const s=new Date(now); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); filterDescription = "today"; }
//                         else if (timeWord === 'yesterday') { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endS=Math.floor(e.getTime()/1000); }
//                         else if (timeWord === 'last week' || timeWord === 'last 7 days') { startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days"; }
//                         else { throw new Error(`Unhandled time word: ${timeWord}`);} // Should not happen if regex matches

//                         if(startSeconds!==undefined){
//                             const sO=ObjectId.createFromTime(startSeconds);
//                             if(endSeconds!==null){ const eO=ObjectId.createFromTime(endSeconds); mongoFilter={_id:{$gte:sO,$lte:eO}}; }
//                             else { mongoFilter={_id:{$gte:sO}}; }
//                         } else { throw new Error(`Could not calculate start time for ${timeWord}`); }
//                         break;
//                 }
//                 break; // Exit loop once a match is found
//             }
//         } // End for loop

//         // If no specific pattern matched
//         if (!matchFound) {
//             parseError = "Unknown command format. Use `!help` for examples.";
//         }

//     } catch (error) {
//         parseError = error.message || "Failed to parse query parameters.";
//     }

//     // Final check and return
//     if (parseError) {
//         console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
//         return { parseError }; // Return only error if parsing failed
//     } else {
//         console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestBlockLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}`);
//         return { mongoFilter, filterDescription, sortOverride, limitOverride, requiresLatestBlockLookup, requiresMostActiveCheck, parseError: null };
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
        { name: 'TX_HASH', regex: /^(?:txhash|hash)\s+([a-fA-F0-9]{64})$/i }, // Handles txhash or hash prefix
        { name: 'ADDRESS_LATEST', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+latest$/i },
        { name: 'ADDRESS_TIME_RANGE', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+(hour|day)s?$/i },
        { name: 'ADDRESS_TIME_WORD', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+(today|yesterday|last\s+week|last\s+7\s+days)$/i },
        { name: 'ADDRESS_ONLY', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
        { name: 'BLOCK_RANGE', regex: /^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i },
        { name: 'BLOCK_SINGLE', regex: /^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i },
        { name: 'LATEST_BLOCK_DIRECT', regex: /^latest\s+block$/i },
        { name: 'LATEST_ALIAS', regex: /^(latest|latest\s+transfers)$/i },
        // --- Added MOST_ACTIVE_TIME_RANGE with higher priority ---
        { name: 'MOST_ACTIVE_TIME_RANGE', regex: /^most\s+active\s+last\s+(\d+)\s+hours?$/i },
        { name: 'MOST_ACTIVE', regex: /^most\s+active\s+last\s+hour$/i }, // Keep specific one as fallback? Or remove if redundant
        // --- End Addition ---
        { name: 'TIME_RANGE', regex: /^last\s+(\d+)\s+(hour|day)s?$/i },
        { name: 'TIME_WORD', regex: /^(last\s+hour|past\s+hour|today|yesterday|last\s+week|last\s+7\s+days)$/i }
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

                    case 'ADDRESS_ONLY':
                        addr = match[1];
                        startS = Math.floor((now.getTime() - 3 * 86400000) / 1000); // Default 3 days
                        mongoFilter = { $and: [ { $or: [{ from: addr }, { to: addr }] }, { _id: { $gte: ObjectId.createFromTime(startS) } } ] };
                        filterDescription = `address ${addr.substring(0, 6)}... (default: last 3 days)`;
                        break;

                    case 'BLOCK_RANGE':
                        blockStart = parseInt(match[1], 10);
                        blockEnd = parseInt(match[2], 10);
                        if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) throw new Error("Invalid block range.");
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

                    // --- Handle new "most active X hours" ---
                    case 'MOST_ACTIVE_TIME_RANGE':
                        num = parseInt(match[1], 10);
                        unit = 'hour';
                        if (num >= 1 && num <= 24) {
                            requiresMostActiveCheck = true;
                            filterDescription = `most active last ${num} hour${num > 1 ? 's' : ''}`;
                            startS = Math.floor((now.getTime() - num * 3600000) / 1000);
                            mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        } else {
                            throw new Error(`Invalid range for 'most active': hours must be between 1 and 24.`);
                        }
                        break;

                    case 'MOST_ACTIVE': // Handles specific "most active last hour"
                        requiresMostActiveCheck = true;
                        filterDescription = "most active last hour";
                        startS = Math.floor((now.getTime() - 60 * 60 * 1000) / 1000); // 1 hour
                        mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        break;
                    // --- End handle ---

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
                        const timeWord = match[1]; // Use match[1] as group(0) is the full match
                        if (timeWord === 'last hour' || timeWord === 'past hour') { startS = Math.floor((now.getTime() - 60*60*1000)/1000); filterDescription="last hour"; }
                        else if (timeWord === 'today') { const s=new Date(now); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); filterDescription = "today"; }
                        else if (timeWord === 'yesterday') { const s=new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0); startS=Math.floor(s.getTime()/1000); const e=new Date(s); e.setHours(23,59,59,999); endS=Math.floor(e.getTime()/1000); }
                        else if (timeWord === 'last week' || timeWord === 'last 7 days') { startS=Math.floor((now.getTime()-7*24*60*60*1000)/1000); filterDescription="last 7 days"; }
                        else { throw new Error(`Unhandled time word: ${timeWord}`);}

                        if(startS !== undefined){ // Corrected variable name
                            const sO=ObjectId.createFromTime(startS);
                            if(endS !== undefined && endS !== null){ // Corrected variable name
                                const eO=ObjectId.createFromTime(endS);
                                mongoFilter={_id:{$gte:sO,$lte:eO}};
                            } else {
                                mongoFilter={_id:{$gte:sO}};
                            }
                        } else { throw new Error(`Could not calculate start time for ${timeWord}`); }
                        break;
                }
                break; // Exit loop once a match is found
            }
        } // End for loop

        // If no specific pattern matched
        if (!matchFound) {
            // Apply a default filter if absolutely nothing matched
             const defaultStartS = Math.floor((now.getTime() - 24 * 3600000) / 1000); // Default to last 24 hours if query is invalid
             mongoFilter = { _id: { $gte: ObjectId.createFromTime(defaultStartS) } };
             filterDescription = "latest activity (default: last 24h - unknown query)";
             console.warn(`[FilterParser] Unknown command format: "${userQuery}". Defaulting to last 24 hours.`);
            // parseError = "Unknown command format. Use `!help` for examples."; // Alternatively, force error
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