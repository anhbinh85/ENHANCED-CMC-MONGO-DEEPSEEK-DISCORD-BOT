// // utils/filterParser.js
// const { ObjectId } = require('mongodb');

// /**
//  * Parses the !whale command query string precisely based on defined formats.
//  *
//  * @param {string} userQuery - The query text after "!whale ".
//  * @returns {{
//  * mongoFilter: object,
//  * filterDescription: string,
//  * requiresLatestBlockLookup: boolean,
//  * requiresMostActiveCheck: boolean,
//  * requiresRelationCheck: boolean,
//  * requiresBalanceCheck: boolean,
//  * targetAddress: string | null,
//  * sortOverride: object | null,
//  * limitOverride: number | null,
//  * parseError: string | null
//  * }} An object containing the parsed filter components or a parse error.
//  */
// function parseWhaleQuery(userQuery) {
//     let mongoFilter = {};
//     let filterDescription = "";
//     let requiresLatestBlockLookup = false;
//     let requiresMostActiveCheck = false;
//     let requiresRelationCheck = false;
//     let requiresBalanceCheck = false; // Flag for balance check
//     let targetAddress = null;
//     let sortOverride = null;
//     let limitOverride = null;
//     let parseError = null;

//     const lowerCaseQuery = userQuery.toLowerCase().trim();
//     const now = new Date();

//     // --- Time Constants ---
//     const ONE_HOUR_MS = 60 * 60 * 1000;
//     const ONE_DAY_MS = 24 * ONE_HOUR_MS;
//     const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
//     const THREE_DAYS_MS = 3 * ONE_DAY_MS;

//     // --- Regex Patterns (Order matters - more specific patterns first) ---
//     const patterns = [
//         // Specific Checks
//         { name: 'BALANCE_CHECK', regex: /^balance\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
//         { name: 'RELATION_CHECK', regex: /^cluster\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+hours?$/i },
//         { name: 'TX_HASH', regex: /^(?:txhash|hash)\s+([a-fA-F0-9]{64})$/i },
//         // Address Specific
//         { name: 'ADDRESS_LATEST', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+latest$/i },
//         { name: 'ADDRESS_TIME_RANGE', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+(hour|day)s?$/i },
//         { name: 'ADDRESS_TIME_WORD', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+(today|yesterday|last\s+week|last\s+7\s+days)$/i },
//         { name: 'ADDRESS_ONLY', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
//         // Block Specific
//         { name: 'BLOCK_RANGE', regex: /^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i },
//         { name: 'BLOCK_SINGLE', regex: /^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i },
//         { name: 'LATEST_BLOCK_DIRECT', regex: /^latest\s+block$/i },
//         { name: 'LATEST_ALIAS', regex: /^(latest|latest\s+transfers)$/i },
//         // Activity Specific
//         { name: 'MOST_ACTIVE_TIME_RANGE', regex: /^most\s+active\s+last\s+(\d+)\s+hours?$/i },
//         { name: 'MOST_ACTIVE', regex: /^most\s+active\s+last\s+hour$/i },
//         // General Time Based
//         { name: 'TIME_RANGE', regex: /^last\s+(\d+)\s+(hour|day)s?$/i },
//         { name: 'TIME_WORD', regex: /^(last\s+hour|past\s+hour|today|yesterday|last\s+week|last\s+7\s+days)$/i }
//         // Note: Value match removed for simplicity as per original code comment
//     ];

//     let matchFound = false;

//     try {
//         for (const p of patterns) {
//             const match = lowerCaseQuery.match(p.regex);
//             if (match) {
//                 console.log(`[FilterParser] Matched pattern: ${p.name}`);
//                 matchFound = true;
//                 let addr, num, unit, startS, endS, blockStart, blockEnd, timeWord;

//                 switch (p.name) {
//                     case 'BALANCE_CHECK':
//                         targetAddress = match[1];
//                         requiresBalanceCheck = true;
//                         filterDescription = `balance for ${targetAddress.substring(0, 6)}...`;
//                         mongoFilter = {}; // No DB filter needed for this specific check type initially
//                         break;

