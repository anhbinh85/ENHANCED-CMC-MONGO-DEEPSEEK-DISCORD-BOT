// // main.js
// require('dotenv').config();
// console.log('[Main] dotenv loaded.');

// // --- ADD Partials to require ---
// const { Client, GatewayIntentBits, Partials } = require('discord.js');
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
// // --- Import News Handler ---
// const { handleNewsCommand } = require('./commands/newsHandler');
// console.log('[Main] newsHandler loaded.');
// // --- End Import ---

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
// const NEWS_PREFIX = "!news"; // <-- News Prefix Added
// const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
// const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
// console.log('[Main] Configuration constants set.');

// // --- Environment Variable Check ---
// const requiredEnvVars = [ 'DISCORD_TOKEN', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CMC_PRO_API_KEY', 'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'MONGODB_CLUSTER', 'DATABASE_NAME', 'COLLECTION_NAME', 'AI_MODEL', 'OPENAI_VISION_MODEL', 'WALLET_LABEL_COLLECTION_NAME'];
// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
// if (missingEnvVars.length > 0) { console.error(`FATAL: Missing ENV VARS: ${missingEnvVars.join(', ')}`); process.exit(1); }
// else { console.log('[Main] Essential environment variables seem present.'); }

// // --- Discord Client Setup (Adding Partials.Message) ---
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
//              Partials.Channel, // Required for DM events
//              Partials.Message, // Added: May help with fetching full message data in DMs
//              // Partials.User, // Optional
//         ],
//     });
//     console.log('[Main] Discord Client created successfully with DM Intent/Partials.');
// } catch (clientError) { console.error("FATAL: Error creating Discord client:", clientError); process.exit(1); }


// // --- Bot Ready Event (Still Commented Out As Requested) ---
// console.log('[Main] Setting up "ready" event listener...');
// client.once('ready', async () => {
//     console.log('--- Discord Client Ready! ---');
//     console.log(`Logged in as ${client.user.tag}`);
//     console.log(`Whale prefix: ${WHALE_PREFIX}`);
//     console.log(`CMC prefix: ${CMC_PREFIX}`);
//     console.log(`Analyze prefix: ${ANALYZE_PREFIX}`);
//     console.log(`Help prefix: ${HELP_PREFIX}`);
//     console.log(`News prefix: ${NEWS_PREFIX}`); // Added news prefix here too
//     console.log(`DeepSeek Text Model: ${DEEPSEEK_MODEL_NAME}`);
//     console.log(`OpenAI Vision Model: ${OPENAI_VISION_MODEL_NAME}`);
//     try { await mongoHelper.getMongoClient(); console.log("MongoDB connection OK on startup."); }
//     catch (error) { console.error("Error during initial MongoDB connection check."); }
//     console.log('--- Bot is fully ready and listening! ---');
// });
// console.log('[Main] "ready" event listener attachment SKIPPED (Commented out).');


// // --- Message Handling (Includes News, DM-only non-command replies) ---
// console.log('[Main] Setting up "messageCreate" event listener...');
// client.on('messageCreate', async (message) => {
//     if (message.author.bot) return;
//     const content = message.content || "";
//     // Refined check: Ignore if no text AND no attachment (allows !analyze with just attachment)
//     if (!content && message.attachments.size === 0) return;

//     try {
//         // --- Command Routing ---
//         if (content.startsWith(WHALE_PREFIX)) {
//             await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim());
//         } else if (content.startsWith(CMC_PREFIX)) {
//             // Assuming whopService.checkMembership would be added here if needed later
//             // const userTier = await whopService.checkMembership(message.author.id);
//             // await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim(), userTier);
//             await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim(), 'PAID'); // Temp: Assume PAID for testing CMC handler fully
//         } else if (content.startsWith(ANALYZE_PREFIX)) {
//             // (Analyze command logic)
//              if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Image analysis disabled."); return; }
//              if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
//              const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Attach valid image.`); return; }
//              await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
//         } else if (content.trim().toLowerCase() === HELP_PREFIX) {
//             // Assuming whopService.checkMembership would be added here if needed later
//              // const userTier = await whopService.checkMembership(message.author.id);
//              // await handleHelpCommand(message, userTier);
//              await handleHelpCommand(message, 'PAID'); // Temp: Assume PAID for testing help display
//         }
//         // --- ADDED NEWS COMMAND ROUTE ---
//         else if (content.startsWith(NEWS_PREFIX)) {
//             // Assuming FREE/PAID access for now, no explicit tier check yet
//             console.log(`[Main] Routing to News Handler for query: ${content}`);
//             await handleNewsCommand(message); // Pass the whole message object
//         }
//         // --- END NEWS COMMAND ROUTE ---
//         else {
//             // --- Respond ONLY to non-command DMs ---
//             if (message.channel.isDMBased()) {
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
// // (Same as previous version)
// console.log('[Main] Setting up shutdown listeners...');
// const shutdown = async (signal) => { console.log(`\n${signal} received...`); await mongoHelper.closeDatabaseConnection(); console.log("Destroying client..."); client.destroy(); console.log("Shutdown complete."); process.exit(0); };
// process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
// console.log('[Main] Shutdown listeners attached.');


