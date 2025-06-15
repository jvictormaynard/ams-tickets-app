import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, putTicket, putConversationMessages, getConversationMessages } from '../../../server/db';
import { transformChatwootConversationToTicket, transformChatwootMessagesForFrontend } from '../ticket-history/route'; // Assuming these are exported

// This route will receive webhook events from Chatwoot
export async function POST(request: NextRequest) {
    try {
        await initializeDatabase(); // Ensure DB is ready

        const event = await request.json();
        console.log('Received Chatwoot Webhook Event:', event.event, event.id);

        // Implement logic to process different event types
        switch (event.event) {
            case 'conversation_created':
            case 'conversation_updated':
            case 'conversation_status_changed':
                // For conversation events, fetch the full conversation details
                // and update the ticket in the database.
                // Note: Webhook payload might not contain all details, so fetching
                // full conversation is safer.
                await handleConversationEvent(event, request);
                break;
            case 'message_created':
            case 'message_updated':
                // For message events, fetch the full conversation messages
                // and update the conversation in the database.
                await handleMessageEvent(event, request);
                break;
            case 'contact_created':
            case 'contact_updated':
                // Handle contact events if needed (e.g., update contact details in DB)
                console.log('Contact event received, not yet implemented:', event.event);
                break;
            default:
                console.log('Unhandled Chatwoot event type:', event.event);
        }

        return NextResponse.json({ status: 'ok', received: true }, { status: 200 });

    } catch (error: any) {
        console.error('Error processing Chatwoot webhook:', error.message, error.stack);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function handleConversationEvent(event: any, request: NextRequest) {
    const CHATWOOT_URL = process.env.CHATWOOT_URL;
    const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

    if (!CHATWOOT_URL || !ACCOUNT_ID || !API_TOKEN) {
        console.error("WEBHOOK: ERRO: Variáveis de ambiente do Chatwoot não configuradas!");
        return;
    }

    const conversationId = event.id; // For conversation events, 'id' is the conversation ID
    if (!conversationId) {
        console.warn('WEBHOOK: Conversation ID not found in event payload.');
        return;
    }

    try {
        // Fetch the full conversation details
        const convResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}`, {
            headers: { 'api_access_token': API_TOKEN },
        });

        if (!convResponse.ok) {
            console.error(`WEBHOOK: Failed to fetch conversation ${conversationId}. Status: ${convResponse.status}`);
            return;
        }

        const convPayload = await convResponse.json();
        const chatwootConversation = convPayload.payload;

        if (chatwootConversation) {
            // Transform and store the updated ticket
            const ticket = transformChatwootConversationToTicket(chatwootConversation);
            await putTicket(ticket);
            console.log(`WEBHOOK: Updated ticket ${ticket.id} from conversation event.`);

            // Also fetch and update messages for this conversation
            await fetchAndStoreMessagesForConversation(chatwootConversation, CHATWOOT_URL, ACCOUNT_ID, API_TOKEN);
        }
    } catch (error: any) {
        console.error(`WEBHOOK: Error handling conversation event for ${conversationId}:`, error.message);
    }
}

async function handleMessageEvent(event: any, request: NextRequest) {
    const CHATWOOT_URL = process.env.CHATWOOT_URL;
    const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

    if (!CHATWOOT_URL || !ACCOUNT_ID || !API_TOKEN) {
        console.error("WEBHOOK: ERRO: Variáveis de ambiente do Chatwoot não configuradas!");
        return;
    }

    const conversationId = event.conversation.id;
    if (!conversationId) {
        console.warn('WEBHOOK: Conversation ID not found in message event payload.');
        return;
    }

    try {
        // Fetch the full conversation details to get sender name for messages
        const convResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}`, {
            headers: { 'api_access_token': API_TOKEN },
        });
        let contactNameForMessages = "Contato";
        if (convResponse.ok) {
            const convPayload = await convResponse.json();
            contactNameForMessages = convPayload.payload?.meta?.sender?.name || "Contato";
        } else {
            console.warn(`WEBHOOK: Could not fetch conversation details for ${conversationId} to get sender name.`);
        }

        // Fetch all messages for the conversation using 'before' parameter
        let allMessages: any[] = []; // Use 'any' for now, as ChatwootMessage is not exported
        let before: string | null = null;

        while (true) {
            let messagesUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`;
            if (before) {
                messagesUrl += `?before=${before}`;
            }

            const messagesResponse = await fetch(messagesUrl, {
                headers: { 'api_access_token': API_TOKEN },
            });

            if (!messagesResponse.ok) {
                console.warn(`WEBHOOK: Failed to fetch messages for conversation ${conversationId} with 'before'=${before}. Status: ${messagesResponse.status}`);
                break;
            }

            const messagesPayload = await messagesResponse.json();
            const messages = Array.isArray(messagesPayload.payload) ? messagesPayload.payload : messagesPayload.data?.payload || [];

            if (messages.length === 0) {
                break;
            }

            allMessages = allMessages.concat(messages);

            if (messages.length < 20) {
                break;
            }

            before = messages[messages.length - 1].id.toString();
        }

        if (allMessages.length > 0) {
            const transformedMessages = transformChatwootMessagesForFrontend(allMessages, contactNameForMessages);
            await putConversationMessages(conversationId.toString(), transformedMessages);
            console.log(`WEBHOOK: Updated messages for ticket ${conversationId} from message event.`);
        } else {
            console.warn(`WEBHOOK: No messages found for conversation ${conversationId} after message event.`);
        }

    } catch (error: any) {
        console.error(`WEBHOOK: Error handling message event for conversation ${conversationId}:`, error.message);
    }
}

// Helper function to fetch and store messages for a given conversation
async function fetchAndStoreMessagesForConversation(
    chatwootConversation: any, // Use any for now, as ChatwootConversation is not exported
    CHATWOOT_URL: string,
    ACCOUNT_ID: string,
    API_TOKEN: string
) {
    const conversationId = chatwootConversation.id;
    let allMessages: any[] = [];
    let before: string | null = null;
    const contactNameForMessages = chatwootConversation.meta?.sender?.name || "Contato";

    while (true) {
        let messagesUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`;
        if (before) {
            messagesUrl += `?before=${before}`;
        }

        const messagesResponse = await fetch(messagesUrl, {
            headers: { 'api_access_token': API_TOKEN },
        });

        if (!messagesResponse.ok) {
            console.warn(`WEBHOOK: Failed to fetch messages for conversation ${conversationId} with 'before'=${before}. Status: ${messagesResponse.status}`);
            break;
        }

        const messagesPayload = await messagesResponse.json();
        const messages = Array.isArray(messagesPayload.payload) ? messagesPayload.payload : messagesPayload.data?.payload || [];

        if (messages.length === 0) {
            break;
        }

        allMessages = allMessages.concat(messages);

        if (messages.length < 20) {
            break;
        }

        before = messages[messages.length - 1].id.toString();
    }

    if (allMessages.length > 0) {
        const transformedMessages = transformChatwootMessagesForFrontend(allMessages, contactNameForMessages);
        await putConversationMessages(conversationId.toString(), transformedMessages);
        console.log(`WEBHOOK: Stored messages for conversation ${conversationId}.`);
    } else {
        console.warn(`WEBHOOK: No messages found for conversation ${conversationId}.`);
    }
}
