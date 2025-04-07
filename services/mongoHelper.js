// // services/mongoHelper.js
// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // Ensure ObjectId is imported
// const WALLET_LABEL_COLLECTION = process.env.WALLET_LABEL_COLLECTION_NAME;
// const DB_NAME = process.env.DATABASE_NAME;
// const WHALE_TX_COLLECTION = process.env.COLLECTION_NAME;

// require('dotenv').config();
// // ... (getMongoClient, queryCollection, closeDatabaseConnection - unchanged) ...
// let client = null; let clientPromise = null; const MONGO_CONNECT_TIMEOUT_MS = 20000;
// function getMongoClient() { /**/
//     if (client && clientPromise) return clientPromise;
//     const username = process.env.MONGODB_USERNAME, password = process.env.MONGODB_PASSWORD, cluster = process.env.MONGODB_CLUSTER;
//     if (!username || !password || !cluster) { console.error("FATAL: MongoDB connection details missing."); process.exit(1); }
//     const encodedPassword = encodeURIComponent(password);
//     const uri = `mongodb+srv://${encodeURIComponent(username)}:${encodedPassword}@${cluster}/?retryWrites=true&w=majority&appName=Cluster0`;
//     const safeUri = uri.substring(0, uri.indexOf('://') + 3) + '******:******@' + uri.substring(uri.indexOf('@') + 1);
//     console.log(`Initializing MongoDB connection to: ${safeUri}`);
//     client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }, connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS, serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS });
//     console.log("Attempting initial MongoDB connection...");
//     clientPromise = client.connect().then(c => { console.log("MongoDB Client Connected!"); return c.db(process.env.DATABASE_NAME || "admin").command({ ping: 1 }).then(() => { console.log("MongoDB ping OK."); return c; }); }).catch(err => { console.error("FATAL: MongoDB connection failed:", err); client = null; clientPromise = null; process.exit(1); });
//     return clientPromise;
// }
// async function queryCollection(collectionName, filter = {}, limit = 5, sort = null) { /**/
//     let mongoClient; try { mongoClient = await getMongoClient(); } catch (error) { throw new Error("Database connection is not available."); }
//     const dbName = process.env.DATABASE_NAME; if (!dbName) throw new Error("DATABASE_NAME missing.");
//     try { const db = mongoClient.db(dbName); const coll = db.collection(collectionName); console.log(`Querying ${collectionName} | F:${JSON.stringify(filter)} L:${limit} S:${JSON.stringify(sort)}`); let q = coll.find(filter); if (sort) q = q.sort(sort); const r = await q.limit(limit).toArray(); console.log(`Found ${r.length} docs.`); return r; } catch (error) { console.error(`Query error ${collectionName}:`, error); throw new Error(`Failed query ${collectionName}.`); }
// }
// async function closeDatabaseConnection() { /**/ if (client) { console.log("Closing MongoDB..."); try { await client.close(); client = null; clientPromise = null; console.log("MongoDB closed."); } catch (e) { console.error("Error closing MongoDB:", e); } } }


// // --- getLabelsForAddresses (unchanged) ---
// async function getLabelsForAddresses(addresses) { /**/
//     if (!WALLET_LABEL_COLLECTION) { console.warn("[MongoHelper] WALLET_LABEL_COLLECTION_NAME not set, cannot fetch labels."); return new Map(); }
//     if (!Array.isArray(addresses) || addresses.length === 0) { return new Map(); }
//     let mongoClient; try { mongoClient = await getMongoClient(); } catch (error) { console.error("[MongoHelper] Failed to get client for label fetch:", error); throw new Error("Database connection not available for label lookup."); }
//     const dbName = process.env.DATABASE_NAME; if (!dbName) throw new Error("DATABASE_NAME missing.");
//     try {
//         const db = mongoClient.db(dbName); const labelCollection = db.collection(WALLET_LABEL_COLLECTION);
//         const uniqueAddresses = [...new Set(addresses)];
//         console.log(`[MongoHelper] Fetching labels for ${uniqueAddresses.length} unique addresses...`);
//         const labelsCursor = labelCollection.find( { address: { $in: uniqueAddresses } }, { projection: { _id: 0, address: 1, label: 1 } } );
//         const labelsMap = new Map();
//         await labelsCursor.forEach(doc => { if (doc.address && doc.label) { labelsMap.set(doc.address, doc.label); } });
//         console.log(`[MongoHelper] Found ${labelsMap.size} labels.`);
//         return labelsMap;
//     } catch (error) { console.error(`[MongoHelper] Error fetching labels from ${WALLET_LABEL_COLLECTION}:`, error); return new Map(); }
// }

