// // commands/help.js
// const { EmbedBuilder } = require('discord.js');

// // Command prefixes (Ensure these match main.js if not using a central config)
// const whalePrefix = "!whale";
// const cmcPrefix = "!cmc";
// const analyzePrefix = "!analyze";
// const helpPrefix = "!help";

// async function handleHelpCommand(message) {
//     const helpEmbed = new EmbedBuilder()
//         .setColor(0x0099FF)
//         .setTitle('📈 Crypto Analysis Bot Help 📉')
//         .setDescription(`Hello! I can help you analyze whale transactions and crypto market data. Ask questions naturally using the command prefixes below.
// *AI Features depend on backend services (DeepSeek/OpenAI) being available.*`)
//         .addFields(
//             // Updated Whale Watcher Section
//             {
//                 name: `🐳 Whale Watcher (\`${whalePrefix}\`)`,
//                 value: `Analyzes large BTC transactions (>1 BTC) from database, returning Top 10 by value for your query.\n` +
//                        `**Examples:**\n` +
//                        `\`${whalePrefix} latest transfers\`\n` +
//                        `\`${whalePrefix} last hour\`\n` +
//                        `\`${whalePrefix} in block 1234567\`\n` +
//                        `\`${whalePrefix} address activity <address>\`\n` +
//                        `\`${whalePrefix} transfers today with value > 10000000000\`\n` + // Note: value is satoshis
//                        `\`${whalePrefix} find hash <tx_hash>\``
//             },
//             // Updated CoinMarketCap Section
//             {
//                 name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
//                 value: `Uses AI (DeepSeek) to understand your query, fetch data from CoinMarketCap, and provide analysis.\n` +
//                        `*(Note: Access to trending, historical data, DEX info, or charting **requires a PAID CMC API plan** by the bot admin. Calls may fail otherwise.)*\n` +
//                        `**Ask naturally! Examples:**\n` +
//                        `\`${cmcPrefix} what is Solana?\` (General Knowledge)\n` +
//                        `\`${cmcPrefix} price of BTC and ETH right now?\`\n` +
//                        `\`${cmcPrefix} global market status\`\n` +
//                        `\`${cmcPrefix} market trend analysis\` *(Paid CMC Plan Likely Needed)*\n` +
//                        `\`${cmcPrefix} top gainers 7d\` *(Paid CMC Plan Likely Needed)*\n` +
//                        `\`${cmcPrefix} info for Cardano\` (Website, description, etc.)\n`+
//                        `\`${cmcPrefix} list categories\`\n`+
//                        `\`${cmcPrefix} upcoming airdrops\`\n`+
//                        `\`${cmcPrefix} dex networks\`\n`+
//                        `\`${cmcPrefix} chart BTC 30d\` *(Paid CMC Plan Required)*\n`+
//                        `*(Disclaimer: Market analysis is AI-generated and NOT financial advice.)*`
//             },
//             // New Image Analysis Section
//             {
//                 name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
//                 value: `Analyzes an attached cryptocurrency chart image using AI (OpenAI Vision).\n` +
//                        `**Usage:** Attach an image directly to your message.\n` +
//                        `**Examples:**\n` +
//                        `\`${analyzePrefix} identify patterns in this chart\` (+ attach image)\n` +
//                        `\`${analyzePrefix} find support and resistance\` (+ attach image)\n` +
//                        `\`${analyzePrefix}\` (+ attach image) *(uses default analysis prompt)*\n` +
//                        `*(Note: Requires bot admin to have configured OpenAI Vision access.)*`
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
//         // Use reply to ping the user who asked for help
//         await message.reply({ embeds: [helpEmbed] });
//     } catch (error) {
//         console.error("Error sending help message:", error);
//         // Fallback if embed fails
//         try {
//             await message.reply("Sorry, couldn't display the full help embed. Use `!whale <query>`, `!cmc <query>`, or `!analyze` + image attachment.");
//         } catch (fallbackError) {
//              console.error("Failed to send fallback help message:", fallbackError);
//         }
//     }
// }

// module.exports = { handleHelpCommand };

// commands/help.js
const { EmbedBuilder } = require('discord.js');
const TOP_N_WHALES_FOR_AI = parseInt(process.env.TOP_N_WHALES_FOR_AI || "20"); // Get limit for help text

// Command prefixes (Ensure these match main.js)
const whalePrefix = "!whale";
const cmcPrefix = "!cmc";
const analyzePrefix = "!analyze";
const helpPrefix = "!help";

