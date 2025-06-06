// // services/coinMarketCap.js
// require('dotenv').config();
// const axios = require('axios');

// const CMC_API_KEY = process.env.CMC_PRO_API_KEY;
// const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';

// if (!CMC_API_KEY) {
//     console.warn("WARNING: CMC_PRO_API_KEY not set in .env. CoinMarketCap features will be disabled or fail.");
// }

// // --- API Request Helper ---
// async function makeCmcRequest(endpoint, params = {}, apiVersion = 'v1') {
//     if (!CMC_API_KEY) { throw new Error("CoinMarketCap API Key is not configured in .env"); }
//     const url = `${CMC_BASE_URL}/${apiVersion}${endpoint}`;
//     console.log(`[CMC Service] Requesting: ${url} | Params: ${JSON.stringify(params)}`);

//     try {
//         // 1. Make the HTTP GET request
//         const response = await axios.get(url, {
//             headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
//             params: params,
//             timeout: 20000
//         });

//         // 2. Log basic response info (for debugging)
//         console.log(`[CMC Service] Received Status Code: ${response.status}`);
//         console.log(`[CMC Service] Response Data Keys: ${response.data ? Object.keys(response.data) : 'N/A'}`);

//         // 3. Check the CMC application-level status inside the response JSON
//         const cmcStatus = response.data?.status;
//         const errorCode = cmcStatus?.error_code; // CMC's code (0 = success)
//         const errorMsg = cmcStatus?.error_message;

//         // --- THIS IS THE SNIPPET YOU ASKED ABOUT ---
//         // 4. Handle CMC Success (error_code is 0)
//         if (cmcStatus && (errorCode === 0 || errorCode === "0")) { // Check if status exists and error code is 0
//             // 4a. Check if the actual 'data' payload exists
//             if (response.data.data !== undefined && response.data.data !== null) {
//                  console.log(`[CMC Service] Success for ${endpoint} (Code: 0)`);
//                 // Return ONLY the data payload on success
//                 return response.data.data;
//             } else {
//                 // 4b. Handle strange case: error_code is 0, but no data was sent
//                 console.warn(`[CMC Service] CMC OK (Code 0) for ${url} but 'data' missing/null. Status:`, cmcStatus);
//                 throw new Error(`CMC Error: Response OK (Code 0) but no data received for ${endpoint}.`);
//             }
//         }
//         // --- END OF SNIPPET ---

//         // 5. Handle CMC Application-Level Errors (error_code is not 0)
//         else {
//             const finalErrorCode = errorCode || 'Unknown';
//             const finalErrorMsg = errorMsg || 'Unknown CMC API error structure';
//             console.error(`[CMC Service] CMC API Error ${url} (Code: ${finalErrorCode}): ${finalErrorMsg}`);
//             if (finalErrorCode === 1006 || finalErrorMsg?.includes("plan doesn't support")) {
//                  throw new Error(`CMC Plan Error: Your API plan doesn't support this endpoint (${endpoint}).`);
//             }
//             // Throw generic CMC error if code wasn't 0 and not handled above
//             throw new Error(`CMC Error: ${finalErrorMsg} (Code: ${finalErrorCode})`);
//         }
//     } catch (error) { // 6. Handle Network/HTTP/Other Errors
//         // Log raw error details for better diagnosis
//         console.error(`[CMC Service] Raw Error for ${url}:`, error.message);
//         if (axios.isAxiosError(error)) {
//             console.error(`[CMC Service] Raw Axios Error Response Status: ${error.response?.status}`);
//             // console.error(`[CMC Service] Raw Axios Error Response Data:`, error.response?.data); // Can be very verbose

