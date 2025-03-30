// commands/help.js
const { EmbedBuilder } = require('discord.js');

// Command prefixes (could import from config.js later)
const whalePrefix = "!whale";
const cmcPrefix = "!cmc"; // Use new prefix
const helpPrefix = "!help";

async function handleHelpCommand(message) {
    const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Crypto Bot Help')
        .setDescription('Here are the available command categories:')
        .addFields(
            {
                name: `🐳 Whale Watcher (\`${whalePrefix}\`)`,
                value: `Analyzes large BTC transactions (>1 BTC) from database.\nExamples:\n` +
                       `\`${whalePrefix} latest transfers\`\n` +
                       `\`${whalePrefix} find hash <tx_hash>\`\n` +
                       `\`${whalePrefix} transfers yesterday\``
            },
            {
                name: `📈 CoinMarketCap (\`${cmcPrefix}\`)`,
                value: `Provides market data & AI analysis via CoinMarketCap & DeepSeek.\n`+
                       `*(Note: Advanced features like historical data, DEX info, and charting require a PAID CMC API plan.)*\nExamples:\n` +
                       `\`${cmcPrefix} quote BTC,ETH\`\n`+
                       `\`${cmcPrefix} global\` (Global metrics)\n`+
                       `\`${cmcPrefix} trending\`\n`+
                       `\`${cmcPrefix} gainers\` or \`${cmcPrefix} losers\`\n`+
                       `\`${cmcPrefix} airdrops\`\n`+
                       `\`${cmcPrefix} info SOL\` (Metadata)\n`+
                       `\`${cmcPrefix} category DePIN\`\n`+
                       `\`${cmcPrefix} pairs BTC\` (Market pairs)\n`+
                       `\`${cmcPrefix} dex networks\`\n`+
                       `\`${cmcPrefix} dex quotes <pair_address>,<pair_address2>\`\n`+
                       `--- Charting (Requires Paid CMC Plan) ---\n`+
                       `\`${cmcPrefix} chart BTC 7d\`\n`+
                       `\`${cmcPrefix} chart ETH 1m ohlcv\`\n`+
                       `*(Disclaimer: Market analysis is AI-generated and NOT financial advice.)*`
            },
            {
                name: `❓ Help (\`${helpPrefix}\`)`,
                value: `Shows this help message.`
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Replace placeholders like <tx_hash> or <address> with actual values.' });

    try { await message.reply({ embeds: [helpEmbed] }); }
    catch (error) { console.error("Error sending help message:", error); }
}

module.exports = { handleHelpCommand };