//                     case 'RELATION_CHECK':
//                         targetAddress = match[1];
//                         num = parseInt(match[2], 10);
//                         unit = 'hour'; // Implicitly hours from regex
//                         if (num >= 1 && num <= 24) {
//                             requiresRelationCheck = true;
//                             filterDescription = `relations for ${targetAddress.substring(0, 6)}... last ${num} hour${num > 1 ? 's' : ''}`;
//                             startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
//                             mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                         } else {
//                             throw new Error(`Invalid range for 'cluster': hours must be between 1 and 24.`);
//                         }
//                         break;

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
//                             startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
//                         } else if (unit === 'day' && num >= 1 && num <= 7) {
//                             startS = Math.floor((now.getTime() - num * ONE_DAY_MS) / 1000);
//                         } else {
//                             throw new Error(`Invalid range for ${unit}: must be 1-24 hours or 1-7 days.`);
//                         }
//                         mongoFilter = {
//                             $and: [
//                                 { $or: [{ from: addr }, { to: addr }] },
//                                 { _id: { $gte: ObjectId.createFromTime(startS) } }
//                             ]
//                         };
//                         filterDescription = `address ${addr.substring(0, 6)}... (last ${num} ${unit}${num > 1 ? 's' : ''})`;
//                         break;

//                     case 'ADDRESS_TIME_WORD': { // Use block scope for clarity
//                         addr = match[1];
//                         timeWord = match[2];
//                         let timeFilterPartAddr = {};
//                         let timeDescAddr = "";

//                         if (timeWord === 'today') {
//                             const startOfDay = new Date(now);
//                             startOfDay.setHours(0, 0, 0, 0);
//                             startS = Math.floor(startOfDay.getTime() / 1000);
//                             timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                             timeDescAddr = "today";
//                         } else if (timeWord === 'yesterday') {
//                             const startOfYesterday = new Date(now);
//                             startOfYesterday.setDate(now.getDate() - 1);
//                             startOfYesterday.setHours(0, 0, 0, 0);
//                             startS = Math.floor(startOfYesterday.getTime() / 1000);

//                             const endOfYesterday = new Date(startOfYesterday);
//                             endOfYesterday.setHours(23, 59, 59, 999);
//                             endS = Math.floor(endOfYesterday.getTime() / 1000);

//                             timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS), $lte: ObjectId.createFromTime(endS) } };
//                             timeDescAddr = "yesterday";
//                         } else if (timeWord === 'last week' || timeWord === 'last 7 days') {
//                             startS = Math.floor((now.getTime() - SEVEN_DAYS_MS) / 1000);
//                             timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                             timeDescAddr = "last 7 days";
//                         } else {
//                             throw new Error(`Unhandled time word for address: ${timeWord}`);
//                         }
//                         mongoFilter = {
//                             $and: [
//                                 { $or: [{ from: addr }, { to: addr }] },
//                                 timeFilterPartAddr
//                             ]
//                         };
//                         filterDescription = `address ${addr.substring(0, 6)}... (${timeDescAddr})`;
//                         break;
//                     } // End block scope for ADDRESS_TIME_WORD

//                     case 'ADDRESS_ONLY': // Default to last 3 days
//                         addr = match[1];
//                         startS = Math.floor((now.getTime() - THREE_DAYS_MS) / 1000);
//                         mongoFilter = {
//                             $and: [
//                                 { $or: [{ from: addr }, { to: addr }] },
//                                 { _id: { $gte: ObjectId.createFromTime(startS) } }
//                             ]
//                         };
//                         filterDescription = `address ${addr.substring(0, 6)}... (default: last 3 days)`;
//                         break;

//                     case 'BLOCK_RANGE':
//                         blockStart = parseInt(match[1], 10);
//                         blockEnd = parseInt(match[2], 10);
//                         if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) {
//                             throw new Error("Invalid block range.");
//                         }
//                         mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } };
//                         filterDescription = `block range ${blockStart}-${blockEnd}`; // Removed note for brevity, was in original
//                         break;

