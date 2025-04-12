// // services/binanceHelper.js
// require('dotenv').config();
// const Binance = require('node-binance-api');

// const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
// const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

// let binance = null;

// // Initialize Binance client
// try {
//     if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
//         console.warn("[BinanceHelper] WARNING: BINANCE_API_KEY or BINANCE_SECRET_KEY not set. Authenticated endpoints will fail.");
//     }
//      binance = new Binance().options({
//         APIKEY: BINANCE_API_KEY,
//         APISECRET: BINANCE_SECRET_KEY,
//         recvWindow: 10000,
//         verbose: false,
//         log: (log) => { } // Suppress default logging
//     });
//     console.log("[BinanceHelper] Binance client initialized.");
// } catch (error) {
//     console.error("[BinanceHelper] FATAL: Failed to initialize Binance client:", error);
// }

// /**
//  * Standardize symbol format (e.g., btc/usdt -> BTCUSDT).
//  * @param {string} symbol User input symbol.
//  * @returns {string|null} Standardized symbol or null if input is invalid.
//  */
// function standardizeSymbol(symbol) {
//     if (!symbol) return null;
//     return symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
// }

// /**
//  * Fetches all trading pairs and their info from Binance.
//  * @returns {Promise<object>} Exchange information object.
//  * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
//  */
// async function getExchangeInfo() {
//     if (!binance) throw new Error("[BNB] Binance client not initialized.");
//     console.log("[BinanceHelper] Fetching exchange info...");
//     try {
//         const info = await binance.exchangeInfo();
//         console.log(`[BinanceHelper] Fetched info for ${info?.symbols?.length || 0} symbols.`);
//         return info;
//     } catch (error) {
//         console.error("[BinanceHelper] Error fetching exchange info:", error.body || error.message || error);
//         throw new Error(`[BNB] Failed to fetch exchange info: ${error.body || error.message}`);
//     }
// }

// /**
//  * Fetches the latest price for one or more symbols.
//  * @param {string|null} symbol Optional: Specific symbol (e.g., BTCUSDT). If null, fetches all.
//  * @returns {Promise<object>} Object containing price { price: price_string } if symbol provided, or { "SYMBOL": price_string, ... } if no symbol.
//  * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
//  */
// async function getPrice(symbol = null) {
//     if (!binance) throw new Error("[BNB] Binance client not initialized.");
//     const targetSymbol = standardizeSymbol(symbol);
//     console.log(`[BinanceHelper] Fetching price for symbol: ${targetSymbol || 'ALL'}...`);
//     try {
//         const prices = await binance.prices(targetSymbol);
//         if (targetSymbol && prices[targetSymbol] !== undefined) { // Check if the key exists
//              console.log(`[BinanceHelper] Price for ${targetSymbol}: ${prices[targetSymbol]}`);
//              return { price: prices[targetSymbol] }; // Return object with price key
//         } else if (!targetSymbol) {
//              console.log(`[BinanceHelper] Fetched ${Object.keys(prices).length} prices.`);
//              return prices; // Return all prices if no specific symbol
//         } else {
//              // Throw specific error if symbol price wasn't found after requesting it
//              throw new Error(`Symbol ${targetSymbol} not found in price data.`);
//         }
//     } catch (error) {
//         console.error(`[BinanceHelper] Error fetching price for ${targetSymbol || 'ALL'}:`, error.body || error.message || error);
//         // Check if the error is because the symbol wasn't found or another API issue
//         const errorMessage = error.message?.includes('not found') ? error.message : `Failed to fetch price for ${targetSymbol || 'symbol'}: ${error.body || error.message}`;
//         throw new Error(`[BNB] ${errorMessage}`);
//     }
// }

