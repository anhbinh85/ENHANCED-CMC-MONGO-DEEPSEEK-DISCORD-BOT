// services/quicknodeHelper.js
require('dotenv').config();
const axios = require('axios');

const QUICKNODE_RPC_URL = process.env.QUICKNODE_RPC_URL;

if (!QUICKNODE_RPC_URL) {
    console.warn("[QuickNodeHelper] WARNING: QUICKNODE_RPC_URL is not set. Transactions will fail.");
}

async function getTransactionDetails(txHash) {
    if (!QUICKNODE_RPC_URL) throw new Error("[QN] QuickNode URL not configured.");

    const payload = {
        method: 'getrawtransaction',
        params: [txHash, 2], // Verbosity level 2 for full details
        jsonrpc: '2.0',
        id: Date.now(), // Unique ID
    };

    try {
        const response = await axios.post(QUICKNODE_RPC_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000
        });

        if (response.data.error) {
            throw new Error(`[QN] RPC Error: ${response.data.error.message}`);
        }

        return response.data.result ?? null; // Return result or null
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        throw new Error(`[QN] Failed: ${msg}`);
    }
}

module.exports = { getTransactionDetails };