//                     case 'BLOCK_SINGLE':
//                         const blockNum = parseInt(match[1], 10);
//                         if (isNaN(blockNum)) {
//                              throw new Error("Invalid block number.");
//                         }
//                         mongoFilter = { block: blockNum };
//                         filterDescription = `block ${blockNum}`;
//                         break;

//                     case 'LATEST_BLOCK_DIRECT':
//                     case 'LATEST_ALIAS':
//                         requiresLatestBlockLookup = true;
//                         filterDescription = "latest block";
//                         mongoFilter = {}; // Actual block number is added later
//                         break;

//                     case 'MOST_ACTIVE_TIME_RANGE':
//                         num = parseInt(match[1], 10);
//                         unit = 'hour'; // Implicitly hours
//                         if (num >= 1 && num <= 24) {
//                             requiresMostActiveCheck = true;
//                             filterDescription = `most active last ${num} hour${num > 1 ? 's' : ''}`;
//                             startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
//                             mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                         } else {
//                             throw new Error(`Invalid range for 'most active': hours must be between 1 and 24.`);
//                         }
//                         break;

//                     case 'MOST_ACTIVE': // Default to last hour
//                         requiresMostActiveCheck = true;
//                         filterDescription = "most active last hour";
//                         startS = Math.floor((now.getTime() - ONE_HOUR_MS) / 1000);
//                         mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                         break;

//                     case 'TIME_RANGE':
//                         num = parseInt(match[1], 10);
//                         unit = match[2];
//                         if (unit === 'hour' && num >= 1 && num <= 24) {
//                             startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
//                         } else if (unit === 'day' && num >= 1 && num <= 7) {
//                             startS = Math.floor((now.getTime() - num * ONE_DAY_MS) / 1000);
//                         } else {
//                             throw new Error(`Invalid range: must be 1-24 hours or 1-7 days.`);
//                         }
//                         mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
//                         filterDescription = `last ${num} ${unit}${num > 1 ? 's' : ''}`;
//                         break;

//                     case 'TIME_WORD': { // Use block scope
//                         timeWord = match[0]; // Full match is the word(s)
//                         startS = undefined; // Reset start/end times
//                         endS = undefined;

//                         if (timeWord === 'last hour' || timeWord === 'past hour') {
//                             startS = Math.floor((now.getTime() - ONE_HOUR_MS) / 1000);
//                             filterDescription = "last hour";
//                         } else if (timeWord === 'today') {
//                             const startOfDay = new Date(now);
//                             startOfDay.setHours(0, 0, 0, 0);
//                             startS = Math.floor(startOfDay.getTime() / 1000);
//                             filterDescription = "today";
//                         } else if (timeWord === 'yesterday') {
//                             const startOfYesterday = new Date(now);
//                             startOfYesterday.setDate(now.getDate() - 1);
//                             startOfYesterday.setHours(0, 0, 0, 0);
//                             startS = Math.floor(startOfYesterday.getTime() / 1000);

//                             const endOfYesterday = new Date(startOfYesterday);
//                             endOfYesterday.setHours(23, 59, 59, 999);
//                             endS = Math.floor(endOfYesterday.getTime() / 1000);
//                             filterDescription = "yesterday"; // Set description here
//                         } else if (timeWord === 'last week' || timeWord === 'last 7 days') {
//                             startS = Math.floor((now.getTime() - SEVEN_DAYS_MS) / 1000);
//                             filterDescription = "last 7 days";
//                         } else {
//                             throw new Error(`Unhandled time word: ${timeWord}`);
//                         }

