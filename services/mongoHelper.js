// services/mongoHelper.js
const { MongoClient, ServerApiVersion } = require('mongodb');
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
module.exports = { getMongoClient, queryCollection, closeDatabaseConnection, WHALE_TRANSFERS_COLLECTION: process.env.COLLECTION_NAME };