// // --- Login to Discord ---
// // (Same as previous version)
// console.log('[Main] Checking Discord Token...');
// const DISCORD_TOKEN = process.env.DISCORD_TOKEN; if (!DISCORD_TOKEN) { console.error("FATAL: DISCORD_TOKEN missing."); process.exit(1); }
// else { console.log('[Main] Discord Token found. Attempting login...'); client.login(DISCORD_TOKEN).then(() => { console.log('[Main] Discord login initiated...'); }).catch(error => { console.error("FATAL: Discord login failed:", error.message); if (error.code === 'TokenInvalid') { console.error("Specifics: Invalid Discord token."); } else if (error.code === 'DisallowedIntents') { console.error("Specifics: Missing Intents (MessageContent/DirectMessages?). Check Dev Portal!"); } else { console.error("Code:", error.code); } process.exit(1); }); console.log('[Main] client.login() called.'); }
// console.log('[Main] End of main script execution (event loop running).');

// main.js
require('dotenv').config();
console.log('[Main] dotenv loaded.');

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
const { handleNewsCommand } = require('./commands/newsHandler');
console.log('[Main] newsHandler loaded.');
const { handleBinanceCommand } = require('./commands/binanceHandler'); // <-- Import Binance Handler
console.log('[Main] binanceHandler loaded.');


// Import services (for initialization checks or direct use if any)
const mongoHelper = require('./services/mongoHelper');
console.log('[Main] mongoHelper loaded.');
require('./services/aiHelper'); // Initialize AI helper (checks keys)
console.log('[Main] aiHelper loaded.');
require('./services/openaiHelper'); // Initialize OpenAI helper (checks keys)
console.log('[Main] openaiHelper loaded.');
require('./services/binanceHelper'); // Initialize Binance helper (checks keys)
console.log('[Main] binanceHelper loaded.');


// --- Configuration ---
const WHALE_PREFIX = "!whale";
const CMC_PREFIX = "!cmc";
const HELP_PREFIX = "!help";
const ANALYZE_PREFIX = "!analyze";
const NEWS_PREFIX = "!news";
const BINANCE_PREFIX = "!binance"; // <-- Binance Prefix Added
const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';
const DEEPSEEK_MODEL_NAME = process.env.AI_MODEL || 'deepseek-chat';
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash-latest';
const OPENAI_VISION_MODEL_NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4-turbo';
console.log('[Main] Configuration constants set.');

// --- Environment Variable Check ---
// Added BINANCE keys to the check
const requiredEnvVars = [
    'DISCORD_TOKEN',
    // Conditionally check AI keys based on provider
    'DEEPSEEK_API_KEY', // Check only if AI_PROVIDER is deepseek?
    'GEMINI_API_KEY', // Check only if AI_PROVIDER is gemini?
    'OPENAI_API_KEY', // Still needed for !analyze
    'CMC_PRO_API_KEY',
    'BLOCKCYPHER_API_KEY',
    'BINANCE_API_KEY', // Added
    'BINANCE_SECRET_KEY', // Added
    'MONGODB_USERNAME', 'MONGODB_PASSWORD', 'MONGODB_CLUSTER',
    'DATABASE_NAME', 'COLLECTION_NAME', 'WALLET_LABEL_COLLECTION_NAME'
];
// Add AI provider specific keys based on selection
if (AI_PROVIDER === 'deepseek') {
    requiredEnvVars.push('DEEPSEEK_API_KEY');
} else if (AI_PROVIDER === 'gemini') {
    requiredEnvVars.push('GEMINI_API_KEY');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error(`FATAL: Missing required ENV VARS: ${missingEnvVars.join(', ')}`);
    console.error("Please ensure all required variables are set in your .env file.");
    process.exit(1);
} else {
    console.log('[Main] Essential environment variables seem present.');
}

// --- Discord Client Setup ---
console.log('[Main] Creating Discord Client...');
let client;
try {
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
        partials: [
             Partials.Channel, // Required for DM events
             Partials.Message, // May help with fetching full message data
        ],
    });
    console.log('[Main] Discord Client created successfully.');
} catch (clientError) {
     console.error("FATAL: Error creating Discord client:", clientError);
     process.exit(1);
}