// // --- getWhaleSummaryAndTopTransactions (unchanged) ---
// async function getWhaleSummaryAndTopTransactions(filter = {}, limitTopN = 20) { /**/
//     if (!WHALE_TX_COLLECTION || !DB_NAME) { throw new Error("DB or Whale Collection name missing."); }
//     let mongoClient; try {
//         mongoClient = await getMongoClient(); const db = mongoClient.db(DB_NAME); const collection = db.collection(WHALE_TX_COLLECTION);
//         console.log(`[MongoHelper] Running Aggregation & Top N. Filter: ${JSON.stringify(filter)}, Top N: ${limitTopN}`);
//         const aggregationPipeline = [ { $match: filter }, { $group: { _id: null, totalTxCount: { $sum: 1 }, totalVolumeSat: { $sum: { $ifNull: [{ $toDouble: "$value" }, 0] } }, minBlock: { $min: "$block" }, maxBlock: { $max: "$block" } } }, { $project: { _id: 0, totalTxCount: 1, minBlock: 1, maxBlock: 1, totalVolumeBTC: { $divide: ['$totalVolumeSat', 1e8] } } } ];
//         const summaryResultPromise = collection.aggregate(aggregationPipeline).toArray();
//         const topTransactionsPromise = collection.find(filter).sort({ value: -1 }).limit(limitTopN).toArray();
//         const [summaryResult, topTransactions] = await Promise.all([ summaryResultPromise, topTransactionsPromise ]);
//         const summary = summaryResult[0] || { totalTxCount: 0, totalVolumeBTC: 0, minBlock: null, maxBlock: null };
//         console.log("[MongoHelper] Aggregation Summary Result:", summary); console.log(`[MongoHelper] Found Top ${topTransactions.length} transactions by value.`);
//         let addressLabelMap = new Map(); if (topTransactions.length > 0) { const topNAddresses = new Set(); topTransactions.forEach(tx => { tx.from?.forEach(a => topNAddresses.add(a)); tx.to?.forEach(a => topNAddresses.add(a)); }); if (topNAddresses.size > 0) { console.log(`[MongoHelper] Fetching labels for ${topNAddresses.size} addresses from Top ${topTransactions.length} transactions...`); addressLabelMap = await getLabelsForAddresses(Array.from(topNAddresses)); console.log(`[MongoHelper] Found ${addressLabelMap.size} labels for Top N.`); } topTransactions.forEach(tx => { tx.fromLabels = tx.from?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || []; tx.toLabels = tx.to?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || []; }); }
//         return { summary, topTransactions };
//     } catch (error) { console.error(`[MongoHelper] Error during whale summary/top N query:`, error); throw new Error(`Database error processing whale data: ${error.message}`); }
// }

// // --- getLatestBlockNumber (unchanged) ---
// async function getLatestBlockNumber() { /**/
//     if (!WHALE_TX_COLLECTION || !DB_NAME) throw new Error("DB or Whale Collection name missing.");
//     let mongoClient; try {
//         mongoClient = await getMongoClient(); const db = mongoClient.db(DB_NAME); const collection = db.collection(WHALE_TX_COLLECTION);
//         console.log(`[MongoHelper] Finding latest block number in ${WHALE_TX_COLLECTION}...`);
//         const latestTx = await collection.findOne({}, { sort: { block: -1 }, projection: { block: 1 } });
//         if (latestTx && (latestTx.block !== null && latestTx.block !== undefined)) {
//             const blockNum = typeof latestTx.block === 'object' ? Number(latestTx.block) : latestTx.block;
//             console.log(`[MongoHelper] Latest block found: ${blockNum}`); return blockNum;
//         } else { console.warn(`[MongoHelper] No transactions found to determine latest block.`); return null; }
//     } catch (error) { console.error(`[MongoHelper] Error finding latest block number:`, error); return null; }
// }


