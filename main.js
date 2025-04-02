// require('dotenv').config();
// console.log('[Main] dotenv loaded.');

// const { Client, GatewayIntentBits } = require('discord.js');
// console.log('[Main] discord.js loaded.');

// // Import command handlers
// const { handleWhaleCommand } = require('./commands/whaleWatcher');
// console.log('[Main] whaleWatcher loaded.');
// const { handleCmcCommand } = require('./commands/cmcHandler');
// console.log('[Main] cmcHandler loaded.');
// const { handleHelpCommand } = require('./commands/help');
// console.log('[Main] help loaded.');
// const { handleImageAnalysisCommand } = require('./commands/imageAnalyzer');
// console.log('[Main] imageAnalyzer loaded.');
// const mongoHelper = require('./services/mongoHelper'); // Needed for shutdown
// console.log('[Main] mongoHelper loaded.');
// // Require AI helpers to ensure they initialize and log any startup messages
// require('./services/aiHelper');
// console.log('[Main] aiHelper loaded (initialization logs may appear above).');
// require('./services/openaiHelper');
// console.log('[Main] openaiHelper loaded (initialization logs may appear above).');


// // --- Configuration ---
// const WHALE_PREFIX = "!whale";
// const CMC_PREFIX = "!cmc";
// const HELP_PREFIX = "!help";
// const ANALYZE_PREFIX = "!analyze";
// const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
// const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
// console.log('[Main] Configuration constants set.');

// // Basic environment variable check...
// if (!process.env.DATABASE_NAME || !process.env.DEEPSEEK_API_KEY || !process.env.OPENAI_API_KEY || !process.env.DISCORD_TOKEN || !process.env.CMC_PRO_API_KEY || !process.env.MONGODB_USERNAME || !process.env.MONGODB_PASSWORD || !process.env.MONGODB_CLUSTER) {
//     console.error("FATAL: One or more required environment variables missing. Check .env file thoroughly!");
//     process.exit(1);
// } else {
//     console.log('[Main] Essential environment variables seem present.');
// }
// if (!OPENAI_VISION_MODEL_NAME) {
//      console.warn("Warning: OPENAI_VISION_MODEL is not set in .env, image analysis might fail if default is wrong.");
// }

// // --- Discord Client Setup ---
// console.log('[Main] Creating Discord Client...');
// let client; // Declare client variable
// try {
//     client = new Client({
//         intents: [
//             GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
//         ],
//     });
//     console.log('[Main] Discord Client created successfully.');
// } catch (clientError) {
//     console.error("FATAL: Error creating Discord client:", clientError);
//     process.exit(1);
// }


// // --- Bot Ready Event ---
// console.log('[Main] Setting up "ready" event listener...');
// client.once('ready', async () => {
//     console.log('--- Discord Client Ready! ---'); // Log when ready event fires
//     console.log(`Logged in as ${client.user.tag}`);
//     console.log(`Whale prefix: ${WHALE_PREFIX}`);
//     console.log(`CMC prefix: ${CMC_PREFIX}`);
//     console.log(`Analyze prefix: ${ANALYZE_PREFIX}`);
//     console.log(`Help prefix: ${HELP_PREFIX}`);
//     console.log(`DeepSeek Text Model: ${DEEPSEEK_MODEL_NAME}`);
//     console.log(`OpenAI Vision Model: ${OPENAI_VISION_MODEL_NAME}`);
//     try {
//         await mongoHelper.getMongoClient(); // Initialize DB connection on startup
//         console.log("Initial MongoDB connection check passed on startup.");
//     } catch (error) {
//         // Error handling is inside getMongoClient for initial connect, which should exit
//         console.error("Error during initial MongoDB connection check within ready event.");
//         // Consider if bot should run without DB? For now, it relies on it exiting.
//     }
//     console.log('--- Bot is fully ready and listening! ---');
// });
// console.log('[Main] "ready" event listener attached.');