//                         // Construct filter based on calculated start/end times
//                         if (startS !== undefined) {
//                             const startObjectId = ObjectId.createFromTime(startS);
//                             if (endS !== undefined && endS !== null) {
//                                 const endObjectId = ObjectId.createFromTime(endS);
//                                 mongoFilter = { _id: { $gte: startObjectId, $lte: endObjectId } };
//                             } else {
//                                 mongoFilter = { _id: { $gte: startObjectId } };
//                             }
//                         } else {
//                             // This case should ideally not be reached if logic above is correct
//                             throw new Error(`Could not calculate start time for ${timeWord}`);
//                         }
//                         break;
//                     } // End block scope for TIME_WORD

//                 } // End switch
//                 break; // Exit the loop once a pattern is matched
//             } // End if(match)
//         } // End for loop

//         if (!matchFound && !parseError) {
//             // If no patterns matched and no error was thrown during parsing
//             parseError = "Unknown command format or invalid parameters. Use `!help` for examples.";
//         }

//     } catch (error) {
//         console.error(`[FilterParser] Error during parsing: ${error.message}`, error); // Log the stack trace too
//         parseError = error.message || "Failed to parse query parameters due to an unexpected error.";
//     }

//     // --- Final Result ---
//     if (parseError) {
//         console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
//         // Return only the error when parsing fails completely
//         return {
//             mongoFilter: {},
//             filterDescription: "",
//             requiresLatestBlockLookup: false,
//             requiresMostActiveCheck: false,
//             requiresRelationCheck: false,
//             requiresBalanceCheck: false,
//             targetAddress: null,
//             sortOverride: null,
//             limitOverride: null,
//             parseError: parseError
//         };
//     } else {
//         console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}, RelationCheck=${requiresRelationCheck}, BalanceCheck=${requiresBalanceCheck}, TargetAddr=${targetAddress}`);
//         return {
//             mongoFilter,
//             filterDescription,
//             sortOverride,
//             limitOverride,
//             requiresLatestBlockLookup,
//             requiresMostActiveCheck,
//             requiresRelationCheck,
//             requiresBalanceCheck,
//             targetAddress,
//             parseError: null // Explicitly null for success
//         };
//     }
// }

// module.exports = { parseWhaleQuery };

// utils/filterParser.js
const { ObjectId } = require('mongodb');

/**
 * Parses the !whale command query string precisely based on defined formats.
 *
 * @param {string} userQuery - The query text after "!whale ".
 * @returns {{
 * mongoFilter: object,
 * filterDescription: string,
 * requiresLatestBlockLookup: boolean,
 * requiresMostActiveCheck: boolean,
 * requiresRelationCheck: boolean,
 * requiresBalanceCheck: boolean,
 * requiresFeeCheck: boolean, // <-- Added Flag
 * targetAddress: string | null,
 * sortOverride: object | null,
 * limitOverride: number | null,
 * parseError: string | null
 * }} An object containing the parsed filter components or a parse error.
 */