// // --- **IMPLEMENTED**: Get Most Active Addresses ---
// /**
//  * Finds most active addresses based on transaction count within a filter.
//  * @param {object} filter - MongoDB filter object (e.g., for time range).
//  * @param {number} limit - How many top active addresses to return.
//  * @returns {Promise<Array<object>>} - Array like [{ address: "...", count: N }, ...]
//  */
// async function getMostActiveAddresses(filter = {}, limit = 10) {
//     if (!WHALE_TX_COLLECTION || !DB_NAME) { throw new Error("DB or Whale Collection name missing."); }
//     let mongoClient;
//     try {
//         mongoClient = await getMongoClient();
//         const db = mongoClient.db(DB_NAME);
//         const collection = db.collection(WHALE_TX_COLLECTION);
//         console.log(`[MongoHelper] Running Most Active Aggregation. Filter: ${JSON.stringify(filter)}, Limit: ${limit}`);

//         const pipeline = [
//             { $match: filter }, // Apply time filter etc.
//             {
//                 $project: { // Create a single array combining 'from' and 'to' addresses
//                     addresses: {
//                         $concatArrays: [ { $ifNull: ["$from", []] }, { $ifNull: ["$to", []] } ]
//                     }
//                 }
//             },
//             { $unwind: "$addresses" }, // Create a separate document for each address in the combined array
//             {
//                 $group: { // Group by address and count occurrences
//                     _id: "$addresses",
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { count: -1 } }, // Sort by count descending
//             { $limit: limit }, // Limit to the top N
//             {
//                 $project: { // Reshape the output
//                     _id: 0,
//                     address: "$_id",
//                     count: 1
//                 }
//             }
//         ];

//         const results = await collection.aggregate(pipeline).toArray();
//         console.log(`[MongoHelper] Found ${results.length} most active addresses.`);

//         // --- Enrich with Labels ---
//          let addressLabelMap = new Map();
//          if (results.length > 0) {
//              const activeAddresses = results.map(r => r.address);
//              if (activeAddresses.length > 0) {
//                  console.log(`[MongoHelper] Fetching labels for ${activeAddresses.length} most active addresses...`);
//                  addressLabelMap = await getLabelsForAddresses(activeAddresses);
//                  console.log(`[MongoHelper] Found ${addressLabelMap.size} labels for most active.`);
//              }
//              // Add labels to results
//              results.forEach(r => {
//                  r.label = addressLabelMap.get(r.address) || null;
//              });
//          }
//          // --- End Enrich ---

//         return results;

//     } catch (error) {
//         console.error(`[MongoHelper] Error during getMostActiveAddresses query:`, error);
//         throw new Error(`Database error processing most active addresses: ${error.message}`);
//     }
// }
// // --- End Implementation ---

// module.exports = {
//     getMongoClient,
//     queryCollection,
//     closeDatabaseConnection,
//     getLabelsForAddresses,
//     getWhaleSummaryAndTopTransactions,
//     getLatestBlockNumber,
//     getMostActiveAddresses, // Export the new function
//     WHALE_TRANSFERS_COLLECTION: process.env.COLLECTION_NAME, // Keep existing exports
//     WALLET_LABEL_COLLECTION: WALLET_LABEL_COLLECTION
// };

// services/mongoHelper.js
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // Ensure ObjectId is imported
const WALLET_LABEL_COLLECTION = process.env.WALLET_LABEL_COLLECTION_NAME;
const DB_NAME = process.env.DATABASE_NAME;
const WHALE_TX_COLLECTION = process.env.COLLECTION_NAME;