// /**
//  * Fetches the order book depth for a symbol.
//  * @param {string} symbol Trading symbol (e.g., BTCUSDT).
//  * @param {number} limit Number of bids/asks to retrieve (default 100, max 5000).
//  * @returns {Promise<object>} Depth object { bids: {price: qty, ...}, asks: {price: qty, ...} }. Note: Library converts array to object.
//  * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
//  */
// async function getDepth(symbol, limit = 10) {
//     if (!binance) throw new Error("[BNB] Binance client not initialized.");
//     const targetSymbol = standardizeSymbol(symbol);
//     if (!targetSymbol) throw new Error("[BNB] Symbol is required for depth information.");
//     const validLimit = Math.min(Math.max(limit, 5), 100); // Ensure limit is reasonable for display
//     console.log(`[BinanceHelper] Fetching depth for ${targetSymbol} (limit: ${validLimit})...`);
//     try {
//         // The library's depth function returns bids/asks as objects { price: quantity, ... }
//         const depth = await binance.depth(targetSymbol, validLimit);
//         console.log(`[BinanceHelper] Fetched depth for ${targetSymbol}: ${Object.keys(depth?.bids || {}).length} bids, ${Object.keys(depth?.asks || {}).length} asks.`);
//         return depth;
//     } catch (error) {
//         console.error(`[BinanceHelper] Error fetching depth for ${targetSymbol}:`, error.body || error.message || error);
//         throw new Error(`[BNB] Failed to fetch order book depth for ${targetSymbol}: ${error.body || error.message}`);
//     }
// }

// /**
//  * Fetches Kline/OHLCV data for a symbol.
//  * @param {string} symbol Trading symbol (e.g., BTCUSDT).
//  * @param {string} interval Kline interval (e.g., '1h', '4h', '1d', '1w').
//  * @param {number} limit Max number of candles (default 500, max 1000).
//  * @returns {Promise<Array<Array<any>>>} Array of kline data arrays.
//  * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
//  */
// async function getKlines(symbol, interval = '1h', limit = 100) {
//     if (!binance) throw new Error("[BNB] Binance client not initialized.");
//     const targetSymbol = standardizeSymbol(symbol);
//     if (!targetSymbol) throw new Error("[BNB] Symbol is required for kline data.");
//     const validLimit = Math.min(Math.max(limit, 1), 1000);
//     console.log(`[BinanceHelper] Fetching klines for ${targetSymbol} (interval: ${interval}, limit: ${validLimit})...`);
//     try {
//         // **CORRECTION:** Removed the null callback argument. Pass options as the third argument.
//         const klines = await binance.candlesticks(targetSymbol, interval, { limit: validLimit });
//         console.log(`[BinanceHelper] Fetched ${klines.length} klines for ${targetSymbol}.`);
//         return klines;
//     } catch (error) {
//         console.error(`[BinanceHelper] Error fetching klines for ${targetSymbol}:`, error.body || error.message || error);
//         throw new Error(`[BNB] Failed to fetch kline data for ${targetSymbol}: ${error.body || error.message}`);
//     }
// }

// /**
//  * Constructs a link to the Binance trading page for a symbol.
//  * @param {string} symbol Trading symbol (e.g., BTCUSDT).
//  * @returns {string|null} URL string or null if symbol is invalid.
//  */
// function getTradingLink(symbol) {
//     const targetSymbol = standardizeSymbol(symbol);
//     if (!targetSymbol) return null;
//     let pairFormat = targetSymbol;
//     // Basic logic to format common pairs for URL (BTC_USDT)
//     if (targetSymbol.endsWith('USDT')) { pairFormat = `${targetSymbol.slice(0, -4)}_USDT`; }
//     else if (targetSymbol.endsWith('BTC')) { pairFormat = `${targetSymbol.slice(0, -3)}_BTC`; }
//     else if (targetSymbol.endsWith('ETH')) { pairFormat = `${targetSymbol.slice(0, -3)}_ETH`; }
//     else if (targetSymbol.endsWith('USDC')) { pairFormat = `${targetSymbol.slice(0, -4)}_USDC`; }
//     else if (targetSymbol.endsWith('BUSD')) { pairFormat = `${targetSymbol.slice(0, -4)}_BUSD`; }
//     // Add more quote assets if needed (e.g., BNB, EUR, GBP)
//     return `https://www.binance.com/en/trade/${pairFormat}`;
// }