function parseWhaleQuery(userQuery) {
    let mongoFilter = {};
    let filterDescription = "";
    let requiresLatestBlockLookup = false;
    let requiresMostActiveCheck = false;
    let requiresRelationCheck = false;
    let requiresBalanceCheck = false;
    let requiresFeeCheck = false; // <-- Added Flag
    let targetAddress = null;
    let sortOverride = null;
    let limitOverride = null;
    let parseError = null;

    const lowerCaseQuery = userQuery.toLowerCase().trim();
    const now = new Date();

    // --- Time Constants ---
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * ONE_HOUR_MS;
    const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
    const THREE_DAYS_MS = 3 * ONE_DAY_MS;

    // --- Regex Patterns (Order matters - more specific patterns first) ---
    const patterns = [
        // Specific Checks
        { name: 'FEE_CHECK', regex: /^fee$/i }, // <-- Added Pattern for !whale fee
        { name: 'BALANCE_CHECK', regex: /^balance\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
        { name: 'RELATION_CHECK', regex: /^cluster\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+hours?$/i },
        { name: 'TX_HASH', regex: /^(?:txhash|hash)\s+([a-fA-F0-9]{64})$/i },
        // Address Specific
        { name: 'ADDRESS_LATEST', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+latest$/i },
        { name: 'ADDRESS_TIME_RANGE', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+last\s+(\d+)\s+(hour|day)s?$/i },
        { name: 'ADDRESS_TIME_WORD', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})\s+(today|yesterday|last\s+week|last\s+7\s+days)$/i },
        { name: 'ADDRESS_ONLY', regex: /^address\s+((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,60})$/i },
        // Block Specific
        { name: 'BLOCK_RANGE', regex: /^(?:block|blocks)\s+(\d+)\s*(?:to|-)\s*(\d+)$/i },
        { name: 'BLOCK_SINGLE', regex: /^(?:block\sno\.?|block\snumber|in\sblock|block)\s+(\d+)$/i },
        { name: 'LATEST_BLOCK_DIRECT', regex: /^latest\s+block$/i },
        { name: 'LATEST_ALIAS', regex: /^(latest|latest\s+transfers)$/i },
        // Activity Specific
        { name: 'MOST_ACTIVE_TIME_RANGE', regex: /^most\s+active\s+last\s+(\d+)\s+hours?$/i },
        { name: 'MOST_ACTIVE', regex: /^most\s+active\s+last\s+hour$/i },
        // General Time Based
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
                let addr, num, unit, startS, endS, blockStart, blockEnd, timeWord;

                switch (p.name) {
                    case 'FEE_CHECK': // <-- Added Case
                        requiresFeeCheck = true;
                        filterDescription = "current network fees";
                        mongoFilter = {}; // No DB filter needed
                        break;

                    case 'BALANCE_CHECK':
                        targetAddress = match[1];
                        requiresBalanceCheck = true;
                        filterDescription = `balance for ${targetAddress.substring(0, 6)}...`;
                        mongoFilter = {}; // No DB filter needed
                        break;

                    case 'RELATION_CHECK':
                        targetAddress = match[1];
                        num = parseInt(match[2], 10);
                        unit = 'hour'; // Implicitly hours from regex
                        if (num >= 1 && num <= 24) {
                            requiresRelationCheck = true;
                            filterDescription = `relations for ${targetAddress.substring(0, 6)}... last ${num} hour${num > 1 ? 's' : ''}`;
                            startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
                            mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        } else {
                            throw new Error(`Invalid range for 'cluster': hours must be between 1 and 24.`);
                        }
                        break;

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
                            startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
                        } else if (unit === 'day' && num >= 1 && num <= 7) {
                            startS = Math.floor((now.getTime() - num * ONE_DAY_MS) / 1000);
                        } else {
                            throw new Error(`Invalid range for ${unit}: must be 1-24 hours or 1-7 days.`);
                        }
                        mongoFilter = {
                            $and: [
                                { $or: [{ from: addr }, { to: addr }] },
                                 { _id: { $gte: ObjectId.createFromTime(startS) } }
                            ]
                        };
                        filterDescription = `address ${addr.substring(0, 6)}... (last ${num} ${unit}${num > 1 ? 's' : ''})`;
                        break;

                     case 'ADDRESS_TIME_WORD': { // Use block scope for clarity
                        addr = match[1];
                        timeWord = match[2];
                        let timeFilterPartAddr = {};
                        let timeDescAddr = "";
                        if (timeWord === 'today') {
                            const startOfDay = new Date(now);
                            startOfDay.setHours(0, 0, 0, 0);
                            startS = Math.floor(startOfDay.getTime() / 1000);
                            timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS) } };
                            timeDescAddr = "today";
                        } else if (timeWord === 'yesterday') {
                            const startOfYesterday = new Date(now);
                            startOfYesterday.setDate(now.getDate() - 1);
                            startOfYesterday.setHours(0, 0, 0, 0);
                            startS = Math.floor(startOfYesterday.getTime() / 1000);

                            const endOfYesterday = new Date(startOfYesterday);
                            endOfYesterday.setHours(23, 59, 59, 999);
                            endS = Math.floor(endOfYesterday.getTime() / 1000);

                            timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS), $lte: ObjectId.createFromTime(endS) } };
                            timeDescAddr = "yesterday";
                        } else if (timeWord === 'last week' || timeWord === 'last 7 days') {
                            startS = Math.floor((now.getTime() - SEVEN_DAYS_MS) / 1000);
                            timeFilterPartAddr = { _id: { $gte: ObjectId.createFromTime(startS) } };
                            timeDescAddr = "last 7 days";
                        } else {
                            throw new Error(`Unhandled time word for address: ${timeWord}`);
                        }
                        mongoFilter = {
                            $and: [
                                { $or: [{ from: addr }, { to: addr }] },
                                 timeFilterPartAddr
                            ]
                        };
                        filterDescription = `address ${addr.substring(0, 6)}... (${timeDescAddr})`;
                        break;
                    } // End block scope for ADDRESS_TIME_WORD

                    case 'ADDRESS_ONLY': // Default to last 3 days
                        addr = match[1];
                        startS = Math.floor((now.getTime() - THREE_DAYS_MS) / 1000);
                        mongoFilter = {
                            $and: [
                                { $or: [{ from: addr }, { to: addr }] },
                                { _id: { $gte: ObjectId.createFromTime(startS) } }
                            ]
                        };
                        filterDescription = `address ${addr.substring(0, 6)}... (default: last 3 days)`;
                        break;

                    case 'BLOCK_RANGE':
                        blockStart = parseInt(match[1], 10);
                        blockEnd = parseInt(match[2], 10);
                        if (isNaN(blockStart) || isNaN(blockEnd) || blockEnd < blockStart) {
                            throw new Error("Invalid block range.");
                        }
                        mongoFilter = { block: { $gte: blockStart, $lte: blockEnd } };
                        filterDescription = `block range ${blockStart}-${blockEnd}`;
                        break;

                    case 'BLOCK_SINGLE':
                        const blockNum = parseInt(match[1], 10);
                        if (isNaN(blockNum)) {
                             throw new Error("Invalid block number.");
                        }
                        mongoFilter = { block: blockNum };
                        filterDescription = `block ${blockNum}`;
                        break;

                    case 'LATEST_BLOCK_DIRECT':
                    case 'LATEST_ALIAS':
                        requiresLatestBlockLookup = true;
                        filterDescription = "latest block";
                        mongoFilter = {}; // Actual block number is added later
                        break;

                    case 'MOST_ACTIVE_TIME_RANGE':
                        num = parseInt(match[1], 10);
                        unit = 'hour'; // Implicitly hours
                        if (num >= 1 && num <= 24) {
                            requiresMostActiveCheck = true;
                            filterDescription = `most active last ${num} hour${num > 1 ? 's' : ''}`;
                            startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
                            mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        } else {
                            throw new Error(`Invalid range for 'most active': hours must be between 1 and 24.`);
                        }
                        break;

                    case 'MOST_ACTIVE': // Default to last hour
                        requiresMostActiveCheck = true;
                        filterDescription = "most active last hour";
                        startS = Math.floor((now.getTime() - ONE_HOUR_MS) / 1000);
                        mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        break;

                    case 'TIME_RANGE':
                        num = parseInt(match[1], 10);
                        unit = match[2];
                        if (unit === 'hour' && num >= 1 && num <= 24) {
                            startS = Math.floor((now.getTime() - num * ONE_HOUR_MS) / 1000);
                        } else if (unit === 'day' && num >= 1 && num <= 7) {
                            startS = Math.floor((now.getTime() - num * ONE_DAY_MS) / 1000);
                        } else {
                            throw new Error(`Invalid range: must be 1-24 hours or 1-7 days.`);
                        }
                        mongoFilter = { _id: { $gte: ObjectId.createFromTime(startS) } };
                        filterDescription = `last ${num} ${unit}${num > 1 ? 's' : ''}`;
                        break;

                    case 'TIME_WORD': { // Use block scope
                        timeWord = match[0]; // Full match is the word(s)
                        startS = undefined; // Reset start/end times
                        endS = undefined;

                        if (timeWord === 'last hour' || timeWord === 'past hour') {
                            startS = Math.floor((now.getTime() - ONE_HOUR_MS) / 1000);
                            filterDescription = "last hour";
                        } else if (timeWord === 'today') {
                            const startOfDay = new Date(now);
                            startOfDay.setHours(0, 0, 0, 0);
                            startS = Math.floor(startOfDay.getTime() / 1000);
                            filterDescription = "today";
                        } else if (timeWord === 'yesterday') {
                            const startOfYesterday = new Date(now);
                            startOfYesterday.setDate(now.getDate() - 1);
                            startOfYesterday.setHours(0, 0, 0, 0);
                            startS = Math.floor(startOfYesterday.getTime() / 1000);

                            const endOfYesterday = new Date(startOfYesterday);
                            endOfYesterday.setHours(23, 59, 59, 999);
                            endS = Math.floor(endOfYesterday.getTime() / 1000);
                            filterDescription = "yesterday";
                        } else if (timeWord === 'last week' || timeWord === 'last 7 days') {
                            startS = Math.floor((now.getTime() - SEVEN_DAYS_MS) / 1000);
                            filterDescription = "last 7 days";
                        } else {
                            throw new Error(`Unhandled time word: ${timeWord}`);
                        }

                        // Construct filter based on calculated start/end times
                        if (startS !== undefined) {
                            const startObjectId = ObjectId.createFromTime(startS);
                            if (endS !== undefined && endS !== null) {
                                const endObjectId = ObjectId.createFromTime(endS);
                                mongoFilter = { _id: { $gte: startObjectId, $lte: endObjectId } };
                            } else {
                                mongoFilter = { _id: { $gte: startObjectId } };
                            }
                        } else {
                            throw new Error(`Could not calculate start time for ${timeWord}`);
                        }
                        break;
                    } // End block scope for TIME_WORD

                } // End switch
                break; // Exit the loop once a pattern is matched
            } // End if(match)
        } // End for loop

        if (!matchFound && !parseError) {
             // If no patterns matched, assume default 'latest' behaviour if query isn't empty
             if(userQuery.length > 0) {
                console.warn(`[FilterParser] Unknown command format: "${userQuery}". Defaulting to 'latest'.`);
                requiresLatestBlockLookup = true;
                filterDescription = "latest block (default)";
                mongoFilter = {};
             } else {
                // Handle empty query case if needed, maybe default to help?
                parseError = "Empty query. Use `!help` for examples.";
             }
        }

    } catch (error) {
        console.error(`[FilterParser] Error during parsing: ${error.message}`, error); // Log the stack trace too
        parseError = error.message || "Failed to parse query parameters due to an unexpected error.";
    }

    // --- Final Result ---
    if (parseError) {
        console.warn(`[FilterParser] Parse Error: ${parseError} | Query: "${userQuery}"`);
        // Return only the error when parsing fails completely
        return {
            mongoFilter: {}, filterDescription: "", requiresLatestBlockLookup: false,
            requiresMostActiveCheck: false, requiresRelationCheck: false,
            requiresBalanceCheck: false, requiresFeeCheck: false, // Add flag
            targetAddress: null, sortOverride: null, limitOverride: null,
            parseError: parseError
        };
    } else {
         console.log(`[FilterParser] Parsed Result: Desc='${filterDescription}', Filter='${JSON.stringify(mongoFilter)}', LatestLookup=${requiresLatestBlockLookup}, MostActive=${requiresMostActiveCheck}, RelationCheck=${requiresRelationCheck}, BalanceCheck=${requiresBalanceCheck}, FeeCheck=${requiresFeeCheck}, TargetAddr=${targetAddress}`); // Add flag
        return {
            mongoFilter, filterDescription, sortOverride, limitOverride,
            requiresLatestBlockLookup, requiresMostActiveCheck, requiresRelationCheck,
            requiresBalanceCheck, requiresFeeCheck, // Add flag
            targetAddress, parseError: null // Explicitly null for success
        };
    }
}

module.exports = { parseWhaleQuery };