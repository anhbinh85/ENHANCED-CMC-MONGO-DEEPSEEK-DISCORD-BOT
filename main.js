// // main.js (with 'ready' event handler commented out, replies ONLY in DMs)
// require('dotenv').config();
// console.log('[Main] dotenv loaded.');

// const { Client, GatewayIntentBits, Partials } = require('discord.js'); // Ensure Partials is imported
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
// const mongoHelper = require('./services/mongoHelper');
// console.log('[Main] mongoHelper loaded.');
// require('./services/aiHelper');
// console.log('[Main] aiHelper loaded.');
// require('./services/openaiHelper');
// console.log('[Main] openaiHelper loaded.');


// // --- Configuration ---
// const WHALE_PREFIX = "!whale";
// const CMC_PREFIX = "!cmc";
// const HELP_PREFIX = "!help";
// const ANALYZE_PREFIX = "!analyze";
// const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
// const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
// console.log('[Main] Configuration constants set.');

// // --- Environment Variable Check ---
// const requiredEnvVars = [ 'DISCORD_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CMC_PRO_API_KEY', 'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'MONGODB_CLUSTER', 'DATABASE_NAME', 'COLLECTION_NAME', 'AI_MODEL', 'OPENAI_VISION_MODEL'];
// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
// if (missingEnvVars.length > 0) { console.error(`FATAL: Missing ENV VARS: ${missingEnvVars.join(', ')}`); process.exit(1); }
// else { console.log('[Main] Essential environment variables seem present.'); }

// // --- Discord Client Setup ---
// console.log('[Main] Creating Discord Client...');
// let client;
// try {
//     client = new Client({
//         intents: [
//             GatewayIntentBits.Guilds,
//             GatewayIntentBits.GuildMessages,
//             GatewayIntentBits.MessageContent,
//             GatewayIntentBits.DirectMessages, // Keep DM intent
//         ],
//         partials: [
//              Partials.Channel, // Keep DM partial
//         ],
//     });
//     console.log('[Main] Discord Client created successfully with DM Intent/Partials.');
// } catch (clientError) { console.error("FATAL: Error creating Discord client:", clientError); process.exit(1); }


// // --- Bot Ready Event (Commented Out As Requested) ---
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
// // console.log('[Main] "ready" event listener attachment SKIPPED (Commented out).'); // Log that it's skipped


// // --- Message Handling (Replies to Non-Commands ONLY in DMs) ---
// console.log('[Main] Setting up "messageCreate" event listener...');
// client.on('messageCreate', async (message) => {
//     if (message.author.bot) return;
//     const content = message.content || "";
//     // Ignore empty messages unless it's analyze cmd maybe?
//     if (!content && !content.startsWith(ANALYZE_PREFIX) && message.attachments.size === 0) return;

//     try {
//         // Command Routing
//         if (content.startsWith(WHALE_PREFIX)) {
//             await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim());
//         } else if (content.startsWith(CMC_PREFIX)) {
//             await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim());
//         } else if (content.startsWith(ANALYZE_PREFIX)) {
//             // (Analyze command logic)
//              if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Sorry, image analysis (OpenAI) not configured."); return; }
//              if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
//              const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Please attach valid image.`); return; }
//              await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
//         } else if (content.trim().toLowerCase() === HELP_PREFIX) {
//             await handleHelpCommand(message);
//         } else {
//             // --- Respond ONLY to non-command DMs ---
//             if (message.channel.isDMBased()) { // Check if it's a DM channel
//                  console.log(`[Main] Received non-command message in DM from ${message.author.tag}, guiding to !help.`);
//                  if (message.author.id !== client.user?.id) {
//                      message.reply(`Hello! I didn't recognize a command. Use \`${HELP_PREFIX}\` to see what I can do.`);
//                  }
//             }
//             // --- Channel messages without prefix are ignored ---
//         }
//     } catch (error) {
//         console.error(`[ERROR] Unhandled exception processing message from ${message.author.tag}: ${content}`, error);
//         try { await message.reply("Sorry, an unexpected internal error occurred."); } catch {}
//     }
// });
// console.log('[Main] "messageCreate" event listener attached.');


// // --- Graceful Shutdown ---
// console.log('[Main] Setting up shutdown listeners...');
// const shutdown = async (signal) => {
//     console.log(`\n${signal} received. Shutting down bot gracefully...`);
//     await mongoHelper.closeDatabaseConnection();
//     console.log("Destroying Discord client...");
//     client.destroy();
//     console.log("Shutdown complete. Exiting.");
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
//             // Note: Actual "ready" confirmation messages are commented out above
//             console.log('[Main] Discord login initiated successfully (wait for connection)...');
//         })
//         .catch(error => {
//             console.error("FATAL: Failed to login to Discord:", error.message);
//             if (error.code === 'TokenInvalid') { console.error("Error Specifics: Invalid Discord token."); }
//             else if (error.code === 'DisallowedIntents') { console.error("Error Specifics: Missing required Gateway Intents (MessageContent/DirectMessages?)."); }
//             else { console.error("Discord Login Error Code:", error.code); }
//             process.exit(1);
//         });
//     console.log('[Main] client.login() called.');
// }
// console.log('[Main] End of main script execution (event loop running).');

// main.js
require('dotenv').config();
console.log('[Main] dotenv loaded.');