//             if (error.response) { // Non-2xx HTTP errors
//                 const status = error.response.status;
//                 const errorData = error.response.data;
//                 const cmcErrorStatus = errorData?.status;
//                 const cmcErrorMessage = cmcErrorStatus?.error_message || JSON.stringify(errorData); // Try to get CMC msg
//                 // Throw specific errors based on HTTP status
//                 if (status === 401) throw new Error(`CMC API Key invalid/missing (401).`);
//                 if (status === 403) throw new Error(`CMC API Key forbidden/plan issue for endpoint ${endpoint} (403).`);
//                 if (status === 429) throw new Error(`CMC Rate limit hit (429).`);
//                 if (status === 400) throw new Error(`CMC Bad Request: ${cmcErrorMessage} (400).`);
//                 // Generic HTTP error fallback
//                 throw new Error(`CMC request failed (${status}): ${cmcErrorMessage}`);
//             } else if (error.request) { // Network error
//                  throw new Error('Network error connecting to CoinMarketCap API.');
//             }
//         }
//         // Handle errors thrown from the 'try' block (like missing data with code 0) or other setup errors
//         // If the error already has a specific message, re-throw it, otherwise create a generic one
//         throw new Error(error.message || `CMC request processing error`);
//     }
// } // End of makeCmcRequest function

// // --- Cryptocurrency Endpoints ---
// async function getIdMap(params = { listing_status: 'active', start: 1, limit: 5000 }) { return await makeCmcRequest('/cryptocurrency/map', params, 'v1'); }
// async function getMetadata(params = {}) { if (!(params.id || params.symbol || params.slug)) { throw new Error("Requires 'id', 'symbol', or 'slug' parameter for metadata."); } return await makeCmcRequest('/cryptocurrency/info', params, 'v2'); }
// async function getListingsLatest(params = { limit: 100, sort: 'market_cap' }) { return await makeCmcRequest('/cryptocurrency/listings/latest', params, 'v1'); }
// async function getListingsHistorical(params = {}) { if (!params.date) throw new Error("Requires 'date' parameter."); console.warn("CMC: getListingsHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/listings/historical', params, 'v1'); } // Paid
// async function getLatestQuotes(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("Requires 'id', 'symbol', or 'slug' parameter for quotes."); } return await makeCmcRequest('/cryptocurrency/quotes/latest', params, 'v2'); }
// async function getQuotesHistorical(params = {}) { if (!params.id && !params.symbol && !params.slug && !params.time_start) { throw new Error("Requires 'id', 'symbol', 'slug', or 'time_start'."); } console.warn("CMC: getQuotesHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/quotes/historical', params, 'v2'); } // Paid
// async function getMarketPairsLatest(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("Requires 'id', 'symbol', or 'slug'."); } console.warn("CMC: getMarketPairsLatest likely requires PAID PLAN for full data."); return await makeCmcRequest('/cryptocurrency/market-pairs/latest', params, 'v2'); } // Check Plan
// async function getOhlcvLatest(params = {}) { if (!params.id && !params.symbol) { throw new Error("Requires 'id' or 'symbol'."); } console.warn("CMC: getOhlcvLatest likely requires PAID PLAN for multiple symbols."); return await makeCmcRequest('/cryptocurrency/ohlcv/latest', params, 'v2'); } // Check Plan
// async function getOhlcvHistorical(params = {}) { if (!params.id && !params.symbol && !params.slug && !params.time_start) { throw new Error("Requires 'id', 'symbol', 'slug', or 'time_start'."); } console.warn("CMC: getOhlcvHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/ohlcv/historical', params, 'v2'); } // Paid
// async function getPricePerformanceStats(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("Requires 'id', 'symbol', or 'slug'."); } console.warn("CMC: getPricePerformanceStats likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/price-performance-stats/latest', params, 'v2'); } // Check Plan
// async function getCategories(params = { limit: 100, start: 1 }) { return await makeCmcRequest('/cryptocurrency/categories', params, 'v1'); }
// async function getCategory(id) { if (!id) throw new Error("Requires 'id' parameter."); return await makeCmcRequest('/cryptocurrency/category', { id }, 'v1'); } // Pass ID in params obj
// async function getAirdrops(params = { limit: 100, start: 1, status: 'UPCOMING' }) { return await makeCmcRequest('/cryptocurrency/airdrops', params, 'v1'); }
// async function getAirdrop(id) { if (!id) throw new Error("Requires 'id' parameter."); return await makeCmcRequest('/cryptocurrency/airdrop', { id }, 'v1'); } // Pass ID in params obj
// async function getTrendingLatest(params = {}) { console.warn("CMC: getTrendingLatest likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/latest', params, 'v1'); } // Paid likely
// async function getTrendingMostVisited(params = {}) { console.warn("CMC: getTrendingMostVisited likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/most-visited', params, 'v1'); } // Paid likely
// async function getTrendingGainersLosers(params = { time_period: '24h', limit: 10 }) { console.warn("CMC: getTrendingGainersLosers likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/gainers-losers', params, 'v1'); } // Paid likely
// async function getGlobalMetrics() { return await makeCmcRequest('/global-metrics/quotes/latest', {}, 'v1'); }

