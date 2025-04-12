
//----------------------------------------------------------------------------
// commands/newsHandler.js
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const Parser = require('rss-parser');
const aiHelper = require('../services/aiHelper'); // Use unified AI helper

const parser = new Parser({ timeout: 15000 });

const COINTELEGRAPH_FEED_URL = 'https://cointelegraph.com/rss';
const ITEMS_PER_PAGE = 4; // Show 4 summarized items per page
const MAX_SNIPPET_LENGTH = 400; // Max snippet characters per article for the prompt
const MAX_AI_SUMMARY_TOKENS = 450; // Target max tokens for the AI's summary output *per page*

// Store pagination states in memory (Lost on restart!)
const newsSessions = new Map(); // Key: replyMessage.id, Value: { items: [], currentPage: 0, totalPages: 0, ownerId: string }

// --- Helper: Construct Summary Prompt for a single page ---
function constructNewsSummaryPrompt(pageItems) {
    let prompt = `You are a crypto news summarizer. Provide a concise (1-2 sentence) summary for EACH news article listed below. Focus on the main topic and key info from the snippet. Keep the total combined summary for ALL articles brief (under ${MAX_AI_SUMMARY_TOKENS} tokens).\n\nFormat EACH summary starting with the article number like this:\n1. [Your summary for article 1]\n2. [Your summary for article 2]\n...\n\n`;

    prompt += "--- Articles to Summarize ---\n";
    pageItems.forEach((item, index) => {
        const title = item.title || 'No Title';
        // Ensure snippet is a string before substring
        const snippetContent = typeof item.contentSnippet === 'string' ? item.contentSnippet : '';
        const snippet = snippetContent ? snippetContent.substring(0, MAX_SNIPPET_LENGTH) : 'No snippet available.';
        prompt += `\nArticle ${index + 1}:\n`; // Use 1-based index for prompt clarity
        prompt += `Title: ${title}\n`;
        prompt += `Snippet: ${snippet}\n`;
    });
    prompt += "\n--- End Articles ---\n\nPlease provide the numbered list of summaries now:";
    return prompt;
}

// --- Helper: Parse AI summary list ---
function parseAiSummaries(aiResponse, expectedCount) {
    const summaries = [];
    const lines = aiResponse.split('\n');
    for (const line of lines) {
        if (line.match(/^\d+\.\s+/)) {
            summaries.push(line.replace(/^\d+\.\s+/, '').trim());
        } else if (line.startsWith('* **') && line.includes(':**')) {
             summaries.push(line.substring(line.indexOf(':**') + 3).trim());
        } else if (line.trim().length > 0 && !line.startsWith('-')) {
             // Fallback: Add non-empty lines that don't look like list markers,
             // in case AI uses a different format. Might need refinement.
             // summaries.push(line.trim());
        }
    }

    if (summaries.length < expectedCount) {
        console.warn(`[NewsHandler] Failed to parse expected ${expectedCount} summaries from AI response. Got ${summaries.length}. Raw:\n${aiResponse}`);
        // Return array with error message for each missing summary
        const result = [...summaries];
        for (let i = summaries.length; i < expectedCount; i++) {
            result.push("*AI summary parsing failed.*");
        }
        // Optionally add the raw response at the end for debugging
        // result.push(`\n\n(Raw AI Response:\n${aiResponse.substring(0, 500)}...)`);
        return result;
    }
    return summaries.slice(0, expectedCount); // Return only the expected number
}


