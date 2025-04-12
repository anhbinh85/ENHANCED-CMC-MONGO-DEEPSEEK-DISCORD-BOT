// // commands/help.js
// const { EmbedBuilder } = require('discord.js');

// // Constants for display limits (ensure these match whaleWatcher.js or use process.env)
// const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
// const MOST_ACTIVE_DISPLAY_LIMIT = 15;
// const RELATION_DISPLAY_LIMIT = 15;

// // Command prefixes
// const whalePrefix = "!whale";
// const cmcPrefix = "!cmc";
// const analyzePrefix = "!analyze";
// const helpPrefix = "!help";
// const newsPrefix = "!news";

// async function handleHelpCommand(message) {

//     const helpEmbed = new EmbedBuilder()
//         .setColor(0x0099FF)
//         .setTitle('📈 Crypto Analysis Bot Help 📉')
//         .setDescription(`Hello! I analyze whale transactions, crypto market data, news, and charts. Ask questions using the prefixes below.`);

//     // --- Add Fields Systematically ---

//     // Whale Watcher - Part 1 (General Info & Time)
//     helpEmbed.addFields({
//         name: `🐳 Whale Watcher (\`${whalePrefix}\`) - General`,
//         value: `Provides analysis of large BTC transactions (>1 BTC).\nMost queries give an AI summary & attach a CSV file.\n\n**Time Filters:**\n`+
//                ` • \`${whalePrefix} latest\` (Summary of latest block's txs)\n` +
//                ` • \`${whalePrefix} last hour\`\n` +
//                ` • \`${whalePrefix} last X hour\` (X = 1 to 24)\n` +
//                ` • \`${whalePrefix} last X day\` (X = 1 to 7)\n` +
//                ` • \`${whalePrefix} today\` / \`yesterday\` / \`last week\` (7d)\n`
//     });

//     // Whale Watcher - Part 2 (Block, Tx, Address)
//     helpEmbed.addFields({
//          name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Specific Filters`,
//          value: `**Block/Tx Specific:**\n`+
//                 ` • \`${whalePrefix} block <number>\`\n` +
//                 ` • \`${whalePrefix} latest block\` (Same as \`latest\`)\n` +
//                 ` • \`${whalePrefix} block <num1> to <num2>\` (*Note: 7-day block gap check omitted*)\n` +
//                 ` • \`${whalePrefix} hash <tx_hash>\` (or \`txhash ...\`)\n\n` +
//                 `**Address Specific:**\n`+
//                 ` • \`${whalePrefix} address <address>\` (Defaults to last 3 days)\n` +
//                 ` • \`${whalePrefix} address <address> latest\` (In latest block)\n` +
//                 ` • \`${whalePrefix} address <address> last X hour/day\` (X=1-24h, 1-7d)\n` +
//                 ` • \`${whalePrefix} address <address> today/yesterday/week\`\n`
//     });

//     // Whale Watcher - Part 3 (Special Analysis)
//     helpEmbed.addFields({
//          name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Special Analysis`,
//          value: `**Special Commands:**\n`+
//                 ` • \`${whalePrefix} cluster <addr> last X hours\` (X=1-24). Shows Top ${RELATION_DISPLAY_LIMIT} counterparties summary (IN/OUT BTC, Count, Types). Attaches CSV with all interactions + TxIDs.\n` +
//                 ` • \`${whalePrefix} most active last hour\`\n` +
//                 ` • \`${whalePrefix} most active last X hours\` (X=1-24). Lists Top ${MOST_ACTIVE_DISPLAY_LIMIT} addresses (Count, IN/OUT BTC, Labels). Attaches CSV with full list.\n*(Note: 'cluster' & 'most active' skip AI summary.)*\n` +
//                 ` • \`${whalePrefix} balance <address>\` (Gets BTC balance for an address)\n`
//     });

//     // CoinMarketCap Section
//     helpEmbed.addFields({
//         name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
//         value: `Ask naturally for market data real time!\n`+
//                `*If a chart is requested, a link to TradingView will be provided.*\n`+
//                `**Examples:** \`${cmcPrefix} price btc right now\`, \`${cmcPrefix} what is market right now\`, \`${cmcPrefix} what is solana?\`, \`${cmcPrefix} chart eth 7d\` (link only)`
//     });