require('dotenv').config();
// ... (getMongoClient, queryCollection, closeDatabaseConnection - unchanged) ...
let client = null; let clientPromise = null; const MONGO_CONNECT_TIMEOUT_MS = 20000;
function getMongoClient() { /**/
    if (client && clientPromise) return clientPromise;
    const username = process.env.MONGODB_USERNAME, password = process.env.MONGODB_PASSWORD, cluster = process.env.MONGODB_CLUSTER;
    if (!username || !password || !cluster) { console.error("FATAL: MongoDB connection details missing."); process.exit(1); }
    const encodedPassword = encodeURIComponent(password);
    const uri = `mongodb+srv://${encodeURIComponent(username)}:${encodedPassword}@${cluster}/?retryWrites=true&w=majority&appName=Cluster0`;
    const safeUri = uri.substring(0, uri.indexOf('://') + 3) + '******:******@' + uri.substring(uri.indexOf('@') + 1);
    console.log(`Initializing MongoDB connection to: ${safeUri}`);
    client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }, connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS, serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS });
    console.log("Attempting initial MongoDB connection...");
    clientPromise = client.connect().then(c => { console.log("MongoDB Client Connected!"); return c.db(process.env.DATABASE_NAME || "admin").command({ ping: 1 }).then(() => { console.log("MongoDB ping OK."); return c; }); }).catch(err => { console.error("FATAL: MongoDB connection failed:", err); client = null; clientPromise = null; process.exit(1); });
    return clientPromise;
}
async function queryCollection(collectionName, filter = {}, limit = 5, sort = null) { /**/
    let mongoClient; try { mongoClient = await getMongoClient(); } catch (error) { throw new Error("Database connection is not available."); }
    const dbName = process.env.DATABASE_NAME; if (!dbName) throw new Error("DATABASE_NAME missing.");
    try { const db = mongoClient.db(dbName); const coll = db.collection(collectionName); console.log(`Querying ${collectionName} | F:${JSON.stringify(filter)} L:${limit} S:${JSON.stringify(sort)}`); let q = coll.find(filter); if (sort) q = q.sort(sort); const r = await q.limit(limit).toArray(); console.log(`Found ${r.length} docs.`); return r; } catch (error) { console.error(`Query error ${collectionName}:`, error); throw new Error(`Failed query ${collectionName}.`); }
}
async function closeDatabaseConnection() { /**/ if (client) { console.log("Closing MongoDB..."); try { await client.close(); client = null; clientPromise = null; console.log("MongoDB closed."); } catch (e) { console.error("Error closing MongoDB:", e); } } }


// --- getLabelsForAddresses (unchanged) ---
async function getLabelsForAddresses(addresses) { /**/
    if (!WALLET_LABEL_COLLECTION) { console.warn("[MongoHelper] WALLET_LABEL_COLLECTION_NAME not set, cannot fetch labels."); return new Map(); }
    if (!Array.isArray(addresses) || addresses.length === 0) { return new Map(); }
    let mongoClient; try { mongoClient = await getMongoClient(); } catch (error) { console.error("[MongoHelper] Failed to get client for label fetch:", error); throw new Error("Database connection not available for label lookup."); }
    const dbName = process.env.DATABASE_NAME; if (!dbName) throw new Error("DATABASE_NAME missing.");
    try {
        const db = mongoClient.db(dbName); const labelCollection = db.collection(WALLET_LABEL_COLLECTION);
        const uniqueAddresses = [...new Set(addresses)];
        console.log(`[MongoHelper] Fetching labels for ${uniqueAddresses.length} unique addresses...`);
        const labelsCursor = labelCollection.find( { address: { $in: uniqueAddresses } }, { projection: { _id: 0, address: 1, label: 1 } } );
        const labelsMap = new Map();
        await labelsCursor.forEach(doc => { if (doc.address && doc.label) { labelsMap.set(doc.address, doc.label); } });
        console.log(`[MongoHelper] Found ${labelsMap.size} labels.`);
        return labelsMap;
    } catch (error) { console.error(`[MongoHelper] Error fetching labels from ${WALLET_LABEL_COLLECTION}:`, error); return new Map(); }
}

