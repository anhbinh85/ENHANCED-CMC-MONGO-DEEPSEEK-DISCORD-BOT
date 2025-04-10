// // services/relationQueries.js
// const { ObjectId } = require('mongodb');
// // const mongoHelper = require('./mongoHelper'); // REMOVED - Causes circular dependency for connection
// const dbConnection = require('./dbConnection'); // <-- Import new connection module
// require('dotenv').config();

// const WHALE_TX_COLLECTION = process.env.COLLECTION_NAME;

// /**
//  * Finds addresses interacting with the targetAddress within a time filter...
//  * (Function description - unchanged)
//  */
// async function findAddressRelations(targetAddress, timeFilter) {
//     if (!targetAddress || !timeFilter) {
//         throw new Error("Target address and time filter are required.");
//     }
//     if (!WHALE_TX_COLLECTION) {
//          throw new Error("Whale transfers collection name (COLLECTION_NAME) is not configured in .env.");
//     }

//     const relations = {};
//     let mongoClient;
//     try {
//         // --- Use the new connection module ---
//         mongoClient = await dbConnection.getMongoClient();
//         // --- End change ---

//         const db = mongoClient.db(process.env.DATABASE_NAME);
//         const collection = db.collection(WHALE_TX_COLLECTION);

//         // ... (rest of the query and processing logic - unchanged) ...
//          const finalFilter = { $and: [ timeFilter, { $or: [{ from: targetAddress }, { to: targetAddress }] } ] };
//          console.log(`[RelationQueries] Querying transactions for ${targetAddress} with filter: ${JSON.stringify(finalFilter)}`);
//          const cursor = collection.find(finalFilter, { projection: { _id: 1, value: 1, from: 1, to: 1 } });
//          let txCount = 0;
//          await cursor.forEach(tx => {
//              txCount++; const valueBTC = Number(tx.value || 0) / 1e8; if (valueBTC === 0) return;
//              const isSender = tx.from && tx.from.includes(targetAddress); const isReceiver = tx.to && tx.to.includes(targetAddress); const fromCount = tx.from?.length || 0; const toCount = tx.to?.length || 0;
//              let txType = 'unknown';
//              if (isSender && !isReceiver) { if (fromCount === 1 && toCount === 1) txType = 'single_out'; else if (fromCount === 1 && toCount > 1) txType = 'distribution'; else if (fromCount > 1 && toCount === 1) txType = 'consolidation_out'; else txType = 'multi_out'; }
//              else if (!isSender && isReceiver) { if (fromCount === 1 && toCount === 1) txType = 'single_in'; else if (fromCount > 1 && toCount === 1) txType = 'consolidation'; else if (fromCount === 1 && toCount > 1) txType = 'distribution_in'; else txType = 'multi_in'; }
//              else if (isSender && isReceiver) { txType = 'internal_or_complex'; }
//              const counterparties = new Set();
//              if (isSender) { tx.to?.forEach(addr => { if (addr !== targetAddress) counterparties.add(addr); }); }
//              if (isReceiver) { tx.from?.forEach(addr => { if (addr !== targetAddress) counterparties.add(addr); }); }
//              counterparties.forEach(cAddr => { if (!relations[cAddr]) { relations[cAddr] = { totalInBTC: 0, totalOutBTC: 0, txCount: 0, types: new Set() }; } relations[cAddr].txCount++; relations[cAddr].types.add(txType); if (isSender) relations[cAddr].totalOutBTC += valueBTC; if (isReceiver) relations[cAddr].totalInBTC += valueBTC; });
//          });
//          console.log(`[RelationQueries] Processed ${txCount} transactions involving ${targetAddress}. Found ${Object.keys(relations).length} counterparties.`);
//          for (const addr in relations) { relations[addr].types = Array.from(relations[addr].types); }
//          return relations;

//     } catch (error) {
//         console.error(`[RelationQueries] Error finding relations for ${targetAddress}:`, error);
//         // Add type check for the specific error to avoid hiding other issues
//         if (error instanceof TypeError && error.message.includes("dbConnection.getMongoClient is not a function")) {
//              throw new Error("Database connection helper setup error.");
//         }
//         throw new Error(`Database error processing address relations: ${error.message}`);
//     }
// }

// module.exports = { findAddressRelations };

// services/relationQueries.js
const { ObjectId } = require('mongodb');
const dbConnection = require('./dbConnection'); // Use separated connection logic
require('dotenv').config();

const WHALE_TX_COLLECTION = process.env.COLLECTION_NAME;
const DB_NAME = process.env.DATABASE_NAME;