// --- Helper: Create Embed for a specific page ---
async function createNewsPageEmbed(pageItems, currentPage, totalPages, interactionId) {
    console.log(`[NewsHandler] Generating page ${currentPage + 1}/${totalPages} for interaction ${interactionId}`);
    const embed = new EmbedBuilder()
        .setColor(0xF48120) // Cointelegraph orange
        .setTitle(`📰 Cointelegraph News Summary (Page ${currentPage + 1}/${totalPages})`)
        .setURL(COINTELEGRAPH_FEED_URL) // Link to the main RSS feed
        .setDescription("Summarizing articles...") // Placeholder while AI runs
        .setTimestamp()
        .setFooter({ text: `Powered by ${process.env.AI_PROVIDER}` });

    if (!pageItems || pageItems.length === 0) {
        embed.setDescription("No news items found on this page.");
        return { embeds: [embed] }; // Return embed only
    }

    // --- AI Summarization for THIS page ---
    const summaryPrompt = constructNewsSummaryPrompt(pageItems);
    let aiSummaries = [];
    let aiErrorOccurred = false;
    try {
        // **CORRECTION:** Call the specific function from the imported module
        const rawSummaryResponse = await aiHelper.getAIResponse(summaryPrompt);

        // Check if the response itself indicates an error from the helper
        if (!rawSummaryResponse || rawSummaryResponse.startsWith("Error generating AI response:")) {
            throw new Error(rawSummaryResponse || "[System] AI returned empty summary."); // Use System prefix
        }
        console.log(`[NewsHandler] Received raw summary for page ${currentPage + 1}. Parsing...`);
        aiSummaries = parseAiSummaries(rawSummaryResponse, pageItems.length);
    } catch (aiError) {
        console.error(`[NewsHandler] AI summary error for page ${currentPage + 1}:`, aiError);
        // Error message should have prefix from aiHelper or the throw above
        embed.setDescription(`Could not generate AI summary for this page: ${aiError.message}`);
        aiErrorOccurred = true; // Flag that AI failed
        // Return embed with error, no fields will be added below
    }

    // --- Populate Embed Fields (only if AI didn't error) ---
    if (!aiErrorOccurred) {
        embed.setDescription(null); // Clear placeholder description
        embed.setFields([]); // Clear any previous fields

        pageItems.forEach((item, index) => {
            const title = item.title ? item.title.substring(0, 250) : 'No Title'; // Limit title length
            const link = item.link || '#';
            // Get the corresponding summary, or provide fallback if parsing failed but AI didn't throw error initially
            const summary = aiSummaries[index] || "*Summary unavailable.*";

            embed.addFields({
                name: `${(currentPage * ITEMS_PER_PAGE) + index + 1}. ${title}`,
                value: `${summary.substring(0, 950)}\n[[Read More]](${link})` // Limit summary length + add link
            });
        });

        // Ensure field count doesn't exceed Discord limit (25)
        if (embed.data.fields && embed.data.fields.length > 25) {
             embed.spliceFields(24, embed.data.fields.length - 24); // Remove excess fields
             embed.addFields({ name: "...", value: "More items truncated due to limit."});
        }
    }

    return { embeds: [embed] };
}

