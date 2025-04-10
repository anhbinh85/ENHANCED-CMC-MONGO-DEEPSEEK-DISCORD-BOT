// services/dbConnection.js
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const MONGO_CONNECT_TIMEOUT_MS = 20000; // Or from process.env if preferred

let client = null;
let clientPromise = null;

function getMongoClient() {
    if (client && clientPromise) {
        // If already connected or connecting, return the existing promise
        console.log("[DBConnection] Returning existing client promise.");
        return clientPromise;
    }

    // --- Connection Details ---
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;
    const cluster = process.env.MONGODB_CLUSTER;
    const dbName = process.env.DATABASE_NAME || "admin"; // Default DB for ping

    if (!username || !password || !cluster) {
        console.error("FATAL: MongoDB connection details (USERNAME, PASSWORD, CLUSTER) missing in .env");
        process.exit(1);
    }
    const encodedPassword = encodeURIComponent(password);
    const uri = `mongodb+srv://${encodeURIComponent(username)}:${encodedPassword}@${cluster}/?retryWrites=true&w=majority&appName=Cluster0`;
    const safeUri = uri.substring(0, uri.indexOf('://') + 3) + '******:******@' + uri.substring(uri.indexOf('@') + 1);

    console.log(`[DBConnection] Initializing new MongoDB connection to: ${safeUri}`);
    client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
        connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS // Use same timeout for server selection
    });

    console.log("[DBConnection] Attempting connection...");
    clientPromise = client.connect()
        .then(connectedClient => {
            client = connectedClient; // Store the connected client
            console.log("[DBConnection] MongoDB Client Connected!");
            // Ping the database to confirm connection
            return client.db(dbName).command({ ping: 1 })
                .then(() => {
                    console.log("[DBConnection] MongoDB ping successful.");
                    return client; // Return the connected client on success
                });
        })
        .catch(err => {
            console.error("FATAL: MongoDB connection failed:", err);
            client = null; // Reset client state on failure
            clientPromise = null;
            process.exit(1); // Exit if connection fails
        });

    return clientPromise;
}

async function closeDatabaseConnection() {
    if (client) {
        console.log("[DBConnection] Closing MongoDB connection...");
        try {
            await client.close();
            client = null;
            clientPromise = null;
            console.log("[DBConnection] MongoDB connection closed.");
        } catch (e) {
            console.error("[DBConnection] Error closing MongoDB connection:", e);
        }
    } else {
         console.log("[DBConnection] No active MongoDB connection to close.");
    }
}

module.exports = {
    getMongoClient,
    closeDatabaseConnection
};