// services/mongoHelper.js
const { MongoClient, ServerApiVersion } = require('mongodb');
const WALLET_LABEL_COLLECTION = process.env.WALLET_LABEL_COLLECTION_NAME;
const DB_NAME = process.env.DATABASE_NAME;
const WHALE_TX_COLLECTION = process.env.COLLECTION_NAME;

require('dotenv').config();
// ... (Same persistent connection logic as before, using DATABASE_NAME) ...
let client = null; let clientPromise = null; const MONGO_CONNECT_TIMEOUT_MS = 20000;
function getMongoClient() { /* ... logic to connect/return promise ... */
    if (client && clientPromise) return clientPromise;
    const username = process.env.MONGODB_USERNAME, password = process.env.MONGODB_PASSWORD, cluster = process.env.MONGODB_CLUSTER;
    if (!username || !password || !cluster) { console.error("FATAL: MongoDB connection details missing."); process.exit(1); }
    const encodedPassword = encodeURIComponent(password);
    const uri = `mongodb+srv://${encodeURIComponent(username)}:${encodedPassword}@${cluster}/?retryWrites=true&w=majority&appName=Cluster0`; // Simplified URI
    const safeUri = uri.substring(0, uri.indexOf('://') + 3) + '******:******@' + uri.substring(uri.indexOf('@') + 1);
    console.log(`Initializing MongoDB connection to: ${safeUri}`);
    client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }, connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS, serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS });
    console.log("Attempting initial MongoDB connection...");
    clientPromise = client.connect().then(c => { console.log("MongoDB Client Connected!"); return c.db(process.env.DATABASE_NAME || "admin").command({ ping: 1 }).then(() => { console.log("MongoDB ping OK."); return c; }); }).catch(err => { console.error("FATAL: MongoDB connection failed:", err); client = null; clientPromise = null; process.exit(1); });
    return clientPromise;
}
async function queryCollection(collectionName, filter = {}, limit = 5, sort = null) { /* ... same logic using getMongoClient ... */
    let mongoClient; try { mongoClient = await getMongoClient(); } catch (error) { throw new Error("Database connection is not available."); }
    const dbName = process.env.DATABASE_NAME; if (!dbName) throw new Error("DATABASE_NAME missing.");
    try { const db = mongoClient.db(dbName); const coll = db.collection(collectionName); console.log(`Querying ${collectionName} | F:${JSON.stringify(filter)} L:${limit} S:${JSON.stringify(sort)}`); let q = coll.find(filter); if (sort) q = q.sort(sort); const r = await q.limit(limit).toArray(); console.log(`Found ${r.length} docs.`); return r; } catch (error) { console.error(`Query error ${collectionName}:`, error); throw new Error(`Failed query ${collectionName}.`); }
}
async function closeDatabaseConnection() { /* ... same logic ... */ if (client) { console.log("Closing MongoDB..."); try { await client.close(); client = null; clientPromise = null; console.log("MongoDB closed."); } catch (e) { console.error("Error closing MongoDB:", e); } } }

/**
 * Fetches labels for a given list of addresses.
 * @param {string[]} addresses - An array of Bitcoin addresses.
 * @returns {Promise<Map<string, string>>} - A Map where keys are addresses and values are labels.
 */
async function getLabelsForAddresses(addresses) {
    if (!WALLET_LABEL_COLLECTION) {
        console.warn("[MongoHelper] WALLET_LABEL_COLLECTION_NAME not set, cannot fetch labels.");
        return new Map(); // Return empty map
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
        return new Map(); // Nothing to fetch
    }

    let mongoClient;
    try {
        mongoClient = await getMongoClient();
    } catch (error) {
         console.error("[MongoHelper] Failed to get client for label fetch:", error);
         throw new Error("Database connection not available for label lookup.");
    }

    const dbName = process.env.DATABASE_NAME;
    if (!dbName) throw new Error("DATABASE_NAME missing.");

    try {
        const db = mongoClient.db(dbName);
        const labelCollection = db.collection(WALLET_LABEL_COLLECTION);
        const uniqueAddresses = [...new Set(addresses)]; // Ensure unique addresses

        console.log(`[MongoHelper] Fetching labels for ${uniqueAddresses.length} unique addresses...`);

        // Fetch labels for the unique addresses
        const labelsCursor = labelCollection.find(
            { address: { $in: uniqueAddresses } },
            { projection: { _id: 0, address: 1, label: 1 } } // Only get address and label
        );

        const labelsMap = new Map();
        await labelsCursor.forEach(doc => {
            if (doc.address && doc.label) {
                labelsMap.set(doc.address, doc.label);
            }
        });

        console.log(`[MongoHelper] Found ${labelsMap.size} labels.`);
        return labelsMap;

    } catch (error) {
        console.error(`[MongoHelper] Error fetching labels from ${WALLET_LABEL_COLLECTION}:`, error);
        // Don't crash the whole command, just return empty map maybe?
        // throw new Error(`Failed to fetch wallet labels.`);
        return new Map(); // Return empty on error to allow main command to continue
    }
    // No client.close() here - use persistent connection
}

/**
 * Performs aggregation to get whale tx summary AND fetches Top N transactions by value.
 * @param {object} filter - MongoDB filter object (e.g., for time range, block, address).
 * @param {number} limitTopN - How many top transactions to fetch by value.
 * @returns {Promise<{summary: object, topTransactions: Array<object>}>}
 * @throws {Error} If database query fails.
 */
