// services/blockcypherHelper.js
require('dotenv').config();
const axios = require('axios');

// --- Configuration ---
// NOTE: User provided BLOCKCPHERY_API_KEY, assuming typo, using BLOCKCYPHER_API_KEY
const API_KEY = process.env.BLOCKCYPHER_API_KEY;
const BASE_URL = 'https://api.blockcypher.com/v1';
const COIN = 'btc'; // Default to Bitcoin
const CHAIN = 'main'; // Default to Mainnet

if (!API_KEY) {
    console.warn("[BlockcypherHelper] WARNING: BLOCKCYPHER_API_KEY not set in .env file. Blockcypher API calls will likely fail.");
}

/**
 * Makes a request to the Blockcypher API.
 * @param {string} endpoint - The API endpoint path (e.g., `/addrs/ADDRESS/balance`). MUST start with /
 * @param {object} params - Query parameters (excluding the token).
 * @returns {Promise<object>} - The data from the API response.
 * @throws {Error} If the API key is missing or the request fails.
 */
async function makeRequest(endpoint, params = {}) {
    if (!API_KEY) {
        // Optionally allow calls without API key if endpoint supports it, but most useful ones need it.
        // console.warn("[BlockcypherHelper] Making request without API key.");
         throw new Error("Blockcypher API Key (BLOCKCYPHER_API_KEY) is not configured.");
    }

    // Add token to params
    const requestParams = { ...params, token: API_KEY };

    const url = `${BASE_URL}/${COIN}/${CHAIN}${endpoint}`;
    console.log(`[BlockcypherHelper] Requesting: ${url}`);

    try {
        const response = await axios.get(url, {
            params: requestParams,
            timeout: 15000 // 15 second timeout
        });
        // Blockcypher typically returns data directly on success (status 200)
        return response.data;
    } catch (error) {
        console.error(`[BlockcypherHelper] Error requesting ${url}:`, error.message);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const errorData = error.response?.data;
            let specificMessage = errorData?.error || JSON.stringify(errorData) || error.message;

            if (status === 401) specificMessage = "Invalid Blockcypher API Key.";
            else if (status === 403) specificMessage = "Blockcypher API Key forbidden (check permissions/plan).";
            else if (status === 404) specificMessage = "Resource not found (check address/tx hash/endpoint).";
            else if (status === 429) specificMessage = "Blockcypher Rate Limit hit. Please wait.";
            else if (status >= 500) specificMessage = `Blockcypher server error (${status}). Please try again later.`;

            throw new Error(`Blockcypher API Error (${status || 'Network Error'}): ${specificMessage}`);
        }
        // Handle non-axios errors
        throw new Error(`Error during Blockcypher request setup: ${error.message}`);
    }
}

// --- API Functions ---

/**
 * Gets balance and other details for a single Bitcoin address.
 * @param {string} address - The Bitcoin address to query.
 * @returns {Promise<object>} - Address details object from Blockcypher (includes balance, totals, txrefs).
 */
async function getAddressDetails(address) {
    if (!address) throw new Error("Address is required for getAddressDetails.");
    console.log(`[BlockcypherHelper] Fetching full details for address: ${address}`);
    // This endpoint provides balance, totals, and transaction references
    return await makeRequest(`/addrs/${address}`);
    // Example simplified return includes: address, total_received, total_sent, balance, unconfirmed_balance, final_balance, n_tx, unconfirmed_n_tx, final_n_tx, txrefs[...]
}

/**
 * Gets only the balance summary for a single Bitcoin address.
 * @param {string} address - The Bitcoin address to query.
 * @returns {Promise<object>} - Balance object { address, total_received, total_sent, balance, ... }.
 */
async function getAddressBalance(address) {
     if (!address) throw new Error("Address is required for getAddressBalance.");
     console.log(`[BlockcypherHelper] Fetching balance for address: ${address}`);
     // This is a subset of the full address endpoint, potentially faster if only balance needed
     // Note: Blockcypher docs sometimes show /balance endpoint, sometimes just the main addr endpoint.
     // Using the main endpoint and extracting is safer.
     try {
         const details = await makeRequest(`/addrs/${address}`);
         // Extract only balance-related fields for consistency if needed, or return all details
         return {
             address: details.address,
             total_received: details.total_received,
             total_sent: details.total_sent,
             balance: details.balance, // Confirmed balance
             unconfirmed_balance: details.unconfirmed_balance,
             final_balance: details.final_balance, // balance + unconfirmed_balance
             n_tx: details.n_tx,
             unconfirmed_n_tx: details.unconfirmed_n_tx,
             final_n_tx: details.final_n_tx
         };
     } catch (error) {
          console.error(`[BlockcypherHelper] Failed to get balance details for ${address}:`, error);
          throw error; // Re-throw caught error
     }
}


/**
 * Gets details for a specific transaction hash.
 * @param {string} txHash - The transaction hash (txid).
 * @returns {Promise<object>} - Transaction details object from Blockcypher.
 */
async function getTransactionDetails(txHash) {
    if (!txHash) throw new Error("Transaction hash is required for getTransactionDetails.");
    console.log(`[BlockcypherHelper] Fetching details for transaction: ${txHash}`);
    return await makeRequest(`/txs/${txHash}`);
}

/**
 * Gets general information about the blockchain (BTC mainnet by default).
 * @returns {Promise<object>} - Blockchain info object.
 */
async function getBlockchainInfo() {
    console.log(`[BlockcypherHelper] Fetching blockchain info for ${COIN}/${CHAIN}...`);
    return await makeRequest(''); // Request the root path for the coin/chain
}

// --- Potentially useful later ---
/*
async function getTxConfidence(txHash) {
    // Gets Blockcypher's confidence factor for an unconfirmed tx
    if (!txHash) throw new Error("Transaction hash required");
    return await makeRequest(`/txs/${txHash}/confidence`);
}

async function pushRawTransaction(rawTxHex) {
    // Broadcasts a raw transaction hex
    if (!rawTxHex) throw new Error("Raw TX hex required");
    // This requires a POST request
    // return await makeRequest(`/txs/push`, {}, 'POST', { tx: rawTxHex }); // Need to adapt makeRequest for POST
     console.warn("pushRawTransaction not implemented in helper yet.");
     return null;
}
*/

module.exports = {
    getAddressBalance,
    getAddressDetails,
    getTransactionDetails,
    getBlockchainInfo
    // getTxConfidence // Uncomment if used
    // pushRawTransaction // Uncomment if used
};