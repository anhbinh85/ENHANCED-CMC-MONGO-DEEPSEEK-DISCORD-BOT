// // commands/help.js
// const { EmbedBuilder } = require('discord.js');
// const TOP_N_WHALES_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20"); // Get limit for help text

// // Command prefixes (Ensure these match main.js)
// const whalePrefix = "!whale";
// const cmcPrefix = "!cmc";
// const analyzePrefix = "!analyze";
// const helpPrefix = "!help";

// async function handleHelpCommand(message) {
//     const helpEmbed = new EmbedBuilder()
//         .setColor(0x0099FF) // Blue color
//         .setTitle('📈 Crypto Analysis Bot Help 📉')
//         .setDescription(`Hello! I analyze whale transactions, crypto market data, and charts. Ask questions using the prefixes below.
// *AI features depend on backend services (DeepSeek/OpenAI) being available & funded.*`)
//         .addFields(
//             // Updated Whale Watcher Section
//             {
//                  name: `🐳 Whale Watcher (\`${whalePrefix}\`) - PAID Tier`,
//                 value: `AI summary & analysis of large BTC transactions (>1 BTC).\n`+
//                        `Provides overall summary + Top ${TOP_N_WHALES_FOR_AI} txs by value (details attached as CSV).\n`+
//                        `*Requires Paid Membership.*\n` +
//                        `**Supported Queries:**\n` +
//                        `\`${whalePrefix} latest\` (dataset: 24 hours)\n` + // Clarified behavior
//                        `\`${whalePrefix} last hour\`\n` +
//                        `\`${whalePrefix} last X hour\` (X: 1-24)\n` +
//                        `\`${whalePrefix} last X day\` (X: 1-7)\n` + // Changed from days to day
//                        `\`${whalePrefix} today\` / \`yesterday\`\n` +
//                        // `\`${whalePrefix} last week\` / \`last month\` (Note: month disabled for performance)\n` + // Removed month, clarify week=7d
//                        `\`${whalePrefix} last week\` (Same as last 7 day)\n` +
//                        `\`${whalePrefix} block <number>\` (or \`block no. <number>\`)\n` +
//                        `\`${whalePrefix} latest block\`\n`+
//                        `\`${whalePrefix} block <num1> to <num2>\`\n` +
//                        `\`${whalePrefix} hash <tx_hash>\`\n` +
//                        `\`${whalePrefix} address <address>\` (Defaults to recent activity)\n` +
//                        `\`${whalePrefix} address <address> latest\` (In latest block)\n` +
//                        `\`${whalePrefix} address <address> last X hour/day\` (e.g., last 24 hour, last 7 day)\n` +
//                        `\`${whalePrefix} value > 10000000000\` (Value in satoshis)`
//                        // `\`${whalePrefix} most active last hour\` *(Coming soon)*` 
//             },
//             // Updated CoinMarketCap Section (DEX Removed, more examples)
//             {
//                 name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
//                 value: `Uses AI (DeepSeek) + CoinMarketCap data. Ask naturally!\n`+
//                        `*(Note: Historical data, charting, trending, full market pairs usually require a PAID CMC API plan. Calls will fail if plan limits exceeded.)*\n` +
//                        `**General Knowledge Examples:**\n` +
//                        `\`${cmcPrefix} what is defi?\`\n`+
//                        `\`${cmcPrefix} compare cardano and polkadot\`\n`+
//                        `**CMC Data Examples:**\n`+
//                        `\`${cmcPrefix} price btc, eth, doge\`\n`+
//                        `\`${cmcPrefix} solana quote\`\n`+
//                        `\`${cmcPrefix} market cap dominance\`\n`+
//                        `\`${cmcPrefix} global market overview\`\n`+
//                        `\`${cmcPrefix} info for ripple\` (Metadata)\n`+
//                        `\`${cmcPrefix} list top 10 categories\`\n`+
//                        `\`${cmcPrefix} active airdrops\`\n`+
//                        `\`${cmcPrefix} market pairs for BTC\` *(Paid Plan likely)*\n` +
//                        `--- Paid Plan Features Examples ---\n`+
//                        `\`${cmcPrefix} trending coins last 7d\`\n`+
//                        `\`${cmcPrefix} top 5 losers today\`\n`+
//                        `\`${cmcPrefix} chart ETH 90d\`\n`+
//                        `*(Disclaimer: Market analysis is AI-generated and NOT financial advice.)*`
//             },
//             // Analyze Section (No change needed)
//             {
//                 name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
//                 value: `Analyzes an attached cryptocurrency chart image using AI (OpenAI Vision).\n` +
//                        `**Usage:** Attach an image directly to your message.\n` +
//                        `**Examples:**\n` +
//                        `\`${analyzePrefix} identify patterns in this chart\` (+ attach image)\n` +
//                        `\`${analyzePrefix} find support and resistance\` (+ attach image)\n` +
//                        `\`${analyzePrefix}\` (+ attach image) *(uses default prompt)*\n` +
//                        `*(Note: Requires bot admin to have configured OpenAI Vision access & balance.)*`
//             },
//             // Standard Help Section
//             {
//                 name: `❓ Help (\`${helpPrefix}\`)`,
//                 value: `Shows this help message.`
//             }
//         )
//         .setTimestamp()
//         .setFooter({ text: 'Replace placeholders like <tx_hash> or <address> with actual values.' });

//     try {
//         await message.reply({ embeds: [helpEmbed] });
//     } catch (error) {
//         console.error("Error sending help message:", error);
//         try { await message.reply("Sorry, couldn't display the full help embed. Commands start with `!whale`, `!cmc`, `!analyze`, or use `!help`."); }
//         catch (fallbackError) { console.error("Failed to send fallback help message:", fallbackError); }
//     }
// }

