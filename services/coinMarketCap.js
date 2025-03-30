// services/coinMarketCap.js
require('dotenv').config();
const axios = require('axios');

const CMC_API_KEY = process.env.CMC_PRO_API_KEY;
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com'; // Standard URL for paid plans

if (!CMC_API_KEY) {
    console.warn("WARNING: CMC_PRO_API_KEY not set in .env. CoinMarketCap features will be disabled or fail.");
}

// --- API Request Helper ---
/**
 * Makes an authenticated request to the CoinMarketCap API.
 * @param {string} endpoint - The API endpoint path (e.g., '/cryptocurrency/map')
 * @param {object} params - Query parameters for the API call.
 * @param {string} apiVersion - The API version string (e.g., 'v1', 'v2', 'v4')
 * @returns {Promise<object>} - The 'data' portion of the CMC API response.
 * @throws {Error} If the API key is missing, or the request fails.
 */
async function makeCmcRequest(endpoint, params = {}, apiVersion = 'v1') {
    if (!CMC_API_KEY) {
        // Throw error here to prevent calls if key is missing
        throw new Error("CoinMarketCap API Key is not configured in .env");
    }

    const url = `${CMC_BASE_URL}/${apiVersion}${endpoint}`;
    console.log(`[CMC Service] Requesting: ${url} | Params: ${JSON.stringify(params)}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'X-CMC_PRO_API_KEY': CMC_API_KEY,
                'Accept': 'application/json',
            },
            params: params,
            timeout: 20000 // 20 second timeout
        });

        if (response.data?.status?.error_code === 0) {
            return response.data.data; // Return data part
        } else {
            const cmcError = response.data?.status;
            const errorCode = cmcError?.error_code || 'Unknown';
            const errorMsg = cmcError?.error_message || 'Unknown CMC API error structure';
            console.error(`[CMC Service] CMC API Error ${url} (Code: ${errorCode}): ${errorMsg}`);
            // Throw specific error types maybe?
            if (errorCode === 1006 || errorMsg.includes("plan doesn't support")) {
                 throw new Error(`CMC Plan Error: Your API Key subscription plan doesn't support this endpoint (${endpoint}). (Code: ${errorCode})`);
            }
            throw new Error(`CMC Error: ${errorMsg} (Code: ${errorCode})`);
        }
    } catch (error) {
        // Handle axios or other errors
        if (axios.isAxiosError(error)) { // More specific check
            if (error.response) { // Request made, server responded with non-2xx status
                const status = error.response.status;
                const errorData = error.response.data;
                const cmcErrorStatus = errorData?.status;
                const cmcErrorMessage = cmcErrorStatus?.error_message || JSON.stringify(errorData);
                console.error(`[CMC Service] HTTP Error ${status} for ${url}:`, cmcErrorMessage);

                if (status === 401) throw new Error(`CMC API Key invalid or missing (Status 401).`);
                // 403 might be plan OR key issue, check message if possible
                if (status === 403) throw new Error(`CMC API Key forbidden/plan issue for endpoint ${endpoint}. Check permissions/plan. (Status 403)`);
                if (status === 429) throw new Error(`CMC Rate limit hit. Please wait.`);
                if (status === 400) throw new Error(`CMC Bad Request: ${cmcErrorMessage} (Status 400).`);
                throw new Error(`CMC request failed (${status}): ${cmcErrorMessage}`);

            } else if (error.request) { // Request made but no response received
                 console.error('[CMC Service] Network Error:', error.message);
                 throw new Error('Network error connecting to CoinMarketCap API.');
            }
        }
        // Handle non-axios errors or re-throw caught ones
        console.error('[CMC Service] Request Setup/Unknown Error:', error.message);
        throw new Error(`Error during CMC request setup or processing: ${error.message}`);
    }
}

// --- Cryptocurrency Endpoints ---