//     // News Section
//     helpEmbed.addFields({
//         name: `📰 Crypto News (\`${newsPrefix}\`)`,
//         value: `Workspacees and summarizes the latest crypto news headlines.\n`+
//                `**Usage:** \`${newsPrefix}\``
//     });

//     // // Analyze Section
//     // helpEmbed.addFields({
//     //     name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
//     //     value: `Analyzes an attached cryptocurrency chart image using AI (OpenAI Vision).\n` +
//     //            `**Usage:** Attach an image directly to your message (\`${analyzePrefix} <optional prompt>\`).\n` +
//     //            `*(Note: Requires bot admin to have configured OpenAI Vision access & balance.)*`
//     // });

//     // Standard Help Section
//     helpEmbed.addFields({
//         name: `❓ Help (\`${helpPrefix}\`)`,
//         value: `Shows this help message.`
//     });

//     // // Set Timestamp & Footer
//     // helpEmbed
//     //     .setTimestamp()
//     //     .setFooter({ text: 'Replace placeholders like <tx_hash>, <address>, or <number> with actual values.' });

//     // Send the Embed
//     try {
//         await message.reply({ embeds: [helpEmbed] });
//     } catch (error) {
//         console.error("Error sending help message:", error);
//         // Check for the specific length error to provide a more informative fallback
//         if (error.message.includes("Invalid Form Body") || error.message.includes("value: Must be 1024 or fewer in length")) {
//              console.error("Error likely due to embed field exceeding character limit even after split.");
//              await message.reply("Sorry, couldn't display the full help embed due to a length issue. Please contact the admin.");
//         } else {
//              try { await message.reply("Sorry, couldn't display the full help embed. Commands start with `!whale`, `!cmc`, `!news`, `!analyze`, or use `!help`."); }
//              catch (fallbackError) { console.error("Failed to send fallback help message:", fallbackError); }
//         }
//     }
// }

// module.exports = { handleHelpCommand };

// commands/help.js
const { EmbedBuilder } = require('discord.js');
// Constants for display limits
const MOST_ACTIVE_DISPLAY_LIMIT = 15;
const RELATION_DISPLAY_LIMIT = 15;

// Command prefixes
const whalePrefix = "!whale";
const cmcPrefix = "!cmc";
const analyzePrefix = "!analyze";
const helpPrefix = "!help";
const newsPrefix = "!news";
const binancePrefix = "!binance"; // Added