// --- getWhaleSummaryAndTopTransactions (unchanged) ---
async function getWhaleSummaryAndTopTransactions(filter = {}, limitTopN = 20) { /**/
    if (!WHALE_TX_COLLECTION || !DB_NAME) { throw new Error("DB or Whale Collection name missing."); }
    let mongoClient; try {
        mongoClient = await getMongoClient(); const db = mongoClient.db(DB_NAME); const collection = db.collection(WHALE_TX_COLLECTION);
        console.log(`[MongoHelper] Running Aggregation & Top N. Filter: ${JSON.stringify(filter)}, Top N: ${limitTopN}`);
        const aggregationPipeline = [ { $match: filter }, { $group: { _id: null, totalTxCount: { $sum: 1 }, totalVolumeSat: { $sum: { $ifNull: [{ $toDouble: "$value" }, 0] } }, minBlock: { $min: "$block" }, maxBlock: { $max: "$block" } } }, { $project: { _id: 0, totalTxCount: 1, minBlock: 1, maxBlock: 1, totalVolumeBTC: { $divide: ['$totalVolumeSat', 1e8] } } } ];
        const summaryResultPromise = collection.aggregate(aggregationPipeline).toArray();
        const topTransactionsPromise = collection.find(filter).sort({ value: -1 }).limit(limitTopN).toArray();
        const [summaryResult, topTransactions] = await Promise.all([ summaryResultPromise, topTransactionsPromise ]);
        const summary = summaryResult[0] || { totalTxCount: 0, totalVolumeBTC: 0, minBlock: null, maxBlock: null };
        console.log("[MongoHelper] Aggregation Summary Result:", summary); console.log(`[MongoHelper] Found Top ${topTransactions.length} transactions by value.`);
        let addressLabelMap = new Map(); if (topTransactions.length > 0) { const topNAddresses = new Set(); topTransactions.forEach(tx => { tx.from?.forEach(a => topNAddresses.add(a)); tx.to?.forEach(a => topNAddresses.add(a)); }); if (topNAddresses.size > 0) { console.log(`[MongoHelper] Fetching labels for ${topNAddresses.size} addresses from Top ${topTransactions.length} transactions...`); addressLabelMap = await getLabelsForAddresses(Array.from(topNAddresses)); console.log(`[MongoHelper] Found ${addressLabelMap.size} labels for Top N.`); } topTransactions.forEach(tx => { tx.fromLabels = tx.from?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || []; tx.toLabels = tx.to?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || []; }); }
        return { summary, topTransactions };
    } catch (error) { console.error(`[MongoHelper] Error during whale summary/top N query:`, error); throw new Error(`Database error processing whale data: ${error.message}`); }
}

// --- getLatestBlockNumber (unchanged) ---
async function getLatestBlockNumber() { /**/
    if (!WHALE_TX_COLLECTION || !DB_NAME) throw new Error("DB or Whale Collection name missing.");
    let mongoClient; try {
        mongoClient = await getMongoClient(); const db = mongoClient.db(DB_NAME); const collection = db.collection(WHALE_TX_COLLECTION);
        console.log(`[MongoHelper] Finding latest block number in ${WHALE_TX_COLLECTION}...`);
        const latestTx = await collection.findOne({}, { sort: { block: -1 }, projection: { block: 1 } });
        if (latestTx && (latestTx.block !== null && latestTx.block !== undefined)) {
            const blockNum = typeof latestTx.block === 'object' ? Number(latestTx.block) : latestTx.block;
            console.log(`[MongoHelper] Latest block found: ${blockNum}`); return blockNum;
        } else { console.warn(`[MongoHelper] No transactions found to determine latest block.`); return null; }
    } catch (error) { console.error(`[MongoHelper] Error finding latest block number:`, error); return null; }
}


// --- **REVISED**: Get Most Active Addresses with IN/OUT Sums ---
/**
 * Finds most active addresses based on transaction count within a filter,
 * then calculates IN/OUT sums for those addresses within the same filter.
 * @param {object} filter - MongoDB filter object (e.g., for time range).
 * @param {number} limit - How many top active addresses to return.
 * @returns {Promise<Array<object>>} - Array like [{ address: "...", count: N, label: "...", totalInBTC: X, totalOutBTC: Y }, ...]
 */