// // --- DEXScan Endpoints (Using v4) ---
// async function getDexListingsQuotes(params = { limit: 100, sort: 'market_cap' }) { return await makeCmcRequest('/dex/listings/quotes', params, 'v4'); }
// async function getDexListingsInfo(params = {}) { if (!params.id && !params.slug) throw new Error("Need id or slug for DEX listings info."); return await makeCmcRequest('/dex/listings/info', params, 'v4'); }
// async function getDexNetworks(params = {}) { return await makeCmcRequest('/dex/networks/list', params, 'v4'); }
// async function getDexSpotPairsLatest(params = {}) { if (!params.dex_platform_id && !params.dex_platform_slug) { throw new Error("Requires 'dex_platform_id' or 'dex_platform_slug'."); } return await makeCmcRequest('/dex/spot-pairs/latest', params, 'v4'); }
// async function getDexPairsQuotesLatest(params = {}) { if (!params.pair_address) { throw new Error("Requires 'pair_address' parameter (comma-separated string).");} if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair quotes."); return await makeCmcRequest('/dex/pairs/quotes/latest', params, 'v4'); }
// async function getDexPairsOhlcvLatest(params = {}) { if (!params.pair_address) throw new Error("Requires 'pair_address' parameter."); if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair OHLCV latest."); return await makeCmcRequest('/dex/pairs/ohlcv/latest', params, 'v4'); }
// async function getDexPairsOhlcvHistorical(params = {}) { if (!params.pair_address || !params.time_start) { throw new Error("Requires 'pair_address' and 'time_start'."); } if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair OHLCV historical."); console.warn("CMC: getDexPairsOhlcvHistorical might require PAID PLAN credits/tier."); return await makeCmcRequest('/dex/pairs/ohlcv/historical', params, 'v4'); } // Check Plan
// async function getDexPairsTradesLatest(params = {}) { if (!params.pair_address) throw new Error("Requires 'pair_address' parameter."); if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair trades latest."); return await makeCmcRequest('/dex/pairs/trade/latest', params, 'v4'); }


// // --- Exports ---
// console.log('[CMC Service] Defining exports...');
// // console.log('[CMC Service] typeof getLatestQuotes:', typeof getLatestQuotes); // Keep debug logs minimal now
// // console.log('[CMC Service] typeof getGlobalMetrics:', typeof getGlobalMetrics);

// module.exports = {
//     // Crypto
//     getIdMap, getMetadata, getListingsLatest, getListingsHistorical,
//     getLatestQuotes, getQuotesHistorical, getMarketPairsLatest,
//     getOhlcvLatest, getOhlcvHistorical, getPricePerformanceStats,
//     getCategories, getCategory, getAirdrops, getAirdrop,
//     getTrendingLatest, getTrendingMostVisited, getTrendingGainersLosers,
//     getGlobalMetrics,
//     // DEX
//     getDexListingsQuotes, getDexListingsInfo, getDexNetworks,
//     getDexSpotPairsLatest, getDexPairsQuotesLatest, getDexPairsOhlcvLatest,
//     getDexPairsOhlcvHistorical, getDexPairsTradesLatest,
// };
// console.log('[CMC Service] Exports defined.');