async function handleHelpCommand(message) {

    const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📈 Crypto Analysis Bot Help 📉')
        .setDescription(`Hello! I analyze whale transactions, market data, news, and charts using various sources.\n*Error messages may start with [BCR], [CMC], [BNB], [DS], [GE], [OAI], [DB], or [System] to indicate the source.*`);

    // Whale Watcher Section
    helpEmbed.addFields(
        { name: `🐳 Whale Watcher (\`${whalePrefix}\`) - General`, value: `Provides analysis of large BTC transactions (>1 BTC) from MongoDB.\nMost queries give an AI summary & attach a CSV file.\n\n**Time Filters:**\n • \`${whalePrefix} latest\`\n • \`${whalePrefix} last hour\`\n • \`${whalePrefix} last X hour\` (X=1-24)\n • \`${whalePrefix} last X day\` (X=1-7)\n • \`${whalePrefix} today\` / \`yesterday\` / \`last week\` (7d)`},
        { name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Specific Filters`, value: `**Block/Tx Specific:**\n • \`${whalePrefix} block <number>\`\n • \`${whalePrefix} latest block\`\n • \`${whalePrefix} block <num1> to <num2>\`\n • \`${whalePrefix} hash <tx_hash>\`\n\n**Address Specific:**\n • \`${whalePrefix} address <address>\` (Default: last 3 days)\n • \`${whalePrefix} address <address> latest\`\n • \`${whalePrefix} address <address> last X hour/day\`\n • \`${whalePrefix} address <address> today/yesterday/week\``},
        { name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Special Analysis`, value: `**Special Commands:**\n • \`${whalePrefix} fee\` Shows BTC network fee estimates (Price source: Binance).\n • \`${whalePrefix} balance <address>\` Gets BTC balance via Blockcypher.\n • \`${whalePrefix} cluster <addr> last X hours\` (X=1-24). Top ${RELATION_DISPLAY_LIMIT} counterparties + CSV.\n • \`${whalePrefix} most active last X hours\` (X=1-24). Top ${MOST_ACTIVE_DISPLAY_LIMIT} addresses + CSV.\n*(Note: 'cluster', 'most active', 'balance', 'fee' skip AI summary.)*`}
    );

    // Binance Section (New)
    helpEmbed.addFields({
        name: `🔶 Binance Info (\`${binancePrefix}\`)`,
        value: `Interact with Binance market data.\n`+
               ` • \`${binancePrefix} price <SYMBOL>\` (e.g., \`BTCUSDT\`, \`ethbtc\`) - Gets latest price.\n`+
               ` • \`${binancePrefix} depth <SYMBOL> [LIMIT]\` (e.g., \`BTCUSDT 10\`) - Shows order book depth (default/max limit: 10).\n`+
               ` • \`${binancePrefix} klines <SYMBOL> <INTERVAL> [LIMIT]\` (e.g., \`BTCUSDT 1h 50\`) - Gets recent OHLCV data (no indicators).\n`+
               ` • \`${binancePrefix} analyze <SYMBOL> <INTERVAL> [LIMIT]\` - Gets price, depth, klines & AI analysis.\n`+
               ` • \`${binancePrefix} link <SYMBOL>\` - Provides link to Binance trading page.\n`+
               ` • \`${binancePrefix} tickers\` - Lists available symbols (limited display).\n`+
               `*(Note: Technical indicators like RSI/MACD are not provided directly; use the 'link' command or view charts on Binance.)*`
    });

    // CoinMarketCap Section
    helpEmbed.addFields({
        name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
        value: `Ask naturally for market data via CoinMarketCap & AI (\`${process.env.AI_PROVIDER}\`).\n`+
               ` • **Price Queries:** Returns formatted stats or AI analysis.\n`+
               ` • **Chart Queries:** Provides a TradingView link (e.g., \`${cmcPrefix} chart eth 7d\`).\n`+
               `*(Note: Historical data, trending, etc., often require a PAID CMC API plan.)*`
    });

    // News Section
    helpEmbed.addFields({
        name: `📰 Crypto News (\`${newsPrefix}\`)`,
        value: `Summarizes latest news via RSS & AI (\`${process.env.AI_PROVIDER}\`).\n**Usage:** \`${newsPrefix}\``
    });

    // Analyze Section
    helpEmbed.addFields({
        name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
        value: `Analyzes an attached crypto chart image using OpenAI Vision.\n**Usage:** Attach image + \`${analyzePrefix} <optional prompt>\`.\n*(Requires OpenAI Vision setup)*`
    });

    // Standard Help Section
    helpEmbed.addFields({
        name: `❓ Help (\`${helpPrefix}\`)`,
        value: `Shows this help message.`
    });

    // Set Timestamp & Footer
    helpEmbed
        .setTimestamp()
        .setFooter({ text: 'Replace placeholders like <SYMBOL>, <address>, <number> with actual values.' });

    // Send the Embed
    try {
        await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
        console.error("Error sending help message:", error);
        if (error.message.includes("Invalid Form Body") || error.message.includes("value: Must be 1024 or fewer in length") || error.code === 50035 ) {
             console.error("Error likely due to embed field exceeding character limit.");
             await message.reply("Sorry, couldn't display the full help embed due to a length issue. Please contact the admin.");
        } else {
             try { await message.reply("Sorry, couldn't display the full help embed. Use `!help`."); }
             catch (fallbackError) { console.error("Failed to send fallback help message:", fallbackError); }
        }
    }
}

module.exports = { handleHelpCommand };