// module.exports = { handleHelpCommand };

// commands/help.js
const { EmbedBuilder } = require('discord.js');

// Constants for display limits (ensure these match whaleWatcher.js or use process.env)
const TOP_N_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20");
const MOST_ACTIVE_DISPLAY_LIMIT = 15;
const RELATION_DISPLAY_LIMIT = 15;

// Command prefixes
const whalePrefix = "!whale";
const cmcPrefix = "!cmc";
const analyzePrefix = "!analyze";
const helpPrefix = "!help";
const newsPrefix = "!news";

async function handleHelpCommand(message) {

    const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📈 Crypto Analysis Bot Help 📉')
        .setDescription(`Hello! I analyze whale transactions, crypto market data, news, and charts. Ask questions using the prefixes below.`);

    // --- Add Fields Systematically ---

    // Whale Watcher - Part 1 (General Info & Time)
    helpEmbed.addFields({
        name: `🐳 Whale Watcher (\`${whalePrefix}\`) - General`,
        value: `Provides analysis of large BTC transactions (>1 BTC).\nMost queries give an AI summary & attach a CSV file.\n\n**Time Filters:**\n`+
               ` • \`${whalePrefix} latest\` (Summary of latest block's txs)\n` +
               ` • \`${whalePrefix} last hour\`\n` +
               ` • \`${whalePrefix} last X hour\` (X = 1 to 24)\n` +
               ` • \`${whalePrefix} last X day\` (X = 1 to 7)\n` +
               ` • \`${whalePrefix} today\` / \`yesterday\` / \`last week\` (7d)\n`
    });

    // Whale Watcher - Part 2 (Block, Tx, Address)
    helpEmbed.addFields({
         name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Specific Filters`,
         value: `**Block/Tx Specific:**\n`+
                ` • \`${whalePrefix} block <number>\`\n` +
                ` • \`${whalePrefix} latest block\` (Same as \`latest\`)\n` +
                ` • \`${whalePrefix} block <num1> to <num2>\` (*Note: 7-day block gap check omitted*)\n` +
                ` • \`${whalePrefix} hash <tx_hash>\` (or \`txhash ...\`)\n\n` +
                `**Address Specific:**\n`+
                ` • \`${whalePrefix} address <address>\` (Defaults to last 3 days)\n` +
                ` • \`${whalePrefix} address <address> latest\` (In latest block)\n` +
                ` • \`${whalePrefix} address <address> last X hour/day\` (X=1-24h, 1-7d)\n` +
                ` • \`${whalePrefix} address <address> today/yesterday/week\`\n`
    });

    // Whale Watcher - Part 3 (Special Analysis)
    helpEmbed.addFields({
         name: `🐳 Whale Watcher (\`${whalePrefix}\`) - Special Analysis`,
         value: `**Special Commands:**\n`+
                ` • \`${whalePrefix} cluster <addr> last X hours\` (X=1-24). Shows Top ${RELATION_DISPLAY_LIMIT} counterparties summary (IN/OUT BTC, Count, Types). Attaches CSV with all interactions + TxIDs.\n` +
                ` • \`${whalePrefix} most active last hour\`\n` +
                ` • \`${whalePrefix} most active last X hours\` (X=1-24). Lists Top ${MOST_ACTIVE_DISPLAY_LIMIT} addresses (Count, IN/OUT BTC, Labels). Attaches CSV with full list.\n*(Note: 'cluster' & 'most active' skip AI summary.)*\n` +
                ` • \`${whalePrefix} balance <address>\` (Gets BTC balance for an address)\n`
    });

    // CoinMarketCap Section
    helpEmbed.addFields({
        name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
        value: `Ask naturally for market data real time!\n`+
               `*If a chart is requested, a link to TradingView will be provided.*\n`+
               `**Examples:** \`${cmcPrefix} price btc right now\`, \`${cmcPrefix} what is market right now\`, \`${cmcPrefix} what is solana?\`, \`${cmcPrefix} chart eth 7d\` (link only)`
    });

    // News Section
    helpEmbed.addFields({
        name: `📰 Crypto News (\`${newsPrefix}\`)`,
        value: `Workspacees and summarizes the latest crypto news headlines.\n`+
               `**Usage:** \`${newsPrefix}\``
    });

    // // Analyze Section
    // helpEmbed.addFields({
    //     name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
    //     value: `Analyzes an attached cryptocurrency chart image using AI (OpenAI Vision).\n` +
    //            `**Usage:** Attach an image directly to your message (\`${analyzePrefix} <optional prompt>\`).\n` +
    //            `*(Note: Requires bot admin to have configured OpenAI Vision access & balance.)*`
    // });

    // Standard Help Section
    helpEmbed.addFields({
        name: `❓ Help (\`${helpPrefix}\`)`,
        value: `Shows this help message.`
    });

    // // Set Timestamp & Footer
    // helpEmbed
    //     .setTimestamp()
    //     .setFooter({ text: 'Replace placeholders like <tx_hash>, <address>, or <number> with actual values.' });

    // Send the Embed
    try {
        await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
        console.error("Error sending help message:", error);
        // Check for the specific length error to provide a more informative fallback
        if (error.message.includes("Invalid Form Body") || error.message.includes("value: Must be 1024 or fewer in length")) {
             console.error("Error likely due to embed field exceeding character limit even after split.");
             await message.reply("Sorry, couldn't display the full help embed due to a length issue. Please contact the admin.");
        } else {
             try { await message.reply("Sorry, couldn't display the full help embed. Commands start with `!whale`, `!cmc`, `!news`, `!analyze`, or use `!help`."); }
             catch (fallbackError) { console.error("Failed to send fallback help message:", fallbackError); }
        }
    }
}

module.exports = { handleHelpCommand };