// services/coinMarketCap.js
require('dotenv').config();
const axios = require('axios');

const CMC_API_KEY = process.env.CMC_PRO_API_KEY;
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';

if (!CMC_API_KEY) {
    console.warn("WARNING: CMC_PRO_API_KEY not set in .env. CoinMarketCap features will be disabled or fail.");
}

// --- API Request Helper ---
async function makeCmcRequest(endpoint, params = {}, apiVersion = 'v1') {
    if (!CMC_API_KEY) { throw new Error("[CMC] CoinMarketCap API Key is not configured in .env"); } // Added prefix
    const url = `${CMC_BASE_URL}/${apiVersion}${endpoint}`;
    console.log(`[CMC Service] Requesting: ${url} | Params: ${JSON.stringify(params)}`);

    try {
        const response = await axios.get(url, {
            headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
            params: params,
            timeout: 20000
        });

        console.log(`[CMC Service] Received Status Code: ${response.status}`);
        const cmcStatus = response.data?.status;
        const errorCode = cmcStatus?.error_code;
        const errorMsg = cmcStatus?.error_message;

        // Handle CMC Success (error_code is 0)
        if (cmcStatus && (errorCode === 0 || errorCode === "0")) {
            if (response.data.data !== undefined && response.data.data !== null) {
                 console.log(`[CMC Service] Success for ${endpoint} (Code: 0)`);
                return response.data.data;
            } else {
                console.warn(`[CMC Service] CMC OK (Code 0) for ${url} but 'data' missing/null. Status:`, cmcStatus);
                throw new Error(`[CMC] Error: Response OK (Code 0) but no data received for ${endpoint}.`); // Added prefix
            }
        }
        // Handle CMC Application-Level Errors (error_code is not 0)
        else {
            const finalErrorCode = errorCode || 'Unknown';
            const finalErrorMsg = errorMsg || 'Unknown CMC API error structure';
            console.error(`[CMC Service] CMC API Error ${url} (Code: ${finalErrorCode}): ${finalErrorMsg}`);
            if (finalErrorCode === 1006 || finalErrorMsg?.includes("plan doesn't support")) {
                 throw new Error(`[CMC] Plan Error: Your API plan doesn't support this endpoint (${endpoint}).`); // Added prefix
            }
            throw new Error(`[CMC] Error: ${finalErrorMsg} (Code: ${finalErrorCode})`); // Added prefix
        }
    } catch (error) { // Handle Network/HTTP/Other Errors
        console.error(`[CMC Service] Raw Error for ${url}:`, error.message);
        let finalErrorMessage = error.message || 'CMC request processing error'; // Default
        let statusCode = 'Network/Setup Error';

        if (axios.isAxiosError(error)) {
            statusCode = error.response?.status || 'Network Error';
            if (error.response) { // Non-2xx HTTP errors
                const errorData = error.response.data;
                const cmcErrorStatus = errorData?.status;
                const cmcErrorMessage = cmcErrorStatus?.error_message || JSON.stringify(errorData) || error.message;

                if (error.response.status === 401) finalErrorMessage = `API Key invalid/missing (401).`;
                else if (error.response.status === 403) finalErrorMessage = `API Key forbidden/plan issue for endpoint ${endpoint} (403).`;
                else if (error.response.status === 429) finalErrorMessage = `Rate limit hit (429).`;
                else if (error.response.status === 400) finalErrorMessage = `Bad Request: ${cmcErrorMessage} (400).`;
                else finalErrorMessage = `Request failed (${error.response.status}): ${cmcErrorMessage}`;
            } else if (error.request) { // Network error
                 finalErrorMessage = 'Network error connecting to CoinMarketCap API.';
            }
        } else if (error.message?.startsWith('[CMC]')) {
             // If error was already thrown with prefix from try block, just re-throw
             throw error;
        }
        // Ensure prefix is added if not already present
        throw new Error(`[CMC] Error (${statusCode}): ${finalErrorMessage}`);
    }
}