// // --- Message Handling ---
// console.log('[Main] Setting up "messageCreate" event listener...');
// client.on('messageCreate', async (message) => {
//     // (Message handling logic remains the same as previous version)
//     if (message.author.bot) return;
//     const content = message.content;
//     try {
//         if (content.startsWith(WHALE_PREFIX)) { await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim()); }
//         else if (content.startsWith(CMC_PREFIX)) { await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim()); }
//         else if (content.startsWith(ANALYZE_PREFIX)) {
//              if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Sorry, image analysis (OpenAI) not configured."); return; }
//              if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
//              const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Please attach valid image.`); return; }
//              await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
//         }
//         else if (content.trim().toLowerCase() === HELP_PREFIX) { await handleHelpCommand(message); }
//         else { const lowerContent = content.toLowerCase(); if (lowerContent === 'hello' || lowerContent === 'hi' || message.mentions.has(client.user.id)) { message.reply(`Hello! Use \`${HELP_PREFIX}\` to see commands.`); } }
//     } catch (error) { console.error(`[ERROR] Unhandled exception processing message: ${content}`, error); try { await message.reply("Error processing command."); } catch {} }
// });
// console.log('[Main] "messageCreate" event listener attached.');


// // --- Graceful Shutdown ---
// console.log('[Main] Setting up shutdown listeners...');
// const shutdown = async (signal) => {
//     console.log(`\n${signal} received. Shutting down bot...`);
//     await mongoHelper.closeDatabaseConnection();
//     console.log("Destroying Discord client...");
//     client.destroy();
//     console.log("Shutdown complete.");
//     process.exit(0);
// };
// process.on('SIGINT', () => shutdown('SIGINT'));
// process.on('SIGTERM', () => shutdown('SIGTERM'));
// console.log('[Main] Shutdown listeners attached.');


// // --- Login to Discord ---
// console.log('[Main] Checking Discord Token...');
// const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
// if (!DISCORD_TOKEN) {
//     console.error("FATAL: DISCORD_TOKEN is not set in the .env file. Bot cannot start.");
//     process.exit(1);
// } else {
//     console.log('[Main] Discord Token found. Attempting login...');
//     client.login(DISCORD_TOKEN)
//         .then(() => {
//             console.log('[Main] Discord login successful (waiting for ready event)...');
//             // Ready event will log "Bot is fully ready..."
//         })
//         .catch(error => {
//             // Log specific login errors
//             console.error("FATAL: Failed to login to Discord:", error.message);
//             if (error.code === 'TokenInvalid') {
//                 console.error("Error Specifics: The provided Discord token in .env is invalid.");
//             } else if (error.code === 'DisallowedIntents') {
//                  console.error("Error Specifics: Missing required Gateway Intents (Guilds, GuildMessages, MessageContent). Enable them in Discord Developer Portal -> Bot -> Privileged Gateway Intents.");
//             }
//             process.exit(1);
//         });
//     console.log('[Main] client.login() called.');
// }
// console.log('[Main] End of script execution reached (async operations pending).');

// main.js (with 'ready' event handler commented out, replies ONLY in DMs)
require('dotenv').config();
console.log('[Main] dotenv loaded.');

const { Client, GatewayIntentBits, Partials } = require('discord.js'); // Ensure Partials is imported
console.log('[Main] discord.js loaded.');

// Import command handlers
const { handleWhaleCommand } = require('./commands/whaleWatcher');
console.log('[Main] whaleWatcher loaded.');
const { handleCmcCommand } = require('./commands/cmcHandler');
console.log('[Main] cmcHandler loaded.');
const { handleHelpCommand } = require('./commands/help');
console.log('[Main] help loaded.');
const { handleImageAnalysisCommand } = require('./commands/imageAnalyzer');
console.log('[Main] imageAnalyzer loaded.');
const mongoHelper = require('./services/mongoHelper');
console.log('[Main] mongoHelper loaded.');
require('./services/aiHelper');
console.log('[Main] aiHelper loaded.');
require('./services/openaiHelper');
console.log('[Main] openaiHelper loaded.');


// --- Configuration ---
const WHALE_PREFIX = "!whale";
const CMC_PREFIX = "!cmc";
const HELP_PREFIX = "!help";
const ANALYZE_PREFIX = "!analyze";
const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
console.log('[Main] Configuration constants set.');

// --- Environment Variable Check ---
const requiredEnvVars = [ 'DISCORD_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CMC_PRO_API_KEY', 'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'MONGODB_CLUSTER', 'DATABASE_NAME', 'COLLECTION_NAME', 'AI_MODEL', 'OPENAI_VISION_MODEL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) { console.error(`FATAL: Missing ENV VARS: ${missingEnvVars.join(', ')}`); process.exit(1); }
else { console.log('[Main] Essential environment variables seem present.'); }