async function getWhaleSummaryAndTopTransactions(filter = {}, limitTopN = 20) {
    if (!WHALE_TX_COLLECTION || !DB_NAME) { throw new Error("DB or Whale Collection name missing."); }

    let mongoClient;
    try {
        mongoClient = await getMongoClient();
        const db = mongoClient.db(DB_NAME);
        const collection = db.collection(WHALE_TX_COLLECTION);
        console.log(`[MongoHelper] Running Aggregation & Top N. Filter: ${JSON.stringify(filter)}, Top N: ${limitTopN}`);

        // --- Query 1: Aggregation ---
        const aggregationPipeline = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalTxCount: { $sum: 1 },
                    // Use $toDouble to handle potential BSON numeric types before summing
                    totalVolumeSat: { $sum: { $ifNull: [{ $toDouble: "$value" }, 0] } },
                    // Potential additions:
                     minBlock: { $min: "$block" },
                     maxBlock: { $max: "$block" }
                }
            },
            {
                 $project: {
                      _id: 0, totalTxCount: 1, minBlock: 1, maxBlock: 1,
                      totalVolumeBTC: { $divide: ['$totalVolumeSat', 1e8] }
                 }
            }
        ];

        const summaryResultPromise = collection.aggregate(aggregationPipeline).toArray();

        // --- Query 2: Find Top N Transactions by Value ---
        const topTransactionsPromise = collection
            .find(filter)
            .sort({ value: -1 }) // Sort by value descending (ensure index exists!)
            .limit(limitTopN)
            .toArray();

        // --- Execute Both Queries Concurrently ---
        const [summaryResult, topTransactions] = await Promise.all([
            summaryResultPromise,
            topTransactionsPromise
        ]);

        const summary = summaryResult[0] || { totalTxCount: 0, totalVolumeBTC: 0, minBlock: null, maxBlock: null };
        console.log("[MongoHelper] Aggregation Summary Result:", summary);
        console.log(`[MongoHelper] Found Top ${topTransactions.length} transactions by value.`);

        // --- Enrich Top N with Labels ---
        let addressLabelMap = new Map();
        if (topTransactions.length > 0) {
             const topNAddresses = new Set();
             topTransactions.forEach(tx => { tx.from?.forEach(a => topNAddresses.add(a)); tx.to?.forEach(a => topNAddresses.add(a)); });
             if (topNAddresses.size > 0) {
                  console.log(`[MongoHelper] Fetching labels for ${topNAddresses.size} addresses from Top ${topTransactions.length} transactions...`);
                  addressLabelMap = await getLabelsForAddresses(Array.from(topNAddresses));
                  console.log(`[MongoHelper] Found ${addressLabelMap.size} labels for Top N.`);
             }
             // Add labels directly to the transaction objects
             topTransactions.forEach(tx => {
                  tx.fromLabels = tx.from?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || [];
                  tx.toLabels = tx.to?.map(addr => addressLabelMap.get(addr)).filter(Boolean) || [];
             });
        }

        return { summary, topTransactions }; // Return summary and enriched Top N

    } catch (error) {
        console.error(`[MongoHelper] Error during whale summary/top N query:`, error);
        throw new Error(`Database error processing whale data: ${error.message}`);
    }
}


// --- Function to get latest block number ---
async function getLatestBlockNumber() {
    if (!WHALE_TX_COLLECTION || !DB_NAME) throw new Error("DB or Whale Collection name missing.");
    let mongoClient;
    try {
        mongoClient = await getMongoClient();
        const db = mongoClient.db(DB_NAME);
        const collection = db.collection(WHALE_TX_COLLECTION);
        console.log(`[MongoHelper] Finding latest block number in ${WHALE_TX_COLLECTION}...`);
        // Ensure 'block' field is indexed!
        const latestTx = await collection.findOne({}, { sort: { block: -1 }, projection: { block: 1 } });
        if (latestTx && (latestTx.block !== null && latestTx.block !== undefined)) {
            // Handle BSON Long/Int or regular number
            const blockNum = typeof latestTx.block === 'object' ? Number(latestTx.block) : latestTx.block;
            console.log(`[MongoHelper] Latest block found: ${blockNum}`);
            return blockNum;
        } else {
             console.warn(`[MongoHelper] No transactions found to determine latest block.`);
             return null;
        }
    } catch (error) {
        console.error(`[MongoHelper] Error finding latest block number:`, error);
        return null;
    }
}

// --- NEW: Placeholder for Most Active Aggregation ---
/**
 * Finds most active addresses based on transaction count within a filter.
 * Placeholder - Requires complex aggregation implementation.
 * @param {object} filter - MongoDB filter object (e.g., for time range).
 * @param {number} limit - How many top active addresses to return.
 * @returns {Promise<Array<object>>} - Array like [{ address: "...", count: N }, ...]
 */
async function getMostActiveAddresses(filter = {}, limit = 10) {
    console.warn("[MongoHelper] getMostActiveAddresses function is not fully implemented.");
    // --- Aggregation Logic Placeholder ---
    // 1. $match: filter
    // 2. $project: { addresses: { $concatArrays: ["$from", "$to"] } } // Combine from/to
    // 3. $unwind: "$addresses" // Deconstruct the arrays
    // 4. $group: { _id: "$addresses", count: { $sum: 1 } } // Count occurrences
    // 5. $sort: { count: -1 } // Sort by count descending
    // 6. $limit: limit // Get top N
    // 7. $project: { _id: 0, address: "$_id", count: 1 } // Reshape output
    // Example: const pipeline = [ { $match: filter }, ... ]; const results = await collection.aggregate(pipeline).toArray(); return results;
    // --- End Placeholder ---
    return Promise.resolve([]); // Return empty array for now
}


module.exports = { getMongoClient, queryCollection, closeDatabaseConnection, getLabelsForAddresses, getWhaleSummaryAndTopTransactions, getLatestBlockNumber, getMostActiveAddresses, WHALE_TRANSFERS_COLLECTION: process.env.COLLECTION_NAME, WALLET_LABEL_COLLECTION: WALLET_LABEL_COLLECTION };