// --- Helper: Create Navigation Buttons ---
function createNavButtons(currentPage, totalPages, interactionId) {
    // Use message ID as part of custom ID to ensure uniqueness per session
    const prevId = `news_prev_${interactionId}_${currentPage}`;
    const nextId = `news_next_${interactionId}_${currentPage}`;

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId(prevId).setLabel('◀️ Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
            new ButtonBuilder().setCustomId(nextId).setLabel('Next ▶️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
        );
}

// --- Main Handler Function ---
async function handleNewsCommand(message) {
    let replyMessage = null; // Use interaction message ID as key

    try {
        replyMessage = await message.reply(`📰 Fetching latest news feed...`);
        const interactionId = replyMessage.id; // Use the ID of the bot's reply message as the key

        console.log("[NewsHandler] Fetching RSS feed...");
        const feed = await parser.parseURL(COINTELEGRAPH_FEED_URL);
        const allItems = feed.items || [];
        console.log(`[NewsHandler] Found ${allItems.length} total items.`);

        if (allItems.length === 0) {
            await replyMessage.edit('Could not fetch any news items from the feed.');
            return;
        }

        const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);

        // Store initial state using the reply message ID as the key
        const initialState = {
            items: allItems.map(item => ({ // Store only needed fields
                 title: item.title,
                 link: item.link,
                 pubDate: item.pubDate,
                 contentSnippet: item.contentSnippet
            })),
            currentPage: 0,
            totalPages: totalPages,
            ownerId: message.author.id // Store who initiated
        };
        newsSessions.set(interactionId, initialState);
        console.log(`[NewsHandler] Stored initial state for interaction ${interactionId}`);


        // --- Generate and Send First Page ---
        const firstPageItems = initialState.items.slice(0, ITEMS_PER_PAGE);
        // Generate embed WITH summary
        const pageOptions = await createNewsPageEmbed(firstPageItems, 0, totalPages, interactionId);
        const buttons = createNavButtons(0, totalPages, interactionId);
        pageOptions.components = [buttons];
        // Update content based on whether embed generation had an error
        pageOptions.content = pageOptions.embeds[0].description?.includes("Could not generate AI summary")
            ? `Found ${allItems.length} articles. Error summarizing page 1/${totalPages}:`
            : `Found ${allItems.length} articles. Summaries for page 1/${totalPages}:`;

        // Edit the initial reply
        await replyMessage.edit(pageOptions);

        // --- Button Collector ---
        // Filter: only allow the original command author to interact
        const filter = (interaction) => interaction.user.id === initialState.ownerId;
        const collector = replyMessage.createMessageComponentCollector({
             componentType: ComponentType.Button,
             filter,
             time: 300000 // 5 minutes idle timeout
            });

        collector.on('collect', async (interaction) => {
            // Defer update immediately to prevent interaction timeout
            await interaction.deferUpdate();
            const messageId = interaction.message.id; // This is the key for the session map
            const sessionState = newsSessions.get(messageId);

            if (!sessionState) {
                console.warn(`[NewsHandler] No session state found for message ${messageId}`);
                // Try to edit the original message to remove buttons, ignore errors
                try { await interaction.message.edit({ components: [] }); } catch {}
                // Optionally send an ephemeral follow-up
                // await interaction.followUp({ content: "This news session has expired.", ephemeral: true });
                return;
            }

             // Determine new page based on button clicked
             let newPage = sessionState.currentPage;
             // Extract the page number from the custom ID to prevent race conditions
             const clickedPage = parseInt(interaction.customId.split('_')[3], 10);
             if (isNaN(clickedPage) || clickedPage !== sessionState.currentPage) {
                  console.warn(`[NewsHandler] Button page (${clickedPage}) doesn't match session page (${sessionState.currentPage}). Ignoring.`);
                  return; // Prevent acting on old buttons
             }

             if (interaction.customId.startsWith('news_prev') && sessionState.currentPage > 0) {
                 newPage--;
             } else if (interaction.customId.startsWith('news_next') && sessionState.currentPage < sessionState.totalPages - 1) {
                 newPage++;
             } else {
                 console.log("[NewsHandler] Clicked disabled or unknown button.");
                 return; // Clicked disabled button or unknown ID
             }

             // Update state *before* async operations
             sessionState.currentPage = newPage;
             newsSessions.set(messageId, sessionState); // Save updated state back to map

             console.log(`[NewsHandler] User ${interaction.user.id} navigating to page ${newPage + 1}`);

             // Generate the new page content (includes AI call)
             const pageStart = newPage * ITEMS_PER_PAGE;
             const pageEnd = pageStart + ITEMS_PER_PAGE;
             const nextPageItems = sessionState.items.slice(pageStart, pageEnd);

             try {
                 // Show temporary "loading" state while AI runs
                 await interaction.editReply({ content: `📰 Loading summaries for page ${newPage + 1}/${sessionState.totalPages}...`, embeds:[], components: [] });

                 const newPageOptions = await createNewsPageEmbed(nextPageItems, newPage, sessionState.totalPages, messageId);
                 const newButtons = createNavButtons(newPage, sessionState.totalPages, messageId); // Generate buttons for the *new* page state
                 newPageOptions.components = [newButtons];
                 // Update content based on whether embed generation had an error
                  newPageOptions.content = newPageOptions.embeds[0].description?.includes("Could not generate AI summary")
                        ? `Found ${sessionState.items.length} articles. Error summarizing page ${newPage + 1}/${sessionState.totalPages}:`
                        : `Found ${sessionState.items.length} articles. Summaries for page ${newPage + 1}/${sessionState.totalPages}:`;

                  await interaction.editReply(newPageOptions); // Update with new page content and buttons
             } catch(pageGenError) {
                  console.error(`[NewsHandler] Error generating page ${newPage + 1}:`, pageGenError);
                  // Edit reply to show error, remove buttons
                   await interaction.editReply({ content: `Error loading page ${newPage + 1}: ${pageGenError.message}`, embeds: [], components: [] }).catch(e => console.error("Failed to edit reply with page generation error:", e));
                   // Remove session on error?
                   newsSessions.delete(messageId);
             }
        });

        collector.on('end', collected => {
            console.log(`[NewsHandler] News pagination collector ended for message ${replyMessage.id}. Interactions: ${collected.size}`);
            // Remove buttons and clean up state from memory
            replyMessage.edit({ components: [] }).catch(e => {
                 // Ignore error if message was deleted or permissions changed
                 if (e.code !== 10008) { console.error("Error removing buttons on collector end:", e); }
            });
            newsSessions.delete(replyMessage.id);
            console.log(`[NewsHandler] Cleared state for message ${replyMessage.id}`);
        });

    } catch (error) {
        console.error("[NewsHandler] Error in handleNewsCommand:", error);
        // Ensure prefix is present if possible
        const prefixRegex = /^\[(DS|GE|CMC|BCR|OAI|DB|System)\]/;
        const errorMsgContent = prefixRegex.test(error.message) ? error.message : `[System] ${error.message}`;
        const errorMsg = `Sorry, error fetching/summarizing news: ${errorMsgContent}`;

        if (replyMessage) { try { await replyMessage.edit({ content: errorMsg, embeds:[], components:[] }); } catch (e) { await message.reply(errorMsg); } }
        else { await message.reply(errorMsg); }
        // Clean up session if error occurred before collector setup
        if (replyMessage?.id && newsSessions.has(replyMessage.id)) {
             newsSessions.delete(replyMessage.id);
        }
    }
}