// module.exports = {
//     standardizeSymbol,
//     getExchangeInfo,
//     getPrice,
//     getDepth,
//     getKlines,
//     getTradingLink,
// };

// services/binanceHelper.js
require('dotenv').config();
const Binance = require('node-binance-api');

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

let binance = null;

// Initialize Binance client
try {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        console.warn("[BinanceHelper] WARNING: BINANCE_API_KEY or BINANCE_SECRET_KEY not set. Authenticated endpoints will fail.");
    }
     binance = new Binance().options({
        APIKEY: BINANCE_API_KEY,
        APISECRET: BINANCE_SECRET_KEY,
        recvWindow: 10000,
        verbose: false,
        log: (log) => { } // Suppress default logging
    });
    console.log("[BinanceHelper] Binance client initialized.");
} catch (error) {
    console.error("[BinanceHelper] FATAL: Failed to initialize Binance client:", error);
}

/**
 * Standardize symbol format (e.g., btc/usdt -> BTCUSDT).
 * @param {string} symbol User input symbol.
 * @returns {string|null} Standardized symbol or null if input is invalid.
 */
function standardizeSymbol(symbol) {
    if (!symbol) return null;
    return symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Fetches all trading pairs and their info from Binance.
 * @returns {Promise<object>} Exchange information object.
 * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
 */
async function getExchangeInfo() {
    if (!binance) throw new Error("[BNB] Binance client not initialized.");
    console.log("[BinanceHelper] Fetching exchange info...");
    try {
        const info = await binance.exchangeInfo();
        console.log(`[BinanceHelper] Fetched info for ${info?.symbols?.length || 0} symbols.`);
        return info;
    } catch (error) {
        console.error("[BinanceHelper] Error fetching exchange info:", error.body || error.message || error);
        throw new Error(`[BNB] Failed to fetch exchange info: ${error.body || error.message}`);
    }
}

/**
 * Fetches the latest price for one or more symbols.
 * @param {string|null} symbol Optional: Specific symbol (e.g., BTCUSDT). If null, fetches all.
 * @returns {Promise<object>} Object containing price { price: price_string } if symbol provided, or { "SYMBOL": price_string, ... } if no symbol.
 * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
 */
async function getPrice(symbol = null) {
    if (!binance) throw new Error("[BNB] Binance client not initialized.");
    const targetSymbol = standardizeSymbol(symbol);
    console.log(`[BinanceHelper] Fetching price for symbol: ${targetSymbol || 'ALL'}...`);
    try {
        const prices = await binance.prices(targetSymbol);
        if (targetSymbol && prices[targetSymbol] !== undefined) { // Check if the key exists
             console.log(`[BinanceHelper] Price for ${targetSymbol}: ${prices[targetSymbol]}`);
             return { price: prices[targetSymbol] }; // Return object with price key
        } else if (!targetSymbol) {
             console.log(`[BinanceHelper] Fetched ${Object.keys(prices).length} prices.`);
             return prices; // Return all prices if no specific symbol
        } else {
             // Throw specific error if symbol price wasn't found after requesting it
             throw new Error(`Symbol ${targetSymbol} not found in price data.`);
        }
    } catch (error) {
        console.error(`[BinanceHelper] Error fetching price for ${targetSymbol || 'ALL'}:`, error.body || error.message || error);
        // Check if the error is because the symbol wasn't found or another API issue
        const errorMessage = error.message?.includes('not found') ? error.message : `Failed to fetch price for ${targetSymbol || 'symbol'}: ${error.body || error.message}`;
        throw new Error(`[BNB] ${errorMessage}`);
    }
}

/**
 * Fetches the order book depth for a symbol.
 * @param {string} symbol Trading symbol (e.g., BTCUSDT).
 * @param {number} limit Number of bids/asks to retrieve (default 100, max 5000).
 * @returns {Promise<object>} Depth object { bids: {price: qty, ...}, asks: {price: qty, ...} }. Note: Library converts array to object.
 * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
 */
async function getDepth(symbol, limit = 10) {
    if (!binance) throw new Error("[BNB] Binance client not initialized.");
    const targetSymbol = standardizeSymbol(symbol);
    if (!targetSymbol) throw new Error("[BNB] Symbol is required for depth information.");
    const validLimit = Math.min(Math.max(limit, 5), 100); // Ensure limit is reasonable for display
    console.log(`[BinanceHelper] Fetching depth for ${targetSymbol} (limit: ${validLimit})...`);
    try {
        // The library's depth function returns bids/asks as objects { price: quantity, ... }
        const depth = await binance.depth(targetSymbol, validLimit);
        console.log(`[BinanceHelper] Fetched depth for ${targetSymbol}: ${Object.keys(depth?.bids || {}).length} bids, ${Object.keys(depth?.asks || {}).length} asks.`);
        return depth;
    } catch (error) {
        console.error(`[BinanceHelper] Error fetching depth for ${targetSymbol}:`, error.body || error.message || error);
        throw new Error(`[BNB] Failed to fetch order book depth for ${targetSymbol}: ${error.body || error.message}`);
    }
}

/**
 * Fetches Kline/OHLCV data for a symbol.
 * @param {string} symbol Trading symbol (e.g., BTCUSDT).
 * @param {string} interval Kline interval (e.g., '1h', '4h', '1d', '1w').
 * @param {number} limit Max number of candles (default 500, max 1000).
 * @returns {Promise<Array<Array<any>>>} Array of kline data arrays.
 * @throws {Error} If the API call fails. Includes '[BNB]' prefix.
 */
async function getKlines(symbol, interval = '1h', limit = 100) {
    if (!binance) throw new Error("[BNB] Binance client not initialized.");
    const targetSymbol = standardizeSymbol(symbol);
    if (!targetSymbol) throw new Error("[BNB] Symbol is required for kline data.");
    const validLimit = Math.min(Math.max(limit, 1), 1000);
    console.log(`[BinanceHelper] Fetching klines for ${targetSymbol} (interval: ${interval}, limit: ${validLimit})...`);
    try {
        // **CORRECTION:** Removed the null callback argument. Pass options as the third argument.
        const klines = await binance.candlesticks(targetSymbol, interval, { limit: validLimit });
        console.log(`[BinanceHelper] Fetched ${klines.length} klines for ${targetSymbol}.`);
        return klines;
    } catch (error) {
        console.error(`[BinanceHelper] Error fetching klines for ${targetSymbol}:`, error.body || error.message || error);
        throw new Error(`[BNB] Failed to fetch kline data for ${targetSymbol}: ${error.body || error.message}`);
    }
}

/**
 * Constructs a link to the Binance trading page for a symbol.
 * @param {string} symbol Trading symbol (e.g., BTCUSDT).
 * @returns {string|null} URL string or null if symbol is invalid.
 */
function getTradingLink(symbol) {
    const targetSymbol = standardizeSymbol(symbol);
    if (!targetSymbol) return null;
    let pairFormat = targetSymbol;
    // Basic logic to format common pairs for URL (BTC_USDT)
    if (targetSymbol.endsWith('USDT')) { pairFormat = `${targetSymbol.slice(0, -4)}_USDT`; }
    else if (targetSymbol.endsWith('BTC')) { pairFormat = `${targetSymbol.slice(0, -3)}_BTC`; }
    else if (targetSymbol.endsWith('ETH')) { pairFormat = `${targetSymbol.slice(0, -3)}_ETH`; }
    else if (targetSymbol.endsWith('USDC')) { pairFormat = `${targetSymbol.slice(0, -4)}_USDC`; }
    else if (targetSymbol.endsWith('BUSD')) { pairFormat = `${targetSymbol.slice(0, -4)}_BUSD`; }
    // Add more quote assets if needed (e.g., BNB, EUR, GBP)
    return `https://www.binance.com/en/trade/${pairFormat}`;
}

module.exports = {
    standardizeSymbol,
    getExchangeInfo,
    getPrice,
    getDepth,
    getKlines,
    getTradingLink,
};