// --- ADD Partials to require ---
const { Client, GatewayIntentBits, Partials } = require('discord.js');
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
// --- Import News Handler ---
const { handleNewsCommand } = require('./commands/newsHandler');
console.log('[Main] newsHandler loaded.');
// --- End Import ---

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
const NEWS_PREFIX = "!news"; // <-- News Prefix Added
const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
console.log('[Main] Configuration constants set.');

// --- Environment Variable Check ---
const requiredEnvVars = [ 'DISCORD_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CMC_PRO_API_KEY', 'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'MONGODB_CLUSTER', 'DATABASE_NAME', 'COLLECTION_NAME', 'AI_MODEL', 'OPENAI_VISION_MODEL', 'WALLET_LABEL_COLLECTION_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) { console.error(`FATAL: Missing ENV VARS: ${missingEnvVars.join(', ')}`); process.exit(1); }
else { console.log('[Main] Essential environment variables seem present.'); }

// --- Discord Client Setup (Adding Partials.Message) ---
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
             Partials.Channel, // Required for DM events
             Partials.Message, // Added: May help with fetching full message data in DMs
             // Partials.User, // Optional
        ],
    });
    console.log('[Main] Discord Client created successfully with DM Intent/Partials.');
} catch (clientError) { console.error("FATAL: Error creating Discord client:", clientError); process.exit(1); }


// --- Bot Ready Event (Still Commented Out As Requested) ---
console.log('[Main] Setting up "ready" event listener...');
client.once('ready', async () => {
    console.log('--- Discord Client Ready! ---');
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Whale prefix: ${WHALE_PREFIX}`);
    console.log(`CMC prefix: ${CMC_PREFIX}`);
    console.log(`Analyze prefix: ${ANALYZE_PREFIX}`);
    console.log(`Help prefix: ${HELP_PREFIX}`);
    console.log(`News prefix: ${NEWS_PREFIX}`); // Added news prefix here too
    console.log(`DeepSeek Text Model: ${DEEPSEEK_MODEL_NAME}`);
    console.log(`OpenAI Vision Model: ${OPENAI_VISION_MODEL_NAME}`);
    try { await mongoHelper.getMongoClient(); console.log("MongoDB connection OK on startup."); }
    catch (error) { console.error("Error during initial MongoDB connection check."); }
    console.log('--- Bot is fully ready and listening! ---');
});
console.log('[Main] "ready" event listener attachment SKIPPED (Commented out).');


// --- Message Handling (Includes News, DM-only non-command replies) ---
console.log('[Main] Setting up "messageCreate" event listener...');
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content || "";
    // Refined check: Ignore if no text AND no attachment (allows !analyze with just attachment)
    if (!content && message.attachments.size === 0) return;

    try {
        // --- Command Routing ---
        if (content.startsWith(WHALE_PREFIX)) {
            await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim());
        } else if (content.startsWith(CMC_PREFIX)) {
            // Assuming whopService.checkMembership would be added here if needed later
            // const userTier = await whopService.checkMembership(message.author.id);
            // await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim(), userTier);
            await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim(), 'PAID'); // Temp: Assume PAID for testing CMC handler fully
        } else if (content.startsWith(ANALYZE_PREFIX)) {
            // (Analyze command logic)
             if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Image analysis disabled."); return; }
             if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
             const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Attach valid image.`); return; }
             await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
        } else if (content.trim().toLowerCase() === HELP_PREFIX) {
            // Assuming whopService.checkMembership would be added here if needed later
             // const userTier = await whopService.checkMembership(message.author.id);
             // await handleHelpCommand(message, userTier);
             await handleHelpCommand(message, 'PAID'); // Temp: Assume PAID for testing help display
        }
        // --- ADDED NEWS COMMAND ROUTE ---
        else if (content.startsWith(NEWS_PREFIX)) {
            // Assuming FREE/PAID access for now, no explicit tier check yet
            console.log(`[Main] Routing to News Handler for query: ${content}`);
            await handleNewsCommand(message); // Pass the whole message object
        }
        // --- END NEWS COMMAND ROUTE ---
        else {
            // --- Respond ONLY to non-command DMs ---
            if (message.channel.isDMBased()) {
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
// (Same as previous version)
console.log('[Main] Setting up shutdown listeners...');
const shutdown = async (signal) => { console.log(`\n${signal} received...`); await mongoHelper.closeDatabaseConnection(); console.log("Destroying client..."); client.destroy(); console.log("Shutdown complete."); process.exit(0); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
console.log('[Main] Shutdown listeners attached.');


// --- Login to Discord ---
// (Same as previous version)
console.log('[Main] Checking Discord Token...');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; if (!DISCORD_TOKEN) { console.error("FATAL: DISCORD_TOKEN missing."); process.exit(1); }
else { console.log('[Main] Discord Token found. Attempting login...'); client.login(DISCORD_TOKEN).then(() => { console.log('[Main] Discord login initiated...'); }).catch(error => { console.error("FATAL: Discord login failed:", error.message); if (error.code === 'TokenInvalid') { console.error("Specifics: Invalid Discord token."); } else if (error.code === 'DisallowedIntents') { console.error("Specifics: Missing Intents (MessageContent/DirectMessages?). Check Dev Portal!"); } else { console.error("Code:", error.code); } process.exit(1); }); console.log('[Main] client.login() called.'); }
console.log('[Main] End of main script execution (event loop running).');




