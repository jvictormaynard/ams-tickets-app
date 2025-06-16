// /home/root/apps/tickets-dashboard/app/api/ticket-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../utils/auth';
import { initializeDatabase, putTickets, getAllTickets, getTotalTicketCount, putConversations, getConversationsByIds } from '../../../server/db';

let isSyncing = false; // Flag to prevent concurrent syncs

// With webhooks, we no longer need a polling mechanism or in-memory sync timestamp.
// Data updates will be driven by incoming webhook events.

// --- Interfaces Detalhadas do Chatwoot e para o Frontend ---
interface CustomAttributes {
    [key: string]: any;
}

interface AdditionalAttributes {
    company_name?: string;
    [key: string]: any;
}

interface ChatwootCompany {
    id: number;
    name: string;
}

interface ChatwootAttachment { // Nova interface para anexos
    id: number;
    file_type: 'image' | 'audio' | 'video' | 'file' | 'story_mention' | 'fallback'; // Tipos comuns
    data_url: string; // URL do anexo
    thumb_url?: string; // URL da miniatura (para imagens/vídeos)
    file_name?: string; // Nome do arquivo
    // ... outros campos do anexo
}

interface ChatwootMessage {
    id: number;
    content?: string; // Pode ser nulo se houver anexos
    created_at: number;
    message_type: 0 | 1 | 2 | 3;
    private: boolean;
    sender?: {
        id?: number;
        name?: string;
        type?: 'user' | 'agent_bot' | 'contact';
    };
    attachments?: ChatwootAttachment[]; // Adicionando attachments
}

interface ChatwootContact {
    id: number;
    name: string;
    custom_attributes?: CustomAttributes;
    additional_attributes?: AdditionalAttributes;
    company?: ChatwootCompany;
}

interface ChatwootConversation {
    id: number;
    status: string;
    created_at: number;
    last_activity_at: number;
    messages: ChatwootMessage[];
    labels?: string[];
    custom_attributes?: CustomAttributes;
    meta: {
        assignee?: { name: string };
        sender: ChatwootContact;
        inbox?: { name: string };
    };
}

interface TicketForFrontend {
    id: string;
    status: string;
    statusClass: string;
    type: string;
    assunto: string;
    agent: string;
    dateCreated: string;
    lastActivityAt: number;
    contactName: string;
    empresa: string;
    modalDescription: string;
}

interface ConversationMessageForFrontend {
    id: number;
    sender: string;
    text: string; // Continuará sendo usado, mas pode indicar um anexo
    timestamp: number;
    isSystemMessage: boolean;
    attachments?: ChatwootAttachment[]; // Passar os anexos para o frontend
}

// --- Funções Auxiliares de Transformação ---

