import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, putTicket, putConversationMessages, getConversationMessages } from '../../../server/db';
import { transformChatwootConversationToTicket, transformChatwootMessagesForFrontend } from '../ticket-history/route'; // Assuming these are exported

// This route will receive webhook events from Chatwoot
export async function POST(request: NextRequest) {
    try {
        await initializeDatabase(); // Ensure DB is ready

        const event = await request.json();
        console.log(`WEBHOOK: Received event: ${event.event} (ID: ${event.id || event.message?.id || 'N/A'})`);

        switch (event.event) {
            case 'conversation_created':
            case 'conversation_updated':
            case 'conversation_status_changed':
                await handleConversationEvent(event, request);
                console.log(`WEBHOOK: Successfully processed conversation event: ${event.event} for conversation ID: ${event.id}`);
                break;
            case 'message_created':
            case 'message_updated':
                await handleMessageEvent(event, request);
                console.log(`WEBHOOK: Successfully processed message event: ${event.event} for conversation ID: ${event.conversation?.id}, message ID: ${event.id}`);
                break;
            case 'contact_created':
            case 'contact_updated':
                console.log(`WEBHOOK: Contact event received, not yet implemented: ${event.event} (Contact ID: ${event.id})`);
                break;
            default:
                console.log(`WEBHOOK: Unhandled event type: ${event.event} (ID: ${event.id || 'N/A'})`);
        }

        return NextResponse.json({ status: 'ok', received: true }, { status: 200 });

    } catch (error: any) {
        console.error(`WEBHOOK: Fatal error processing webhook: ${error.message}`, error.stack);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

async function handleConversationEvent(event: any, request: NextRequest) {
    const CHATWOOT_URL = process.env.CHATWOOT_URL;
    const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

    if (!CHATWOOT_URL || !ACCOUNT_ID || !API_TOKEN) {
        console.error("WEBHOOK: Configuration Error: Chatwoot environment variables not set!");
        return;
    }

    const conversationId = event.id;
    if (!conversationId) {
        console.warn('WEBHOOK: Conversation ID not found in conversation event payload.');
        return;
    }

    try {
        const convResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}`, {
            headers: { 'api_access_token': API_TOKEN },
        });

        if (!convResponse.ok) {
            const errorText = await convResponse.text();
            console.error(`WEBHOOK: Failed to fetch conversation ${conversationId}. Status: ${convResponse.status}. Response: ${errorText}`);
            return;
        }

        const convPayload = await convResponse.json();
        const chatwootConversation = convPayload.payload;

        if (chatwootConversation) {
            const ticket = transformChatwootConversationToTicket(chatwootConversation);
            await putTicket(ticket);
            console.log(`WEBHOOK: Successfully updated ticket ${ticket.id} from conversation event.`);

            await fetchAndStoreMessagesForConversation(chatwootConversation, CHATWOOT_URL, ACCOUNT_ID, API_TOKEN);
        } else {
            console.warn(`WEBHOOK: No conversation data found in payload for ID: ${conversationId}`);
        }
    } catch (error: any) {
        console.error(`WEBHOOK: Error handling conversation event for ${conversationId}: ${error.message}`, error.stack);
    }
}

async function handleMessageEvent(event: any, request: NextRequest) {
    const CHATWOOT_URL = process.env.CHATWOOT_URL;
    const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

    if (!CHATWOOT_URL || !ACCOUNT_ID || !API_TOKEN) {
        console.error("WEBHOOK: Configuration Error: Chatwoot environment variables not set!");
        return;
    }

    const conversationId = event.conversation?.id;
    if (!conversationId) {
        console.warn('WEBHOOK: Conversation ID not found in message event payload.');
        return;
    }

    try {
        const convResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}`, {
            headers: { 'api_access_token': API_TOKEN },
        });
        let contactNameForMessages = "Contato";
        if (convResponse.ok) {
            const convPayload = await convResponse.json();
            contactNameForMessages = convPayload.payload?.meta?.sender?.name || "Contato";
        } else {
            console.warn(`WEBHOOK: Could not fetch conversation details for ${conversationId} to get sender name. Status: ${convResponse.status}`);
        }

        let allMessages: any[] = [];
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

        // Filter out potential duplicates by message ID
        const uniqueMessages = Array.from(new Map(allMessages.map(msg => [msg.id, msg])).values());

        if (uniqueMessages.length > 0) {
            const transformedMessages = transformChatwootMessagesForFrontend(uniqueMessages, contactNameForMessages);
            await putConversationMessages(conversationId.toString(), transformedMessages);
            console.log(`WEBHOOK: Successfully updated messages for ticket ${conversationId} from message event.`);
        } else {
            console.warn(`WEBHOOK: No messages found for conversation ${conversationId} after message event.`);
        }

    } catch (error: any) {
        console.error(`WEBHOOK: Error handling message event for conversation ${conversationId}: ${error.message}`, error.stack);
    }
}

async function fetchAndStoreMessagesForConversation(
    chatwootConversation: any,
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

    // Filter out potential duplicates by message ID
    const uniqueMessages = Array.from(new Map(allMessages.map(msg => [msg.id, msg])).values());

    if (uniqueMessages.length > 0) {
        const transformedMessages = transformChatwootMessagesForFrontend(uniqueMessages, contactNameForMessages);
        await putConversationMessages(conversationId.toString(), transformedMessages);
        console.log(`WEBHOOK: Successfully stored messages for conversation ${conversationId}.`);
    } else {
        console.warn(`WEBHOOK: No messages found for conversation ${conversationId}.`);
    }
}