async function getIdMap(params = { listing_status: 'active', start: 1, limit: 5000 }) {
    return await makeCmcRequest('/cryptocurrency/map', params, 'v1');
}
async function getMetadata(params = {}) {
    if (!(params.id || params.symbol || params.slug)) { // Corrected check
        throw new Error("Requires 'id', 'symbol', or 'slug' parameter for metadata.");
    }
    return await makeCmcRequest('/cryptocurrency/info', params, 'v2');
}
async function getListingsLatest(params = { limit: 100, sort: 'market_cap' }) {
    return await makeCmcRequest('/cryptocurrency/listings/latest', params, 'v1');
}
async function getListingsHistorical(params = {}) { // Paid Plan
    if (!params.date) throw new Error("Requires 'date' (YYYY-MM-DD) parameter.");
    return await makeCmcRequest('/cryptocurrency/listings/historical', params, 'v1');
}
async function getLatestQuotes(params = {}) {
    if (!params.id && !params.symbol && !params.slug) { // CMC requires one identifier
        throw new Error("Requires 'id', 'symbol', or 'slug' parameter for quotes.");
    }
    return await makeCmcRequest('/cryptocurrency/quotes/latest', params, 'v2');
}
async function getQuotesHistorical(params = {}) { // Paid Plan
     if (!params.id && !params.symbol && !params.slug && !params.time_start) {
         throw new Error("Requires 'id', 'symbol', 'slug', or 'time_start' for historical quotes.");
    }
    return await makeCmcRequest('/cryptocurrency/quotes/historical', params, 'v2');
}
async function getMarketPairsLatest(id_or_symbol, params = { limit: 100, start: 1 }) { // Paid Plan likely for full data
    if (!id_or_symbol) throw new Error("Requires id or symbol.");
    const queryParams = { ...params }; // Copy params to avoid modifying input object
    if (isNaN(parseInt(id_or_symbol))) { queryParams.symbol = id_or_symbol; }
    else { queryParams.id = id_or_symbol; }
    return await makeCmcRequest('/cryptocurrency/market-pairs/latest', queryParams, 'v2');
}
async function getOhlcvLatest(params = {}) { // Check Plan
    if (!params.id && !params.symbol) { throw new Error("Requires 'id' or 'symbol'."); }
    return await makeCmcRequest('/cryptocurrency/ohlcv/latest', params, 'v2');
}
async function getOhlcvHistorical(id_or_symbol, time_start, time_end, interval = 'daily', convert = 'USD') { // Paid Plan
    if (!id_or_symbol || !time_start) { throw new Error("Requires id/symbol and time_start."); }
    const params = { time_start, time_end, interval, convert };
    if (isNaN(parseInt(id_or_symbol))) { params.symbol = id_or_symbol; } else { params.id = id_or_symbol; }
    return await makeCmcRequest('/cryptocurrency/ohlcv/historical', params, 'v2');
}
async function getPricePerformanceStats(params = {}) { // Check Plan
    if (!params.id && !params.symbol && !params.slug) { throw new Error("Requires 'id', 'symbol', or 'slug'."); }
    return await makeCmcRequest('/cryptocurrency/price-performance-stats/latest', params, 'v2');
}
async function getCategories(params = { limit: 100, start: 1 }) {
    return await makeCmcRequest('/cryptocurrency/categories', params, 'v1');
}
async function getCategory(id) { // Changed param to just id
    if (!id) throw new Error("Requires 'id' parameter.");
    return await makeCmcRequest('/cryptocurrency/category', { id }, 'v1');
}
async function getAirdrops(params = { limit: 100, start: 1, status: 'ongoing' }) {
    return await makeCmcRequest('/cryptocurrency/airdrops', params, 'v1');
}
async function getAirdrop(id) { // Changed param to just id
    if (!id) throw new Error("Requires 'id' parameter.");
    return await makeCmcRequest('/cryptocurrency/airdrop', { id }, 'v1');
}
async function getTrendingLatest(params = {}) { // Paid Plan likely
    return await makeCmcRequest('/cryptocurrency/trending/latest', params, 'v1');
}
async function getTrendingMostVisited(params = {}) { // Paid Plan likely
    return await makeCmcRequest('/cryptocurrency/trending/most-visited', params, 'v1');
}
async function getTrendingGainersLosers(params = { time_period: '24h', limit: 10 }) { // Paid Plan likely
    return await makeCmcRequest('/cryptocurrency/trending/gainers-losers', params, 'v1');
}