// --- Cryptocurrency Endpoints ---
async function getIdMap(params = { listing_status: 'active', start: 1, limit: 5000 }) { return await makeCmcRequest('/cryptocurrency/map', params, 'v1'); }
async function getMetadata(params = {}) { if (!(params.id || params.symbol || params.slug)) { throw new Error("[CMC] Requires 'id', 'symbol', or 'slug' parameter for metadata."); } return await makeCmcRequest('/cryptocurrency/info', params, 'v2'); } // Added prefix
async function getListingsLatest(params = { limit: 100, sort: 'market_cap' }) { return await makeCmcRequest('/cryptocurrency/listings/latest', params, 'v1'); }
async function getListingsHistorical(params = {}) { if (!params.date) throw new Error("[CMC] Requires 'date' parameter."); console.warn("CMC: getListingsHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/listings/historical', params, 'v1'); } // Paid + Added prefix
async function getLatestQuotes(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("[CMC] Requires 'id', 'symbol', or 'slug' parameter for quotes."); } return await makeCmcRequest('/cryptocurrency/quotes/latest', params, 'v2'); } // Added prefix
async function getQuotesHistorical(params = {}) { if (!params.id && !params.symbol && !params.slug && !params.time_start) { throw new Error("[CMC] Requires 'id', 'symbol', 'slug', or 'time_start'."); } console.warn("CMC: getQuotesHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/quotes/historical', params, 'v2'); } // Paid + Added prefix
async function getMarketPairsLatest(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("[CMC] Requires 'id', 'symbol', or 'slug'."); } console.warn("CMC: getMarketPairsLatest likely requires PAID PLAN for full data."); return await makeCmcRequest('/cryptocurrency/market-pairs/latest', params, 'v2'); } // Check Plan + Added prefix
async function getOhlcvLatest(params = {}) { if (!params.id && !params.symbol) { throw new Error("[CMC] Requires 'id' or 'symbol'."); } console.warn("CMC: getOhlcvLatest likely requires PAID PLAN for multiple symbols."); return await makeCmcRequest('/cryptocurrency/ohlcv/latest', params, 'v2'); } // Check Plan + Added prefix
async function getOhlcvHistorical(params = {}) { if (!params.id && !params.symbol && !params.slug && !params.time_start) { throw new Error("[CMC] Requires 'id', 'symbol', 'slug', or 'time_start'."); } console.warn("CMC: getOhlcvHistorical requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/ohlcv/historical', params, 'v2'); } // Paid + Added prefix
async function getPricePerformanceStats(params = {}) { if (!params.id && !params.symbol && !params.slug) { throw new Error("[CMC] Requires 'id', 'symbol', or 'slug'."); } console.warn("CMC: getPricePerformanceStats likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/price-performance-stats/latest', params, 'v2'); } // Check Plan + Added prefix
async function getCategories(params = { limit: 100, start: 1 }) { return await makeCmcRequest('/cryptocurrency/categories', params, 'v1'); }
async function getCategory(id) { if (!id) throw new Error("[CMC] Requires 'id' parameter."); return await makeCmcRequest('/cryptocurrency/category', { id }, 'v1'); } // Pass ID in params obj + Added prefix
async function getAirdrops(params = { limit: 100, start: 1, status: 'UPCOMING' }) { return await makeCmcRequest('/cryptocurrency/airdrops', params, 'v1'); }
async function getAirdrop(id) { if (!id) throw new Error("[CMC] Requires 'id' parameter."); return await makeCmcRequest('/cryptocurrency/airdrop', { id }, 'v1'); } // Pass ID in params obj + Added prefix
async function getTrendingLatest(params = {}) { console.warn("CMC: getTrendingLatest likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/latest', params, 'v1'); } // Paid likely
async function getTrendingMostVisited(params = {}) { console.warn("CMC: getTrendingMostVisited likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/most-visited', params, 'v1'); } // Paid likely
async function getTrendingGainersLosers(params = { time_period: '24h', limit: 10 }) { console.warn("CMC: getTrendingGainersLosers likely requires PAID PLAN."); return await makeCmcRequest('/cryptocurrency/trending/gainers-losers', params, 'v1'); } // Paid likely
async function getGlobalMetrics() { return await makeCmcRequest('/global-metrics/quotes/latest', {}, 'v1'); }

// --- DEXScan Endpoints (Using v4) ---
async function getDexListingsQuotes(params = { limit: 100, sort: 'market_cap' }) { return await makeCmcRequest('/dex/listings/quotes', params, 'v4'); }
async function getDexListingsInfo(params = {}) { if (!params.id && !params.slug) throw new Error("[CMC] Need id or slug for DEX listings info."); return await makeCmcRequest('/dex/listings/info', params, 'v4'); } // Added prefix
async function getDexNetworks(params = {}) { return await makeCmcRequest('/dex/networks/list', params, 'v4'); }
async function getDexSpotPairsLatest(params = {}) { if (!params.dex_platform_id && !params.dex_platform_slug) { throw new Error("[CMC] Requires 'dex_platform_id' or 'dex_platform_slug'."); } return await makeCmcRequest('/dex/spot-pairs/latest', params, 'v4'); } // Added prefix
async function getDexPairsQuotesLatest(params = {}) { if (!params.pair_address) { throw new Error("[CMC] Requires 'pair_address' parameter (comma-separated string).");} if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair quotes."); return await makeCmcRequest('/dex/pairs/quotes/latest', params, 'v4'); } // Added prefix
async function getDexPairsOhlcvLatest(params = {}) { if (!params.pair_address) throw new Error("[CMC] Requires 'pair_address' parameter."); if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair OHLCV latest."); return await makeCmcRequest('/dex/pairs/ohlcv/latest', params, 'v4'); } // Added prefix
async function getDexPairsOhlcvHistorical(params = {}) { if (!params.pair_address || !params.time_start) { throw new Error("[CMC] Requires 'pair_address' and 'time_start'."); } if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair OHLCV historical."); console.warn("CMC: getDexPairsOhlcvHistorical might require PAID PLAN credits/tier."); return await makeCmcRequest('/dex/pairs/ohlcv/historical', params, 'v4'); } // Check Plan + Added prefix
async function getDexPairsTradesLatest(params = {}) { if (!params.pair_address) throw new Error("[CMC] Requires 'pair_address' parameter."); if (!params.network_slug && !params.network_id) console.warn("[CMC Service] Network slug/id recommended for DEX pair trades latest."); return await makeCmcRequest('/dex/pairs/trade/latest', params, 'v4'); } // Added prefix


// --- Exports ---
module.exports = {
    // Crypto
    getIdMap, getMetadata, getListingsLatest, getListingsHistorical,
    getLatestQuotes, getQuotesHistorical, getMarketPairsLatest,
    getOhlcvLatest, getOhlcvHistorical, getPricePerformanceStats,
    getCategories, getCategory, getAirdrops, getAirdrop,
    getTrendingLatest, getTrendingMostVisited, getTrendingGainersLosers,
    getGlobalMetrics,
    // DEX
    getDexListingsQuotes, getDexListingsInfo, getDexNetworks,
    getDexSpotPairsLatest, getDexPairsQuotesLatest, getDexPairsOhlcvLatest,
    getDexPairsOhlcvHistorical, getDexPairsTradesLatest,
};