async function getMostActiveAddresses(filter = {}, limit = 10) {
    if (!WHALE_TX_COLLECTION || !DB_NAME) { throw new Error("DB or Whale Collection name missing."); }
    let mongoClient;
    try {
        mongoClient = await getMongoClient();
        const db = mongoClient.db(DB_NAME);
        const collection = db.collection(WHALE_TX_COLLECTION);
        console.log(`[MongoHelper] Step 1: Finding Top ${limit} Most Active Addresses. Filter: ${JSON.stringify(filter)}`);

        // Pipeline to find top addresses by count
        const activityPipeline = [
            { $match: filter },
            { $project: { addresses: { $concatArrays: [ { $ifNull: ["$from", []] }, { $ifNull: ["$to", []] } ] } } },
            { $unwind: "$addresses" },
            { $group: { _id: "$addresses", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit },
            { $project: { _id: 0, address: "$_id", count: 1 } }
        ];

        const topActiveResults = await collection.aggregate(activityPipeline).toArray();
        console.log(`[MongoHelper] Found ${topActiveResults.length} potentially active addresses.`);

        if (topActiveResults.length === 0) {
            return []; // No addresses found
        }

        // --- Step 2: Calculate IN/OUT sums for these specific addresses within the filter ---
        const addressesToQuery = topActiveResults.map(r => r.address);
        console.log(`[MongoHelper] Step 2: Calculating IN/OUT sums for ${addressesToQuery.length} addresses.`);

        const inOutPipeline = [
            { $match: { // Match transactions within the original filter AND involving these addresses
                $and: [
                    filter, // Original time/block filter
                    { $or: [ { from: { $in: addressesToQuery } }, { to: { $in: addressesToQuery } } ] }
                 ]
             }
            },
            { // Calculate IN/OUT sums per transaction
              $project: {
                 valueNum: { $ifNull: [{ $toDouble: "$value" }, 0] },
                 from: { $ifNull: ["$from", []] },
                 to: { $ifNull: ["$to", []] }
              }
            },
            { // Unwind TO addresses to sum IN value per address
              $unwind: "$to"
            },
            {
              $group: {
                _id: "$to", // Group by receiving address
                totalInSat: { $sum: "$valueNum" }
              }
            },
            // We need another stage or separate aggregation for OUT sums
            // This approach gets complicated quickly trying to do IN/OUT together after finding top N by count.
            // Let's do separate lookups for simplicity, though less efficient.
        ];
        // --- Revised Approach: Separate Queries for IN/OUT Sums ---
        const resultsWithSums = [];
        const labelsMap = await getLabelsForAddresses(addressesToQuery); // Get labels

        for (const activeAddr of topActiveResults) {
            const address = activeAddr.address;
            const count = activeAddr.count;

            // Query for Total IN value
            const inFilter = { $and: [filter, { to: address }] }; // Original filter + address in 'to'
            const inAggregation = [
                { $match: inFilter },
                { $group: { _id: null, totalInSat: { $sum: { $ifNull: [{ $toDouble: "$value" }, 0] } } } }
            ];
            const inResult = await collection.aggregate(inAggregation).toArray();
            const totalInSat = inResult[0]?.totalInSat || 0;

            // Query for Total OUT value
            const outFilter = { $and: [filter, { from: address }] }; // Original filter + address in 'from'
            const outAggregation = [
                { $match: outFilter },
                { $group: { _id: null, totalOutSat: { $sum: { $ifNull: [{ $toDouble: "$value" }, 0] } } } }
            ];
            const outResult = await collection.aggregate(outAggregation).toArray();
            const totalOutSat = outResult[0]?.totalOutSat || 0;

            resultsWithSums.push({
                address: address,
                count: count,
                label: labelsMap.get(address) || null,
                totalInBTC: totalInSat / 1e8,
                totalOutBTC: totalOutSat / 1e8
            });
            console.log(`[MongoHelper] Calculated sums for ${address}: IN=${(totalInSat / 1e8).toFixed(4)} BTC, OUT=${(totalOutSat / 1e8).toFixed(4)} BTC`);
        }

        // Ensure original sort order by count is maintained
         resultsWithSums.sort((a, b) => b.count - a.count);

        return resultsWithSums;

    } catch (error) {
        console.error(`[MongoHelper] Error during getMostActiveAddresses query:`, error);
        throw new Error(`Database error processing most active addresses: ${error.message}`);
    }
}
// --- End Implementation ---

module.exports = {
    getMongoClient, queryCollection, closeDatabaseConnection,
    getLabelsForAddresses, getWhaleSummaryAndTopTransactions, getLatestBlockNumber,
    getMostActiveAddresses, // Export the revised function
    WHALE_TRANSFERS_COLLECTION: process.env.COLLECTION_NAME,
    WALLET_LABEL_COLLECTION: WALLET_LABEL_COLLECTION
};