// --- Discord Client Setup ---
console.log('[Main] Creating Discord Client...');
let client;
try {
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages, // Keep DM intent
        ],
        partials: [
             Partials.Channel, // Keep DM partial
        ],
    });
    console.log('[Main] Discord Client created successfully with DM Intent/Partials.');
} catch (clientError) { console.error("FATAL: Error creating Discord client:", clientError); process.exit(1); }


// --- Bot Ready Event (Commented Out As Requested) ---
console.log('[Main] Setting up "ready" event listener...');
client.once('ready', async () => {
    console.log('--- Discord Client Ready! ---'); // Log when ready event fires
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Whale prefix: ${WHALE_PREFIX}`);
    console.log(`CMC prefix: ${CMC_PREFIX}`);
    console.log(`Analyze prefix: ${ANALYZE_PREFIX}`);
    console.log(`Help prefix: ${HELP_PREFIX}`);
    console.log(`DeepSeek Text Model: ${DEEPSEEK_MODEL_NAME}`);
    console.log(`OpenAI Vision Model: ${OPENAI_VISION_MODEL_NAME}`);
    try {
        await mongoHelper.getMongoClient(); // Initialize DB connection on startup
        console.log("Initial MongoDB connection check passed on startup.");
    } catch (error) {
        // Error handling is inside getMongoClient for initial connect, which should exit
        console.error("Error during initial MongoDB connection check within ready event.");
        // Consider if bot should run without DB? For now, it relies on it exiting.
    }
    console.log('--- Bot is fully ready and listening! ---');
});
// console.log('[Main] "ready" event listener attachment SKIPPED (Commented out).'); // Log that it's skipped


// --- Message Handling (Replies to Non-Commands ONLY in DMs) ---
console.log('[Main] Setting up "messageCreate" event listener...');
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content || "";
    // Ignore empty messages unless it's analyze cmd maybe?
    if (!content && !content.startsWith(ANALYZE_PREFIX) && message.attachments.size === 0) return;

    try {
        // Command Routing
        if (content.startsWith(WHALE_PREFIX)) {
            await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim());
        } else if (content.startsWith(CMC_PREFIX)) {
            await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim());
        } else if (content.startsWith(ANALYZE_PREFIX)) {
            // (Analyze command logic)
             if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Sorry, image analysis (OpenAI) not configured."); return; }
             if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
             const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Please attach valid image.`); return; }
             await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
        } else if (content.trim().toLowerCase() === HELP_PREFIX) {
            await handleHelpCommand(message);
        } else {
            // --- Respond ONLY to non-command DMs ---
            if (message.channel.isDMBased()) { // Check if it's a DM channel
                 console.log(`[Main] Received non-command message in DM from ${message.author.tag}, guiding to !help.`);
                 if (message.author.id !== client.user?.id) {
                     message.reply(`Hello! I didn't recognize a command. Use \`${HELP_PREFIX}\` to see what I can do.`);
                 }
            }
            // --- Channel messages without prefix are ignored ---
        }
    } catch (error) {
        console.error(`[ERROR] Unhandled exception processing message from ${message.author.tag}: ${content}`, error);
        try { await message.reply("Sorry, an unexpected internal error occurred."); } catch {}
    }
});
console.log('[Main] "messageCreate" event listener attached.');


// --- Graceful Shutdown ---
console.log('[Main] Setting up shutdown listeners...');
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down bot gracefully...`);
    await mongoHelper.closeDatabaseConnection();
    console.log("Destroying Discord client...");
    client.destroy();
    console.log("Shutdown complete. Exiting.");
    process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
console.log('[Main] Shutdown listeners attached.');


// --- Login to Discord ---
console.log('[Main] Checking Discord Token...');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
    console.error("FATAL: DISCORD_TOKEN is not set in the .env file. Bot cannot start.");
    process.exit(1);
} else {
    console.log('[Main] Discord Token found. Attempting login...');
    client.login(DISCORD_TOKEN)
        .then(() => {
            // Note: Actual "ready" confirmation messages are commented out above
            console.log('[Main] Discord login initiated successfully (wait for connection)...');
        })
        .catch(error => {
            console.error("FATAL: Failed to login to Discord:", error.message);
            if (error.code === 'TokenInvalid') { console.error("Error Specifics: Invalid Discord token."); }
            else if (error.code === 'DisallowedIntents') { console.error("Error Specifics: Missing required Gateway Intents (MessageContent/DirectMessages?)."); }
            else { console.error("Discord Login Error Code:", error.code); }
            process.exit(1);
        });
    console.log('[Main] client.login() called.');
}
console.log('[Main] End of main script execution (event loop running).');