async function handleHelpCommand(message) {
    const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Blue color
        .setTitle('📈 Crypto Analysis Bot Help 📉')
        .setDescription(`Hello! I analyze whale transactions, crypto market data, and charts. Ask questions using the prefixes below.
*AI features depend on backend services (DeepSeek/OpenAI) being available & funded.*`)
        .addFields(
            // Updated Whale Watcher Section
            {
                 name: `🐳 Whale Watcher (\`${whalePrefix}\`) - PAID Tier`,
                value: `AI summary & analysis of large BTC transactions (>1 BTC).\n`+
                       `Provides overall summary + Top ${TOP_N_WHALES_FOR_AI} txs by value (details attached as CSV).\n`+
                       `*Requires Paid Membership.*\n` +
                       `**Supported Queries:**\n` +
                       `\`${whalePrefix} latest\` (dataset: 24 hours)\n` + // Clarified behavior
                       `\`${whalePrefix} last hour\`\n` +
                       `\`${whalePrefix} last X hour\` (X: 1-24)\n` +
                       `\`${whalePrefix} last X day\` (X: 1-7)\n` + // Changed from days to day
                       `\`${whalePrefix} today\` / \`yesterday\`\n` +
                       // `\`${whalePrefix} last week\` / \`last month\` (Note: month disabled for performance)\n` + // Removed month, clarify week=7d
                       `\`${whalePrefix} last week\` (Same as last 7 day)\n` +
                       `\`${whalePrefix} block <number>\` (or \`block no. <number>\`)\n` +
                       `\`${whalePrefix} latest block\`\n`+
                       `\`${whalePrefix} block <num1> to <num2>\`\n` +
                       `\`${whalePrefix} hash <tx_hash>\`\n` +
                       `\`${whalePrefix} address <address>\` (Defaults to recent activity)\n` +
                       `\`${whalePrefix} address <address> latest\` (In latest block)\n` +
                       `\`${whalePrefix} address <address> last X hour/day\` (e.g., last 24 hour, last 7 day)\n` +
                       `\`${whalePrefix} value > 10000000000\` (Value in satoshis)`
                       // `\`${whalePrefix} most active last hour\` *(Coming soon)*` 
            },
            // Updated CoinMarketCap Section (DEX Removed, more examples)
            {
                name: `📊 Market Analysis (\`${cmcPrefix}\`)`,
                value: `Uses AI (DeepSeek) + CoinMarketCap data. Ask naturally!\n`+
                       `*(Note: Historical data, charting, trending, full market pairs usually require a PAID CMC API plan. Calls will fail if plan limits exceeded.)*\n` +
                       `**General Knowledge Examples:**\n` +
                       `\`${cmcPrefix} what is defi?\`\n`+
                       `\`${cmcPrefix} compare cardano and polkadot\`\n`+
                       `**CMC Data Examples:**\n`+
                       `\`${cmcPrefix} price btc, eth, doge\`\n`+
                       `\`${cmcPrefix} solana quote\`\n`+
                       `\`${cmcPrefix} market cap dominance\`\n`+
                       `\`${cmcPrefix} global market overview\`\n`+
                       `\`${cmcPrefix} info for ripple\` (Metadata)\n`+
                       `\`${cmcPrefix} list top 10 categories\`\n`+
                       `\`${cmcPrefix} active airdrops\`\n`+
                       `\`${cmcPrefix} market pairs for BTC\` *(Paid Plan likely)*\n` +
                       `--- Paid Plan Features Examples ---\n`+
                       `\`${cmcPrefix} trending coins last 7d\`\n`+
                       `\`${cmcPrefix} top 5 losers today\`\n`+
                       `\`${cmcPrefix} chart ETH 90d\`\n`+
                       `*(Disclaimer: Market analysis is AI-generated and NOT financial advice.)*`
            },
            // Analyze Section (No change needed)
            {
                name: `🖼️ Chart Image Analysis (\`${analyzePrefix}\`)`,
                value: `Analyzes an attached cryptocurrency chart image using AI (OpenAI Vision).\n` +
                       `**Usage:** Attach an image directly to your message.\n` +
                       `**Examples:**\n` +
                       `\`${analyzePrefix} identify patterns in this chart\` (+ attach image)\n` +
                       `\`${analyzePrefix} find support and resistance\` (+ attach image)\n` +
                       `\`${analyzePrefix}\` (+ attach image) *(uses default prompt)*\n` +
                       `*(Note: Requires bot admin to have configured OpenAI Vision access & balance.)*`
            },
            // Standard Help Section
            {
                name: `❓ Help (\`${helpPrefix}\`)`,
                value: `Shows this help message.`
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Replace placeholders like <tx_hash> or <address> with actual values.' });

    try {
        await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
        console.error("Error sending help message:", error);
        try { await message.reply("Sorry, couldn't display the full help embed. Commands start with `!whale`, `!cmc`, `!analyze`, or use `!help`."); }
        catch (fallbackError) { console.error("Failed to send fallback help message:", fallbackError); }
    }
}

module.exports = { handleHelpCommand };