// --- Bot Ready Event ---
console.log('[Main] Setting up "ready" event listener...');
client.once('ready', async () => {
    console.log('--- Discord Client Ready! ---');
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Whale prefix: ${WHALE_PREFIX}`);
    console.log(`CMC prefix: ${CMC_PREFIX}`);
    console.log(`Analyze prefix: ${ANALYZE_PREFIX}`);
    console.log(`Help prefix: ${HELP_PREFIX}`);
    console.log(`News prefix: ${NEWS_PREFIX}`);
    console.log(`Binance prefix: ${BINANCE_PREFIX}`); // Added
    console.log(`AI Provider: ${AI_PROVIDER}`);
    if (AI_PROVIDER === 'deepseek') console.log(`DeepSeek Model: ${DEEPSEEK_MODEL_NAME}`);
    if (AI_PROVIDER === 'gemini') console.log(`Gemini Model: ${GEMINI_MODEL_NAME}`);
    console.log(`OpenAI Vision Model: ${OPENAI_VISION_MODEL_NAME}`);
    try {
        // Initialize DB connection on startup
        await mongoHelper.getMongoClient();
        console.log("Initial MongoDB connection check passed on startup.");
    } catch (error) {
        // Error handling is inside getMongoClient for initial connect, which should exit
        console.error("Error during initial MongoDB connection check within ready event.");
    }
    console.log('--- Bot is fully ready and listening! ---');
});
// console.log('[Main] "ready" event listener attachment SKIPPED (Commented out).');


// --- Message Handling ---
console.log('[Main] Setting up "messageCreate" event listener...');
client.on('messageCreate', async (message) => {
    // Ignore bots
    if (message.author.bot) return;
    // Basic check for content or attachments
    const content = message.content || "";
    if (!content && message.attachments.size === 0) return;

    try {
        // --- Command Routing ---
        if (content.startsWith(WHALE_PREFIX)) {
            await handleWhaleCommand(message, content.substring(WHALE_PREFIX.length).trim());
        } else if (content.startsWith(CMC_PREFIX)) {
            await handleCmcCommand(message, content.substring(CMC_PREFIX.length).trim());
        } else if (content.startsWith(ANALYZE_PREFIX)) {
            if (!process.env.OPENAI_API_KEY || !OPENAI_VISION_MODEL_NAME) { message.reply("Image analysis disabled."); return; }
            if (message.attachments.size === 0) { message.reply(`Attach an image with \`${ANALYZE_PREFIX}\`.`); return; }
            const img = message.attachments.first(); if (!img?.contentType?.startsWith('image/')) { message.reply(`Attach valid image.`); return; }
            await handleImageAnalysisCommand(message, content.substring(ANALYZE_PREFIX.length).trim(), img.url);
        } else if (content.trim().toLowerCase() === HELP_PREFIX) {
             await handleHelpCommand(message); // Pass tier if needed later
        } else if (content.startsWith(NEWS_PREFIX)) {
            console.log(`[Main] Routing to News Handler for query: ${content}`);
            await handleNewsCommand(message);
        } else if (content.startsWith(BINANCE_PREFIX)) { // <-- Added Binance Route
             console.log(`[Main] Routing to Binance Handler for query: ${content}`);
             await handleBinanceCommand(message, content.substring(BINANCE_PREFIX.length).trim());
        } else {
            // --- Respond ONLY to non-command DMs ---
            if (message.channel.isDMBased()) {
                 console.log(`[Main] Received non-command message in DM from ${message.author.tag}, guiding to !help.`);
                 // Avoid replying to self if something goes wrong
                 if (message.author.id !== client.user?.id) {
                     message.reply(`Hello! I didn't recognize a command. Use \`${HELP_PREFIX}\` to see what I can do.`);
                 }
            }
            // --- Channel messages without prefix are ignored ---
        }
    } catch (error) {
        console.error(`[ERROR] Unhandled exception processing message from ${message.author.tag} in ${message.guild?.name || 'DM'}: "${content}"`, error);
        try { await message.reply("Sorry, an unexpected internal error occurred while processing your request."); } catch {}
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
            // Ready message is handled by the 'ready' event listener
            console.log('[Main] Discord login initiated successfully (waiting for ready event)...');
        })
        .catch(error => {
            console.error("FATAL: Failed to login to Discord:", error.message);
            if (error.code === 'TokenInvalid') { console.error("Error Specifics: Invalid Discord token."); }
            else if (error.code === 'DisallowedIntents') { console.error("Error Specifics: Missing required Gateway Intents (MessageContent/DirectMessages?). Check Discord Dev Portal!"); }
            else { console.error("Discord Login Error Code:", error.code); }
            process.exit(1);
        });
    console.log('[Main] client.login() called.');
}
console.log('[Main] End of main script execution (event loop running).');