module.exports = { handleNewsCommand };


// // --- Need node-cache if persisting state longer term ---
// // npm install node-cache
// // Consider using a proper DB for state if needed across restarts



//----------------------------------------------------------------------------
// // commands/newsHandler.js
// const { EmbedBuilder } = require('discord.js');
// const Parser = require('rss-parser');
// const aiHelper = require('../services/aiHelper'); // Use DeepSeek for summarization

// const parser = new Parser({ timeout: 15000 }); // 15 seconds timeout

// // Cointelegraph RSS Feed URL
// const COINTELEGRAPH_FEED_URL = 'https://cointelegraph.com/rss';
// // Summarize Top 5 articles
// const NEWS_ITEMS_TO_SUMMARIZE = 5;
// // Max characters per snippet to send to AI
// const MAX_SNIPPET_LENGTH = 500;
// // Target token limit for the AI's combined summary output
// const MAX_AI_SUMMARY_TOKENS = 500; // Keep this relatively low for 5 summaries + links

// /**
//  * Constructs the prompt for the AI to summarize news articles,
//  * asking for title, summary, and link together.
//  * @param {Array<object>} items - Array of news items from rss-parser ({ title, contentSnippet, link, pubDate })
//  * @returns {string} The prompt string.
//  */
// function constructNewsSummaryPrompt(items) {
//     let prompt = `You are a crypto news summarizer. Your goal is to provide a concise (1-2 sentence) summary for each news article provided below. Focus on the main topic and key information.\n\nREQUIRED OUTPUT FORMAT: For each article, provide the output EXACTLY like this example:\n\n**1. [Article Title Here]**\n[Your 1-2 sentence summary here.]\n[Read More](article_link_here)\n\n(Include a blank line between articles)\n\nKeep the TOTAL response well under 2000 characters (aim for less than ${MAX_AI_SUMMARY_TOKENS} tokens).\n\n`;

//     prompt += "--- Articles to Summarize ---\n";
//     items.forEach((item, index) => {
//         const title = item.title || 'No Title';
//         const snippet = item.contentSnippet ? item.contentSnippet.substring(0, MAX_SNIPPET_LENGTH) : 'No snippet available.';
//         const link = item.link || '#'; // Provide link to AI
//         prompt += `\nArticle ${index + 1}:\n`;
//         prompt += `Title: ${title}\n`;
//         prompt += `Snippet: ${snippet}\n`;
//         prompt += `Link: ${link}\n`; // Give AI the link to include
//     });

//     prompt += "\n--- End Articles ---\n\nPlease provide the summaries in the required format now:";
//     return prompt;
// }


// // --- Main Handler Function ---
// async function handleNewsCommand(message) {
//     let replyMessage = null; // To hold the bot's message for editing

//     try {
//         replyMessage = await message.reply(`📰 Fetching and summarizing latest ${NEWS_ITEMS_TO_SUMMARIZE} news items...`);

//         // 1. Fetch RSS Feed
//         console.log("[NewsHandler] Fetching RSS feed...");
//         const feed = await parser.parseURL(COINTELEGRAPH_FEED_URL);
//         const allItems = feed.items || [];
//         console.log(`[NewsHandler] Found ${allItems.length} total items.`);

//         if (allItems.length === 0) {
//             await replyMessage.edit('Could not fetch any news items from the feed.');
//             return;
//         }

//         // 2. Prepare Data for Summarization
//         const itemsToSummarize = allItems.slice(0, NEWS_ITEMS_TO_SUMMARIZE);

//         // 3. Construct AI Prompt (New format instructions)
//         const summaryPrompt = constructNewsSummaryPrompt(itemsToSummarize);

//         // 4. Call AI (DeepSeek) for Summarization
//         console.log("[NewsHandler] Requesting summary from AI...");
//         await replyMessage.edit("📰 Fetching news... Summarizing with AI...");

//         // Using non-streaming default helper, expecting AI to follow length constraints
//         const aiSummaryResponse = await aiHelper(summaryPrompt);

//         if (!aiSummaryResponse || aiSummaryResponse.toLowerCase().includes("error generating response")) {
//             throw new Error(aiSummaryResponse || "AI returned empty summary.");
//         }
//         console.log("[NewsHandler] Received AI Summary Response.");

//         // 5. Build Final Embed (using AI response as description)
//         const newsEmbed = new EmbedBuilder()
//             .setColor(0xF48120)
//             .setTitle(`📰 Cointelegraph News Summary (Latest ${itemsToSummarize.length})`)
//             .setURL(feed.link || 'https://cointelegraph.com/')
//             // --- Place the entire AI response in the description ---
//             // The AI was instructed to format title, summary, and link together
//             .setDescription(aiSummaryResponse.substring(0, 4090)) // Limit description length
//             .setTimestamp()
//             .setFooter({ text: `Summarized by AI via Cointelegraph RSS.` });

//         // --- Remove the addFields loop - links should be in the description now ---

//         // 6. Edit Reply with Summary Embed
//         await replyMessage.edit({ content: 'Here are the latest news summaries:', embeds: [newsEmbed] });

//     } catch (error) {
//         console.error("[NewsHandler] Error in handleNewsCommand:", error);
//         const errorMsg = `Sorry, there was an error fetching or summarizing the news: ${error.message}`;
//         if (replyMessage) {
//             try { await replyMessage.edit({ content: errorMsg, embeds: [] }); } // Clear embed on error
//             catch (e) { await message.reply(errorMsg); }
//         } else {
//             await message.reply(errorMsg);
//         }
//     }
// }

// module.exports = { handleNewsCommand };

