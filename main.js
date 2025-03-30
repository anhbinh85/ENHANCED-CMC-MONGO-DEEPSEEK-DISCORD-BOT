// main.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Import command handlers
const { handleWhaleCommand } = require('./commands/whaleWatcher');
const { handleCmcCommand } = require('./commands/cmcHandler'); // Use new handler
const { handleHelpCommand } = require('./commands/help');
const mongoHelper = require('./services/mongoHelper'); // Needed for shutdown

// --- Configuration ---
const WHALE_PREFIX = "!whale";
const CMC_PREFIX = "!cmc"; // Use !cmc prefix
const HELP_PREFIX = "!help";
const AI_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';

// Basic environment variable check... (ensure all needed keys are checked)
if (!process.env.DATABASE_NAME || !process.env.DEEPSEEK_API_KEY || !process.env.DISCORD_TOKEN || !process.env.CMC_PRO_API_KEY /* ... other mongo keys ... */) {
    console.error("FATAL: One or more required environment variables missing."); process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, ], });

// --- Bot Ready Event ---
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Whale prefix: ${WHALE_PREFIX}`);
    console.log(`CMC prefix: ${CMC_PREFIX}`); // Log new prefix
    console.log(`Help prefix: ${HELP_PREFIX}`);
    console.log(`AI Model: ${AI_MODEL_NAME}`);
    try { await mongoHelper.getMongoClient(); console.log("MongoDB connection OK on startup."); }
    catch (error) { console.error("Exiting: initial MongoDB connection failed."); }
});

// --- Message Handling ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content;

    // --- Command Routing ---
    try {
        if (content.startsWith(WHALE_PREFIX)) {
            const userQuery = content.substring(WHALE_PREFIX.length).trim();
            await handleWhaleCommand(message, userQuery);
        } else if (content.startsWith(CMC_PREFIX)) { // Route to CMC handler
            const userQuery = content.substring(CMC_PREFIX.length).trim();
            await handleCmcCommand(message, userQuery);
        } else if (content.trim().toLowerCase() === HELP_PREFIX) {
            await handleHelpCommand(message);
        } else {
            // Prefixless interaction check
             const lowerContent = content.toLowerCase();
             if (lowerContent === 'hello' || lowerContent === 'hi' || message.mentions.has(client.user.id)) {
                  message.reply(`Hello! Use \`${HELP_PREFIX}\` to see available commands.`);
             }
        }
    } catch (error) {
        console.error(`[ERROR] Unhandled exception processing message: ${content}`, error);
        try { await message.reply("Sorry, an unexpected error occurred."); } catch {}
    }
});

// --- Graceful Shutdown ---
// (Same as previous version)
const shutdown = async (signal) => { console.log(`\n${signal} received...`); await mongoHelper.closeDatabaseConnection(); console.log("Destroying client..."); client.destroy(); console.log("Shutdown complete."); process.exit(0); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));

// --- Login to Discord ---
// (Same as previous version)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; if (!DISCORD_TOKEN) { console.error("FATAL: DISCORD_TOKEN missing."); process.exit(1); } else { client.login(DISCORD_TOKEN).catch(e => { console.error("FATAL: Discord login failed:", e); process.exit(1); }); }