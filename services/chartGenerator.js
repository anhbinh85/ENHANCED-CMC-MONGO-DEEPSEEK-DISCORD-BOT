// services/chartGenerator.js
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs'); // Only needed if saving file, not for buffer

// Configuration for the chart image
const width = 800; // px
const height = 400; // px
const backgroundColour = 'white'; // Chart background
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

/**
 * Generates a Price/Volume chart image buffer from historical OHLCV data.
 * @param {string} symbol - The crypto symbol (for title).
 * @param {Array<object>} ohlcvData - Array of objects like { time_close, quote: { USD: { price, volume } } } or similar OHLCV structure.
 * Assumes data is sorted chronologically.
 * @returns {Promise<Buffer|null>} - A Promise resolving to the PNG image buffer or null if error.
 */
async function generatePriceVolumeChart(symbol, ohlcvData) {
    if (!ohlcvData || ohlcvData.length === 0) {
        console.warn(`[ChartGenerator] No data provided for ${symbol} chart.`);
        return null;
    }

    console.log(`[ChartGenerator] Generating chart for ${symbol} with ${ohlcvData.length} data points.`);

    try {
        // Extract data for Chart.js format
        const labels = ohlcvData.map(d => new Date(d.time_close || d.timestamp || d.time_open).toLocaleDateString()); // Use appropriate time field
        // Access nested price/volume based on CMC response structure (adjust if needed!)
        const priceData = ohlcvData.map(d => d.quote?.USD?.price || d.quote?.USD?.close || d.price || d.close); // Handle variations
        const volumeData = ohlcvData.map(d => d.quote?.USD?.volume || d.volume);

        // Ensure we actually extracted data
        if (priceData.some(p => p === undefined) || volumeData.some(v => v === undefined)) {
             console.warn(`[ChartGenerator] Could not extract price/volume data correctly for ${symbol}. Check CMC response structure.`);
             // Example data point for debugging: console.log(ohlcvData[0]);
             // return null; // Or try to chart just price if volume missing?
        }


        const configuration = {
            type: 'line', // Or 'bar' for volume? Combine?
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${symbol} Price (USD)`,
                        data: priceData,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        yAxisID: 'yPrice', // Link to price axis
                    },
                    // Optional: Add Volume as a Bar chart on a second axis
                    // {
                    //     label: `${symbol} Volume`,
                    //     data: volumeData,
                    //     backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    //     type: 'bar', // Specify bar type for this dataset
                    //     yAxisID: 'yVolume', // Link to volume axis
                    // }
                ],
            },
            options: {
                responsive: false, // Important for node generation
                animation: false, // Disable animation for static image
                 plugins: {
                     title: { display: true, text: `${symbol} Price Chart` },
                     legend: { display: true }
                 },
                scales: {
                    x: {
                        title: { display: true, text: 'Date' }
                    },
                    yPrice: { // Price Axis
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Price (USD)' }
                    },
                    // yVolume: { // Optional Volume Axis
                    //     type: 'linear',
                    //     display: true,
                    //     position: 'right',
                    //     title: { display: true, text: 'Volume' },
                    //     grid: { drawOnChartArea: false }, // only draw axis grid lines
                    // },
                }
            },
        };

        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration, 'image/png');
        console.log(`[ChartGenerator] Successfully generated chart buffer for ${symbol}.`);
        return imageBuffer;

    } catch (error) {
        console.error(`[ChartGenerator] Error generating chart for ${symbol}:`, error);
        return null;
    }
}


module.exports = {
    generatePriceVolumeChart,
    // Add more chart types here (e.g., DEX volume, gainers/losers bar chart)
};

// IMPORTANT: Requires system dependencies for 'canvas' package!
// On Debian/Ubuntu: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
// On CentOS/Fedora: sudo yum install gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel
// On macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg