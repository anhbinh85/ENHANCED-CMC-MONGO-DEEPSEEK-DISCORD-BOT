
//----------------------------------------------------------------------------
// // commands/newsHandler.js
// const {
//     EmbedBuilder,
//     ActionRowBuilder,
//     ButtonBuilder,
//     ButtonStyle,
//     ComponentType
// } = require('discord.js');
// const Parser = require('rss-parser');
// const aiHelper = require('../services/aiHelper'); // Use DeepSeek for summarization

// const parser = new Parser({ timeout: 15000 });

// const COINTELEGRAPH_FEED_URL = 'https://cointelegraph.com/rss';
// const ITEMS_PER_PAGE = 4; // Show 4 summarized items per page (adjust as needed)
// const MAX_SNIPPET_LENGTH = 400; // Max snippet characters per article for the prompt
// const MAX_AI_SUMMARY_TOKENS = 450; // Target max tokens for the AI's summary output *per page*

// // --- Store pagination states in memory (Lost on restart!) ---
// // For persistence, use a database or Redis instead.
// const newsSessions = new Map(); // Key: message.id, Value: { items: [], currentPage: 0, totalPages: 0 }

// // --- Helper: Construct Summary Prompt for a single page ---
// function constructNewsSummaryPrompt(pageItems) {
//     let prompt = `You are a crypto news summarizer. Provide a concise (1-2 sentence) summary for EACH news article listed below. Focus on the main topic and key info from the snippet. Keep the total combined summary for ALL articles brief (under ${MAX_AI_SUMMARY_TOKENS} tokens).\n\nFormat EACH summary starting with the article number like this:\n1. [Your summary for article 1]\n2. [Your summary for article 2]\n...\n\n`;

//     prompt += "--- Articles to Summarize ---\n";
//     pageItems.forEach((item, index) => {
//         const title = item.title || 'No Title';
//         const snippet = item.contentSnippet ? item.contentSnippet.substring(0, MAX_SNIPPET_LENGTH) : 'No snippet available.';
//         prompt += `\nArticle ${index + 1}:\n`; // Use 1-based index for prompt clarity
//         prompt += `Title: ${title}\n`;
//         prompt += `Snippet: ${snippet}\n`;
//     });
//     prompt += "\n--- End Articles ---\n\nPlease provide the numbered list of summaries now:";
//     return prompt;
// }

// // --- Helper: Parse AI summary list ---
// // Attempts to split the AI response into individual summaries based on numbering.
// // This can be fragile and might need adjustments based on AI's actual output format.
// function parseAiSummaries(aiResponse, expectedCount) {
//     const summaries = [];
//     // Try splitting by newline and looking for lines starting with number+dot+space
//     const lines = aiResponse.split('\n');
//     for (const line of lines) {
//         if (line.match(/^\d+\.\s+/)) {
//             summaries.push(line.replace(/^\d+\.\s+/, '').trim()); // Remove numbering
//         } else if (line.startsWith('* **') && line.includes(':**')) {
//              // Handle alternative markdown list format if AI uses it
//              summaries.push(line.substring(line.indexOf(':**') + 3).trim());
//         }
//     }

//     // If parsing failed to get enough summaries, return a generic message or the raw response
//     if (summaries.length < expectedCount) {
//         console.warn(`[NewsHandler] Failed to parse expected ${expectedCount} summaries from AI response. Returning raw response.`);
//         // Return raw response truncated, indicate parsing failed
//         return [`AI Response (could not parse individual summaries):\n${aiResponse.substring(0, 1000)}`];
//     }
//     return summaries; // Return array of summary strings
// }


// // --- Helper: Create Embed for a specific page ---
// async function createNewsPageEmbed(pageItems, currentPage, totalPages, interactionId) {
//     console.log(`[NewsHandler] Generating page ${currentPage + 1}/${totalPages} for interaction ${interactionId}`);
//     const embed = new EmbedBuilder()
//         .setColor(0xF48120)
//         .setTitle(`📰 Cointelegraph News Summary (Page ${currentPage + 1}/${totalPages})`)
//         .setURL('https://cointelegraph.com/rss')
//         .setDescription("Summarizing articles...") // Placeholder while AI runs
//         .setTimestamp();

//     if (!pageItems || pageItems.length === 0) {
//         embed.setDescription("No news items found on this page.");
//         return { embeds: [embed] }; // Return embed only
//     }

//     // --- AI Summarization for THIS page ---
//     const summaryPrompt = constructNewsSummaryPrompt(pageItems);
//     let aiSummaries = [];
//     try {
//         // Use non-streaming helper - expect summary for ~4 items to be relatively short
//         const rawSummaryResponse = await aiHelper(summaryPrompt);
//         if (!rawSummaryResponse || rawSummaryResponse.toLowerCase().includes("error generating response")) {
//             throw new Error(rawSummaryResponse || "AI returned empty summary.");
//         }
//         console.log(`[NewsHandler] Received raw summary for page ${currentPage + 1}. Parsing...`);
//         aiSummaries = parseAiSummaries(rawSummaryResponse, pageItems.length);
//     } catch (aiError) {
//         console.error(`[NewsHandler] AI summary error for page ${currentPage + 1}:`, aiError);
//         // Add error message to embed description instead of summaries
//         embed.setDescription(`Could not generate AI summary for this page: ${aiError.message}`);
//         return { embeds: [embed] }; // Return embed with error
//     }

//     // --- Populate Embed Fields ---
//     embed.setDescription(null); // Clear placeholder description
//     embed.setFields([]); // Clear any previous fields if reusing embed object (safer to create new each time)

//     pageItems.forEach((item, index) => {
//         const title = item.title ? item.title.substring(0, 250) : 'No Title';
//         const link = item.link || '#';
//         // Get the corresponding summary, or provide fallback
//         const summary = aiSummaries[index] || "*AI summary unavailable.*";

//         embed.addFields({
//             name: `${(currentPage * ITEMS_PER_PAGE) + index + 1}. ${title}`,
//             value: `${summary.substring(0, 950)}\n[[Read More]](${link})` // Limit summary length + add link
//         });
//     });
//     // Ensure field count doesn't exceed Discord limit (25) - unlikely with ITEMS_PER_PAGE = 4
//     if (embed.data.fields && embed.data.fields.length > 25) {
//          embed.spliceFields(24, embed.data.fields.length - 24); // Remove excess fields
//          embed.addFields({ name: "...", value: "More items truncated due to limit."});
//     }


//     return { embeds: [embed] };
// }

// // --- Helper: Create Navigation Buttons ---
// function createNavButtons(currentPage, totalPages, interactionId) { // Add interactionId for unique custom IDs
//     const prevId = `news_prev_${interactionId}_${currentPage}`;
//     const nextId = `news_next_${interactionId}_${currentPage}`;

//     return new ActionRowBuilder()
//         .addComponents(
//             new ButtonBuilder().setCustomId(prevId).setLabel('◀️ Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
//             new ButtonBuilder().setCustomId(nextId).setLabel('Next ▶️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
//         );
// }

// // --- Main Handler Function ---
// async function handleNewsCommand(message) {
//     let replyMessage = null;

//     try {
//         replyMessage = await message.reply(`📰 Fetching latest news feed...`);

//         console.log("[NewsHandler] Fetching RSS feed...");
//         const feed = await parser.parseURL(COINTELEGRAPH_FEED_URL);
//         const allItems = feed.items || [];
//         console.log(`[NewsHandler] Found ${allItems.length} total items.`);

//         if (allItems.length === 0) {
//             await replyMessage.edit('Could not fetch any news items from the feed.');
//             return;
//         }

//         const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
//         const interactionId = message.id; // Use original message ID for state key

//         // Store initial state
//         const initialState = {
//             items: allItems.map(item => ({ // Store only needed fields
//                  title: item.title,
//                  link: item.link,
//                  pubDate: item.pubDate,
//                  contentSnippet: item.contentSnippet
//             })),
//             currentPage: 0,
//             totalPages: totalPages,
//             ownerId: message.author.id // Store who initiated
//         };
//         newsSessions.set(interactionId, initialState);
//         console.log(`[NewsHandler] Stored initial state for interaction ${interactionId}`);


//         // --- Generate and Send First Page ---
//         const firstPageItems = initialState.items.slice(0, ITEMS_PER_PAGE);
//         const pageOptions = await createNewsPageEmbed(firstPageItems, 0, totalPages, interactionId); // Generate embed WITH summary
//         const buttons = createNavButtons(0, totalPages, interactionId);
//         pageOptions.components = [buttons];
//         pageOptions.content = `Found ${allItems.length} articles. Summarizing page 1/${totalPages}...`; // Update content

//         // Edit the initial reply (use interactionId for map key from now on)
//         await replyMessage.edit(pageOptions);
//         // Update map key to use reply message ID AFTER it exists
//         if (replyMessage.id !== interactionId) {
//              newsSessions.set(replyMessage.id, initialState);
//              newsSessions.delete(interactionId); // Clean up old key
//              console.log(`[NewsHandler] Updated state key to reply ID ${replyMessage.id}`);
//         } else {
//              console.warn("[NewsHandler] Initial message ID same as reply ID?");
//         }


//         // --- Button Collector ---
//         const filter = (interaction) => interaction.user.id === initialState.ownerId; // Only original author
//         const collector = replyMessage.createMessageComponentCollector({
//              componentType: ComponentType.Button,
//              filter,
//              time: 300000 // 5 minutes idle timeout
//             });

//         collector.on('collect', async (interaction) => {
//             await interaction.deferUpdate(); // Acknowledge button press
//             const messageId = interaction.message.id;
//             const sessionState = newsSessions.get(messageId);

//             if (!sessionState) {
//                 console.warn(`[NewsHandler] No session state found for message ${messageId}`);
//                 await interaction.followUp({ content: "This news session has expired.", ephemeral: true });
//                 return;
//             }

//              // Determine new page
//              let newPage = sessionState.currentPage;
//              if (interaction.customId.startsWith('news_prev') && sessionState.currentPage > 0) {
//                  newPage--;
//              } else if (interaction.customId.startsWith('news_next') && sessionState.currentPage < sessionState.totalPages - 1) {
//                  newPage++;
//              } else { return; /* Clicked disabled button? */ }

//              sessionState.currentPage = newPage; // Update state
//              newsSessions.set(messageId, sessionState); // Save updated state back to map

//              console.log(`[NewsHandler] User ${interaction.user.id} navigating to page ${newPage + 1}`);

//              // Generate the new page content (includes AI call)
//              const pageStart = newPage * ITEMS_PER_PAGE;
//              const pageEnd = pageStart + ITEMS_PER_PAGE;
//              const nextPageItems = sessionState.items.slice(pageStart, pageEnd);

//              try {
//                  // Show temporary "loading" state while AI runs
//                  await interaction.editReply({ content: `📰 Loading summaries for page ${newPage + 1}/${sessionState.totalPages}...`, embeds:[], components: [] }); // Clear embed while loading
//                  const newPageOptions = await createNewsPageEmbed(nextPageItems, newPage, sessionState.totalPages, messageId); // Pass messageId used as key
//                  const newButtons = createNavButtons(newPage, sessionState.totalPages, messageId);
//                  newPageOptions.components = [newButtons];
//                   newPageOptions.content = `Found ${sessionState.items.length} articles. Summaries for page ${newPage + 1}/${sessionState.totalPages}:`; // Update content

//                   await interaction.editReply(newPageOptions); // Update with new page
//              } catch(pageGenError) {
//                   console.error(`[NewsHandler] Error generating page ${newPage + 1}:`, pageGenError);
//                    await interaction.editReply({ content: `Error loading page ${newPage + 1}: ${pageGenError.message}`, embeds: [], components: [] });
//              }
//         });

//         collector.on('end', collected => {
//             console.log(`[NewsHandler] News pagination collector ended for message ${replyMessage.id}. Interactions: ${collected.size}`);
//             // Remove buttons and clean up state
//             replyMessage.edit({ components: [] }).catch(e => {}); // Ignore error if message deleted
//             newsSessions.delete(replyMessage.id);
//             console.log(`[NewsHandler] Cleared state for message ${replyMessage.id}`);
//         });

//     } catch (error) {
//         console.error("[NewsHandler] Error in handleNewsCommand:", error);
//         const errorMsg = `Sorry, error fetching/summarizing news: ${error.message}`;
//         if (replyMessage) { try { await replyMessage.edit({ content: errorMsg, embeds:[], components:[] }); } catch (e) { await message.reply(errorMsg); } }
//         else { await message.reply(errorMsg); }
//     }
// }

// module.exports = { handleNewsCommand };

// // --- Need node-cache if persisting state longer term ---
// // npm install node-cache
// // Consider using a proper DB for state if needed across restarts



//----------------------------------------------------------------------------
// commands/newsHandler.js
const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const aiHelper = require('../services/aiHelper'); // Use DeepSeek for summarization

const parser = new Parser({ timeout: 15000 }); // 15 seconds timeout

// Cointelegraph RSS Feed URL
const COINTELEGRAPH_FEED_URL = 'https://cointelegraph.com/rss';
// Summarize Top 5 articles
const NEWS_ITEMS_TO_SUMMARIZE = 5;
// Max characters per snippet to send to AI
const MAX_SNIPPET_LENGTH = 500;
// Target token limit for the AI's combined summary output
const MAX_AI_SUMMARY_TOKENS = 500; // Keep this relatively low for 5 summaries + links

/**
 * Constructs the prompt for the AI to summarize news articles,
 * asking for title, summary, and link together.
 * @param {Array<object>} items - Array of news items from rss-parser ({ title, contentSnippet, link, pubDate })
 * @returns {string} The prompt string.
 */
function constructNewsSummaryPrompt(items) {
    let prompt = `You are a crypto news summarizer. Your goal is to provide a concise (1-2 sentence) summary for each news article provided below. Focus on the main topic and key information.\n\nREQUIRED OUTPUT FORMAT: For each article, provide the output EXACTLY like this example:\n\n**1. [Article Title Here]**\n[Your 1-2 sentence summary here.]\n[Read More](article_link_here)\n\n(Include a blank line between articles)\n\nKeep the TOTAL response well under 2000 characters (aim for less than ${MAX_AI_SUMMARY_TOKENS} tokens).\n\n`;

    prompt += "--- Articles to Summarize ---\n";
    items.forEach((item, index) => {
        const title = item.title || 'No Title';
        const snippet = item.contentSnippet ? item.contentSnippet.substring(0, MAX_SNIPPET_LENGTH) : 'No snippet available.';
        const link = item.link || '#'; // Provide link to AI
        prompt += `\nArticle ${index + 1}:\n`;
        prompt += `Title: ${title}\n`;
        prompt += `Snippet: ${snippet}\n`;
        prompt += `Link: ${link}\n`; // Give AI the link to include
    });

    prompt += "\n--- End Articles ---\n\nPlease provide the summaries in the required format now:";
    return prompt;
}


// --- Main Handler Function ---
async function handleNewsCommand(message) {
    let replyMessage = null; // To hold the bot's message for editing

    try {
        replyMessage = await message.reply(`📰 Fetching and summarizing latest ${NEWS_ITEMS_TO_SUMMARIZE} news items...`);

        // 1. Fetch RSS Feed
        console.log("[NewsHandler] Fetching RSS feed...");
        const feed = await parser.parseURL(COINTELEGRAPH_FEED_URL);
        const allItems = feed.items || [];
        console.log(`[NewsHandler] Found ${allItems.length} total items.`);

        if (allItems.length === 0) {
            await replyMessage.edit('Could not fetch any news items from the feed.');
            return;
        }

        // 2. Prepare Data for Summarization
        const itemsToSummarize = allItems.slice(0, NEWS_ITEMS_TO_SUMMARIZE);

        // 3. Construct AI Prompt (New format instructions)
        const summaryPrompt = constructNewsSummaryPrompt(itemsToSummarize);

        // 4. Call AI (DeepSeek) for Summarization
        console.log("[NewsHandler] Requesting summary from AI...");
        await replyMessage.edit("📰 Fetching news... Summarizing with AI...");

        // Using non-streaming default helper, expecting AI to follow length constraints
        const aiSummaryResponse = await aiHelper(summaryPrompt);

        if (!aiSummaryResponse || aiSummaryResponse.toLowerCase().includes("error generating response")) {
            throw new Error(aiSummaryResponse || "AI returned empty summary.");
        }
        console.log("[NewsHandler] Received AI Summary Response.");

        // 5. Build Final Embed (using AI response as description)
        const newsEmbed = new EmbedBuilder()
            .setColor(0xF48120)
            .setTitle(`📰 Cointelegraph News Summary (Latest ${itemsToSummarize.length})`)
            .setURL(feed.link || 'https://cointelegraph.com/')
            // --- Place the entire AI response in the description ---
            // The AI was instructed to format title, summary, and link together
            .setDescription(aiSummaryResponse.substring(0, 4090)) // Limit description length
            .setTimestamp()
            .setFooter({ text: `Summarized by AI via Cointelegraph RSS.` });

        // --- Remove the addFields loop - links should be in the description now ---

        // 6. Edit Reply with Summary Embed
        await replyMessage.edit({ content: 'Here are the latest news summaries:', embeds: [newsEmbed] });

    } catch (error) {
        console.error("[NewsHandler] Error in handleNewsCommand:", error);
        const errorMsg = `Sorry, there was an error fetching or summarizing the news: ${error.message}`;
        if (replyMessage) {
            try { await replyMessage.edit({ content: errorMsg, embeds: [] }); } // Clear embed on error
            catch (e) { await message.reply(errorMsg); }
        } else {
            await message.reply(errorMsg);
        }
    }
}

module.exports = { handleNewsCommand };