// --- DEXScan Endpoints (Using v4) ---
async function getDexListingsQuotes(params = { limit: 100, sort: 'market_cap' }) {
    return await makeCmcRequest('/dex/listings/quotes', params, 'v4');
}
async function getDexListingsInfo(params = {}) {
    if (!params.id && !params.slug) throw new Error("Need id or slug for DEX listings info.");
    return await makeCmcRequest('/dex/listings/info', params, 'v4');
}
async function getDexNetworks(params = {}) {
    return await makeCmcRequest('/dex/networks/list', params, 'v4');
}
async function getDexSpotPairsLatest(params = {}) {
    if (!params.dex_platform_id && !params.dex_platform_slug) { throw new Error("Requires 'dex_platform_id' or 'dex_platform_slug'."); }
    return await makeCmcRequest('/dex/spot-pairs/latest', params, 'v4');
}
async function getDexPairsQuotesLatest(params = {}) { // Expects { pair_address: '0x...,0x...' }
    if (!params.pair_address) throw new Error("Requires 'pair_address' parameter (comma-separated string).");
    return await makeCmcRequest('/dex/pairs/quotes/latest', params, 'v4');
}
async function getDexPairsOhlcvLatest(params = {}) {
    if (!params.pair_address) throw new Error("Requires 'pair_address' parameter.");
    return await makeCmcRequest('/dex/pairs/ohlcv/latest', params, 'v4');
}
async function getDexPairsOhlcvHistorical(params = {}) { // Check Plan / Credits
    if (!params.pair_address || !params.time_start) { throw new Error("Requires 'pair_address' and 'time_start'."); }
    return await makeCmcRequest('/dex/pairs/ohlcv/historical', params, 'v4');
}
async function getDexPairsTradesLatest(params = {}) {
    if (!params.pair_address) throw new Error("Requires 'pair_address' parameter.");
    return await makeCmcRequest('/dex/pairs/trade/latest', params, 'v4');
}

// --- THIS FUNCTION WAS DEFINED BUT MISSING FROM EXPORTS BEFORE ---
async function getGlobalMetrics() { return await makeCmcRequest('/global-metrics/quotes/latest', {}, 'v1'); } // Ensure API version is correct if needed


// --- Debugging Logs and Exports ---
console.log('[CMC Service] Defining exports...');
// Check specific functions right before export
console.log('[CMC Service] typeof getLatestQuotes:', typeof getLatestQuotes);
console.log('[CMC Service] typeof getGlobalMetrics:', typeof getGlobalMetrics);
console.log('[CMC Service] typeof getTrendingLatest:', typeof getTrendingLatest); // This one worked before
console.log('[CMC Service] typeof getMetadata:', typeof getMetadata); // This one worked before

module.exports = {
    // Crypto
    getIdMap, getMetadata, getListingsLatest, getListingsHistorical,
    getLatestQuotes, getQuotesHistorical, getMarketPairsLatest,
    getOhlcvLatest, getOhlcvHistorical, getPricePerformanceStats,
    getCategories, getCategory, getAirdrops, getAirdrop,
    getTrendingLatest, getTrendingMostVisited, getTrendingGainersLosers,
    // DEX
    getDexListingsQuotes, getDexListingsInfo, getDexNetworks,
    getDexSpotPairsLatest, getDexPairsQuotesLatest, getDexPairsOhlcvLatest,
    getDexPairsOhlcvHistorical, getDexPairsTradesLatest,getGlobalMetrics
};
console.log('[CMC Service] Exports defined.');