/**
 * Finds individual interactions involving the targetAddress within a time filter.
 * @param {string} targetAddress - The address to analyze.
 * @param {object} timeFilter - MongoDB filter object for the time range (e.g., {_id: {$gte: ObjectId(...)}}).
 * @returns {Promise<Array<object>>} - An array of interaction objects:
 * [{ txHash, timestamp, block, counterparty, direction: 'IN'|'OUT', valueBTC, txType: 'single'|'consolidation'|'distribution'|... }]
 */
async function findAddressRelations(targetAddress, timeFilter) {
    if (!targetAddress || !timeFilter) {
        throw new Error("Target address and time filter are required.");
    }
    if (!WHALE_TX_COLLECTION) {
         throw new Error("Whale transfers collection name (COLLECTION_NAME) is not configured in .env.");
    }
    if (!DB_NAME) {
        throw new Error("Database name (DATABASE_NAME) is not configured in .env.");
    }

    const interactions = []; // Store individual interaction records
    let mongoClient;
    try {
        mongoClient = await dbConnection.getMongoClient();
        const db = mongoClient.db(DB_NAME);
        const collection = db.collection(WHALE_TX_COLLECTION);

        const finalFilter = {
            $and: [
                timeFilter,
                { $or: [{ from: targetAddress }, { to: targetAddress }] }
            ]
        };

        console.log(`[RelationQueries] Querying transactions for ${targetAddress} with filter: ${JSON.stringify(finalFilter)}`);
        // Fetch necessary fields including txHash and _id for timestamp, block
        const cursor = collection.find(finalFilter, {
            projection: { _id: 1, value: 1, from: 1, to: 1, txHash: 1, block: 1 }
        });

        let processedTxCount = 0;
        await cursor.forEach(tx => {
            processedTxCount++;
            // Ensure value is treated as a number, handle potential BSON types explicitly if needed
             const rawValue = tx.value?.$numberLong || tx.value?.$numberInt || tx.value;
            const valueBTC = Number(rawValue || 0) / 1e8;

            // Skip if value is invalid or zero (optional)
            if (isNaN(valueBTC)) {
                 console.warn(`[RelationQueries] Skipping tx ${tx.txHash} due to non-numeric value: ${tx.value}`);
                 return;
            }
            // if (valueBTC === 0) return; // Uncomment to skip zero-value transfers

            const isSender = tx.from && tx.from.includes(targetAddress);
            const isReceiver = tx.to && tx.to.includes(targetAddress);
            const fromCount = tx.from?.length || 0;
            const toCount = tx.to?.length || 0;
            let timestamp = null;
            try { if (tx._id) { timestamp = tx._id.getTimestamp().toISOString(); } } catch(e){}
            const block = tx.block?.$numberInt || tx.block?.$numberLong || tx.block; // Extract block number

            // --- Determine Transaction Type relative to targetAddress ---
            let txType = 'unknown';
            if (isSender && !isReceiver) { if (fromCount === 1 && toCount === 1) txType = 'single_out'; else if (fromCount === 1 && toCount > 1) txType = 'distribution'; else if (fromCount > 1 && toCount === 1) txType = 'consolidation_out'; else txType = 'multi_out'; }
            else if (!isSender && isReceiver) { if (fromCount === 1 && toCount === 1) txType = 'single_in'; else if (fromCount > 1 && toCount === 1) txType = 'consolidation'; else if (fromCount === 1 && toCount > 1) txType = 'distribution_in'; else txType = 'multi_in'; }
            else if (isSender && isReceiver) { txType = 'internal_or_complex'; }
            // --- End Classification ---

            // --- Create Interaction Records ---
            if (isSender) {
                tx.to?.forEach(receiverAddr => {
                    if (receiverAddr !== targetAddress) {
                        interactions.push({
                            txHash: tx.txHash,
                            timestamp: timestamp,
                            block: block,
                            counterparty: receiverAddr,
                            direction: 'OUT',
                            valueBTC: valueBTC, // Using total TX value here
                            txType: txType
                        });
                    }
                });
            }
            if (isReceiver) {
                 tx.from?.forEach(senderAddr => {
                     if (senderAddr !== targetAddress) {
                        interactions.push({
                            txHash: tx.txHash,
                            timestamp: timestamp,
                            block: block,
                            counterparty: senderAddr,
                            direction: 'IN',
                            valueBTC: valueBTC, // Using total TX value here
                            txType: txType
                        });
                    }
                 });
            }
            // --- End Interaction Records ---

        }); // End cursor.forEach

        console.log(`[RelationQueries] Processed ${processedTxCount} transactions. Generated ${interactions.length} interaction records involving ${targetAddress}.`);
        return interactions; // Return the array of individual interactions

    } catch (error) {
        console.error(`[RelationQueries] Error finding relations for ${targetAddress}:`, error);
        throw new Error(`Database error processing address relations: ${error.message}`);
    }
}

module.exports = { findAddressRelations };