// getContactDetails e transformChatwootConversationToTicket permanecem iguais à última versão
async function getContactDetails(contactId: number, accountId: string, chatwootUrl: string, apiToken: string): Promise<ChatwootContact | null> {
    if (!contactId || !accountId || !chatwootUrl || !apiToken) return null;
    try {
        const contactRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/contacts/${contactId}`, {
            headers: { 'api_access_token': apiToken },
        });
        if (contactRes.ok) {
            const contactPayload = await contactRes.json();
            return contactPayload.payload as ChatwootContact;
        }
        console.warn(`API: Não foi possível buscar detalhes do contato ${contactId}. Status: ${contactRes.status}`);
        return null;
    } catch (e: any) {
        console.error(`API: Erro ao buscar detalhes do contato ${contactId}:`, e.message);
        return null;
    }
}

export function transformChatwootConversationToTicket(
    conv: ChatwootConversation,
    contactDetails?: ChatwootContact | null
): TicketForFrontend {
    const customAssuntoRaw = conv.custom_attributes?.problema;
    const assunto = customAssuntoRaw || (conv.messages && conv.messages[0]?.content) || "Assunto não especificado";

    let empresa = "N/A";
    if (contactDetails?.company?.name) {
        empresa = contactDetails.company.name;
    } else if (contactDetails?.additional_attributes?.company_name) {
        empresa = contactDetails.additional_attributes.company_name;
    } else if (contactDetails?.custom_attributes?.empresa) {
        empresa = contactDetails.custom_attributes.empresa;
    }

    let modalDesc = assunto;
    if (assunto === "Assunto não especificado" && conv.messages && conv.messages.length > 0) {
        const firstMessageContent = conv.messages[0]?.content;
        if (firstMessageContent) modalDesc = firstMessageContent;
    }

    let statusText: string;
    let statusClass: string;
    const hasLojaParadaTag = conv.labels?.includes('loja-parada');

    if (hasLojaParadaTag) {
        statusText = "Loja Parada";
        statusClass = "status-loja-parada";
    } else {
        // Default status text and class based on Chatwoot status
        switch (conv.status.toLowerCase()) {
            case "resolved":
                statusText = "Resolvido";
                statusClass = "status-resolved";
                break;
            case "pending":
                statusText = "Pendente";
                statusClass = "status-pending"; // Use specific class for pending
                break;
            case "open":
                statusText = "Aberto";
                statusClass = "status-aberto";
                break;
            case "snoozed":
            case "on-hold": // Map "on-hold" from Chatwoot to "Adiado"
            case "on_hold": // Also map "on_hold" (with underscore) to "Adiado"
            case "on hold": // Also map "on hold" (with space) to "Adiado"
                statusText = "Adiado";
                statusClass = "status-snoozed"; // Use specific class for snoozed
                break;
            default:
                // Fallback for any other status not explicitly handled
                // If Chatwoot status is not one of the explicit cases, use its raw value
                statusText = conv.status.charAt(0).toUpperCase() + conv.status.slice(1);
                statusClass = `status-${conv.status.toLowerCase()}`;
                break;
        }
    }

    return {
        id: conv.id.toString(),
        status: statusText,
        statusClass: statusClass,
        type: conv.meta?.inbox?.name || "Não Classificado", // Change default from "N/A"
        assunto: assunto.substring(0, 80) + (assunto.length > 80 ? "..." : ""),
        agent: conv.meta?.assignee?.name || "N/A",
        dateCreated: new Date(conv.created_at * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        lastActivityAt: conv.last_activity_at,
        contactName: conv.meta.sender?.name || "Contato Desconhecido",
        empresa: empresa,
        modalDescription: modalDesc,
    };
}

// Modificada para lidar com anexos
export function transformChatwootMessagesForFrontend(
    chatwootMessages: ChatwootMessage[],
    contactNameFromConversation: string
): ConversationMessageForFrontend[] {
    if (!chatwootMessages || chatwootMessages.length === 0) return [];
    return chatwootMessages.map(msg => {
        const isSystemMsg = msg.message_type === 3 || msg.message_type === 2 || msg.private;
        let senderName = "Sistema";
        let messageText = msg.content || ""; // Inicia com o conteúdo, se houver

        if (!isSystemMsg && msg.sender) {
            if (msg.message_type === 0) { // Incoming (Cliente)
                senderName = `${msg.sender.name || contactNameFromConversation} (Cliente)`;
            } else if (msg.message_type === 1) { // Outgoing (Agente)
                senderName = `${msg.sender.name || 'Agente'} (Agente)`;
            } else if (msg.sender.name) {
                senderName = msg.sender.name;
            }
        }

        // Verifica se há anexos e se não há conteúdo de texto principal
        if (msg.attachments && msg.attachments.length > 0) {
            const attachment = msg.attachments[0]; // Pega o primeiro anexo para simplificar
            let attachmentDescription = "";
            switch (attachment.file_type) {
                case 'image': attachmentDescription = `[Imagem: ${attachment.file_name || 'imagem'}]`; break;
                case 'audio': attachmentDescription = `[Áudio: ${attachment.file_name || 'áudio'}]`; break;
                case 'video': attachmentDescription = `[Vídeo: ${attachment.file_name || 'vídeo'}]`; break;
                case 'file': attachmentDescription = `[Arquivo: ${attachment.file_name || 'documento'}]`; break;
                default: attachmentDescription = `[Anexo: ${attachment.file_name || 'mídia'}]`;
            }
            // Se já houver texto, anexa a descrição. Se não, usa apenas a descrição.
            messageText = messageText ? `${messageText} ${attachmentDescription}` : attachmentDescription;
        } else if (!messageText) { // Se não houver anexos E não houver conteúdo
            messageText = isSystemMsg ? "(Ação do sistema ou nota interna)" : "(Mensagem sem conteúdo)";
        }

        return {
            id: msg.id,
            sender: senderName,
            text: messageText,
            timestamp: msg.created_at,
            isSystemMessage: isSystemMsg,
            attachments: msg.attachments, // Passa os anexos para o frontend, caso queira renderizá-los
        };
    });
}


// Function to fetch data from Chatwoot API and update SQLite
async function syncDataWithChatwoot(
    CHATWOOT_URL: string,
    ACCOUNT_ID: string,
    API_TOKEN: string,
    isSpecificContactSearch: boolean,
    contactIdParam: string | null
) {
    try {
        let allRawConversations: ChatwootConversation[] = [];
        let conversationsPage = 1;
        let hasMoreConversations = true;
        let conversationsFetchedCount = 0;
        let totalConversationsFromAPI = 0; // To store meta.all_count

        console.log('SYNC: Starting conversation fetch from Chatwoot...');
        while (hasMoreConversations) {
            let conversationsUrl: string;
            if (isSpecificContactSearch) {
                conversationsUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contactIdParam}/conversations`;
                hasMoreConversations = false; // Only one call for specific contact
            } else {
                // Use 'page' parameter with fixed per_page=20 as per Chatwoot API behavior
                conversationsUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations?status=all&sort=-last_activity_at&page=${conversationsPage}&per_page=20`; // Fixed at 20
            }
            console.log(`SYNC: Fetching conversations from: ${conversationsUrl}`);

            const response = await fetch(conversationsUrl, {
                headers: { 'api_access_token': API_TOKEN },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Erro desconhecido" }));
                console.error(`SYNC: Falha ao buscar conversas (${response.status}): ${errorData.message || response.statusText} para URL: ${conversationsUrl}`);
                throw new Error(`Falha ao buscar conversas do Chatwoot: ${errorData.message || response.statusText}`);
            }

            const chatwootPayload = await response.json();
            const currentConversationsPage: ChatwootConversation[] = isSpecificContactSearch
                ? chatwootPayload.payload
                : chatwootPayload.data.payload;
            
            if (chatwootPayload.data && typeof chatwootPayload.data.meta?.all_count === 'number') {
                totalConversationsFromAPI = chatwootPayload.data.meta.all_count;
                console.log(`SYNC: Chatwoot API reports total conversations: ${totalConversationsFromAPI}`);
            }

            if (!Array.isArray(currentConversationsPage)) {
                console.error("SYNC: Resposta inesperada (esperava array de conversas):", currentConversationsPage);
                throw new Error("Formato de resposta inválido da API de conversas.");
            }

            if (currentConversationsPage.length === 0) {
                console.log('SYNC: No more conversations to fetch.');
                hasMoreConversations = false;
            } else {
                allRawConversations = allRawConversations.concat(currentConversationsPage);
                conversationsFetchedCount += currentConversationsPage.length;
                console.log(`SYNC: Fetched ${currentConversationsPage.length} conversations. Total fetched: ${conversationsFetchedCount}`);
                conversationsPage++;
                // If this was a specific contact search, we assume all conversations are returned in one go.
                // Otherwise, continue fetching until an empty page is returned.
                if (isSpecificContactSearch) {
                    hasMoreConversations = false;
                }
            }
        }

        console.log(`SYNC: Finished fetching all conversations. Total accumulated: ${allRawConversations.length}`);
        const rawConversations = allRawConversations; // Use the accumulated conversations

        const ticketsToStore: TicketForFrontend[] = [];
        const conversationsToStore: { [ticketId: string]: ConversationMessageForFrontend[] } = {};

        console.log('SYNC: Processing conversations and fetching messages...');
        for (const conv of rawConversations) {
            console.log(`SYNC: Processing conversation ${conv.id}...`);
            let contactDetails: ChatwootContact | null = null;
            if (conv.meta.sender?.id) {
                contactDetails = await getContactDetails(conv.meta.sender.id, ACCOUNT_ID, CHATWOOT_URL, API_TOKEN);
            }
            
            ticketsToStore.push(transformChatwootConversationToTicket(conv, contactDetails));
            

            // Fetch all pages of messages for the conversation using 'before' parameter
            let allMessages: ChatwootMessage[] = [];
            let before: string | null = null;
            const contactNameForMessages = conv.meta.sender?.name || "Contato";

            let messagesFetchedCount = 0;
            while (true) {
                let messagesUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conv.id}/messages`;
                if (before) {
                    messagesUrl += `?before=${before}`;
                }
                // console.log(`SYNC: Fetching messages for conv ${conv.id} from: ${messagesUrl}`); // Too verbose, uncomment if needed

                const messagesResponse = await fetch(messagesUrl, {
                    headers: { 'api_access_token': API_TOKEN },
                });

                if (!messagesResponse.ok) {
                    console.warn(`SYNC: Não foi possível buscar mensagens para a conversa ${conv.id} com 'before'=${before}. Status: ${messagesResponse.status}`);
                    break;
                }

                const messagesPayload = await messagesResponse.json();
                const messages = Array.isArray(messagesPayload.payload) ? messagesPayload.payload : messagesPayload.data?.payload || [];

                if (messages.length === 0) {
                    break;
                }

                allMessages = allMessages.concat(messages);
                messagesFetchedCount += messages.length;

                if (messages.length < 20) {
                    // Less than 20 messages, so this is the last page
                    break;
                }

                // Get the id of the oldest message to use as the 'before' parameter
                before = messages[messages.length - 1].id.toString();
            }
            console.log(`SYNC: Fetched ${messagesFetchedCount} messages for conversation ${conv.id}.`);

            // Filter out potential duplicates by message ID
            const uniqueMessages = Array.from(new Map(allMessages.map(msg => [msg.id, msg])).values());

            if (uniqueMessages.length > 0) {
                conversationsToStore[conv.id.toString()] = transformChatwootMessagesForFrontend(uniqueMessages, contactNameForMessages);
            } else {
                conversationsToStore[conv.id.toString()] = [{ id: Date.now(), sender: "Sistema", text: "Nenhum histórico de mensagens encontrado para esta conversa.", timestamp: Math.floor(Date.now()/1000), isSystemMessage: true, attachments: [] }];
            }
        }

        console.log('SYNC: All conversations and messages processed. Storing in SQLite...');
        // Store fetched data in SQLite
        await putTickets(ticketsToStore);
        await putConversations(conversationsToStore);
        console.log('SYNC: Data successfully synchronized with Chatwoot and stored in SQLite.');
        return { tickets: ticketsToStore, conversations: conversationsToStore, totalConversationsFromAPI: totalConversationsFromAPI }; // Return totalConversationsFromAPI
    } catch (error: any) {
        console.error("API: Erro durante a sincronização com Chatwoot:", error.message, error.stack);
        throw error; // Re-throw to be caught by the main GET handler
    }
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        await verifyAuth();
        await initializeDatabase(); // Ensure DB is initialized on each request (handled internally to run once)

        const { searchParams } = new URL(request.url);
        const contactIdParam = searchParams.get('contactId');
        const page = searchParams.get('page') || '1';
        const perPage = searchParams.get('per_page') || '30';

        const CHATWOOT_URL = process.env.CHATWOOT_URL;
        const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
        const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

        if (!CHATWOOT_URL || !ACCOUNT_ID || !API_TOKEN) {
            console.error("API: ERRO: Variáveis de ambiente do Chatwoot não configuradas!");
            return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        let tickets: TicketForFrontend[] = [];
        let conversationDetails: { [ticketId: string]: ConversationMessageForFrontend[] } = {};
        let servedFromCache = false;

        let totalTicketsCount = await getTotalTicketCount();
        let chatwootTotalCount = 0; // Initialize to 0

        // If the database is empty, perform an initial full sync
        if (totalTicketsCount === 0) {
            if (isSyncing) {
                console.log("API: Initial sync already in progress. Returning 202 Accepted.");
                return NextResponse.json({ error: 'Initial sync in progress. Please try again shortly.' }, { status: 202 });
            }
            isSyncing = true; // Set the flag before starting sync
            try {
                console.log("API: Database is empty. Initiating initial full sync with Chatwoot.");
                const syncedData = await syncDataWithChatwoot(CHATWOOT_URL, ACCOUNT_ID, API_TOKEN, false, null); // Fetch all, not specific contact
                tickets = syncedData.tickets;
                conversationDetails = syncedData.conversations;
                totalTicketsCount = await getTotalTicketCount(); // Recalculate total count after initial sync
                chatwootTotalCount = syncedData.totalConversationsFromAPI; // Get total count from syncDataWithChatwoot
            } finally {
                isSyncing = false; // Always reset the flag
            }
        } else {
            // With webhooks, we always serve from the cache for immediate response.
            // The cache is kept up-to-date by incoming webhook events.
            console.log('API: Serving data from SQLite cache (updated by webhooks).');
            const parsedPage = parseInt(page);
            const parsedPerPage = parseInt(perPage);
            tickets = await getAllTickets(parsedPage, parsedPerPage);
            const ticketIds = tickets.map(ticket => ticket.id);
            conversationDetails = await getConversationsByIds(ticketIds);

            // For subsequent requests, we also need the total count from Chatwoot for pagination.
            // This should ideally be cached or updated via webhooks for performance.
            // For now, re-fetching the first page to get meta.all_count
            const firstPageResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations?status=all&sort=-last_activity_at&page=1&per_page=20`, {
                headers: { 'api_access_token': API_TOKEN },
            });
            if (firstPageResponse.ok) {
                const firstPagePayload = await firstPageResponse.json();
                if (firstPagePayload.data && typeof firstPagePayload.data.meta?.all_count === 'number') {
                    chatwootTotalCount = firstPagePayload.data.meta.all_count;
                    console.log(`API: Retrieved Chatwoot total count: ${chatwootTotalCount}`);
                }
            } else {
                console.warn(`API: Failed to retrieve Chatwoot total count on subsequent request: ${firstPageResponse.status}`);
            }
        }

        // If after all attempts, we still have no tickets, return an error
        if (tickets.length === 0 && totalTicketsCount === 0 && chatwootTotalCount === 0) {
            return NextResponse.json({ error: 'Nenhum ticket disponível ou erro na sincronização inicial.' }, { status: 500 });
        }

        return NextResponse.json({
            tickets: tickets,
            conversations: conversationDetails,
            totalTicketsCount: chatwootTotalCount, // Return total count from Chatwoot API for frontend pagination
        });

    } catch (error: any) {
        console.error("API: Erro na rota /api/ticket-history:", error.message, error.stack);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor ao processar os tickets.' }, { status: 500 });
    }
}
