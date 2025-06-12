// /home/root/apps/tickets-dashboard/app/api/ticket-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../utils/auth';
import { initializeDatabase, putTickets, getAllTickets, getTotalTicketCount, putConversations, getConversationsByIds } from '../../../server/db';

// Global variable to track last successful sync time
// In a production serverless environment, this would need a persistent store (e.g., Redis, another DB table)
// For a long-running VPS process, this can work as a simple in-memory cache timestamp.
let lastSuccessfulSync: number = 0;
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

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

function transformChatwootConversationToTicket(
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

    let statusText = conv.status.charAt(0).toUpperCase() + conv.status.slice(1);
    let statusClass = `status-${conv.status.toLowerCase()}`;
    const hasLojaParadaTag = conv.labels?.includes('loja-parada');

    if (hasLojaParadaTag) {
        statusText = "Loja Parada";
        statusClass = "status-loja-parada";
    } else {
        switch (conv.status.toLowerCase()) {
            case "resolved": statusText = "Resolvido"; statusClass = "status-resolved"; break;
            case "pending": statusText = "Pendente"; statusClass = "status-on-hold"; break;
            case "open": statusText = "Aberto"; statusClass = "status-aberto"; break;
            case "snoozed": statusText = "Adiado"; statusClass = "status-on-hold"; break;
        }
    }

    return {
        id: conv.id.toString(),
        status: statusText,
        statusClass: statusClass,
        type: conv.meta?.inbox?.name || "N/A",
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
function transformChatwootMessagesForFrontend(
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
    page: string,
    perPage: string,
    isSpecificContactSearch: boolean,
    contactIdParam: string | null
) {
    try {
        let conversationsUrl: string;
        if (isSpecificContactSearch) {
            conversationsUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contactIdParam}/conversations`;
        } else {
            conversationsUrl = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations?status=all&sort=-last_activity_at&page=${page}&per_page=${perPage}`;
        }

        const response = await fetch(conversationsUrl, {
            headers: { 'api_access_token': API_TOKEN },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Erro desconhecido" }));
            console.error(`API: Falha ao buscar conversas (${response.status}): ${errorData.message || response.statusText} para URL: ${conversationsUrl}`);
            throw new Error(`Falha ao buscar conversas do Chatwoot: ${errorData.message || response.statusText}`);
        }

        const chatwootPayload = await response.json();
        const rawConversations: ChatwootConversation[] = isSpecificContactSearch
            ? chatwootPayload.payload
            : chatwootPayload.data.payload;

        if (!Array.isArray(rawConversations)) {
            console.error("API: Resposta inesperada (esperava array de conversas):", rawConversations);
            throw new Error("Formato de resposta inválido da API de conversas.");
        }

        const ticketsToStore: TicketForFrontend[] = [];
        const conversationsToStore: { [ticketId: string]: ConversationMessageForFrontend[] } = {};

        for (const conv of rawConversations) {
            let contactDetails: ChatwootContact | null = null;
            if (conv.meta.sender?.id) {
                contactDetails = await getContactDetails(conv.meta.sender.id, ACCOUNT_ID, CHATWOOT_URL, API_TOKEN);
            }
            
            ticketsToStore.push(transformChatwootConversationToTicket(conv, contactDetails));
            
            const messagesResponse = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conv.id}/messages`, {
                 headers: { 'api_access_token': API_TOKEN },
            });

            if (messagesResponse.ok) {
                const messagesPayload = await messagesResponse.json();
                const contactNameForMessages = conv.meta.sender?.name || "Contato";
                const allMessages = Array.isArray(messagesPayload.payload) ? messagesPayload.payload : messagesPayload.data?.payload || [];
                
                if (allMessages.length > 0) {
                    conversationsToStore[conv.id.toString()] = transformChatwootMessagesForFrontend(allMessages, contactNameForMessages);
                } else {
                    conversationsToStore[conv.id.toString()] = [{ id: Date.now(), sender: "Sistema", text: "Nenhum histórico de mensagens encontrado para esta conversa.", timestamp: Math.floor(Date.now()/1000), isSystemMessage: true, attachments: [] }];
                }
            } else {
                console.warn(`API: Não foi possível buscar mensagens para a conversa ${conv.id}. Status: ${messagesResponse.status}`);
                conversationsToStore[conv.id.toString()] = [{ id: Date.now(), sender: "Sistema", text: "Falha ao carregar histórico desta conversa.", timestamp: Math.floor(Date.now()/1000), isSystemMessage: true, attachments: [] }];
            }
        }

        // Store fetched data in SQLite
        await putTickets(ticketsToStore);
        await putConversations(conversationsToStore);
        lastSuccessfulSync = Date.now(); // Update sync timestamp
        console.log('Data successfully synchronized with Chatwoot and stored in SQLite.');
        return { tickets: ticketsToStore, conversations: conversationsToStore };

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

        let totalTicketsCount = 0;

        // 1. Try to serve from cache first
        try {
            // Fetch paginated tickets from cache
            const parsedPage = parseInt(page);
            const parsedPerPage = parseInt(perPage);
            const cachedTickets = await getAllTickets(parsedPage, parsedPerPage);
            totalTicketsCount = await getTotalTicketCount(); // Get total count for pagination

            if (cachedTickets.length > 0) {
                const ticketIds = cachedTickets.map(ticket => ticket.id);
                const cachedConversations = await getConversationsByIds(ticketIds);
                
                tickets = cachedTickets;
                conversationDetails = cachedConversations;
                servedFromCache = true;
                console.log('Serving data from SQLite cache.');
            }
        } catch (cacheError: any) {
            console.warn("API: Erro ao ler do cache SQLite:", cacheError.message);
            // Continue to fetch from API if cache read fails
        }

        // 2. Determine if a background sync is needed
        const needsSync = (Date.now() - lastSuccessfulSync) > SYNC_INTERVAL_MS;

        if (needsSync || !servedFromCache) {
            console.log(needsSync ? 'Initiating background sync (interval).' : 'Initiating foreground fetch (no cache).');
            // Fetch from external API and update cache
            const syncedData = await syncDataWithChatwoot(CHATWOOT_URL, ACCOUNT_ID, API_TOKEN, page, perPage, !!contactIdParam, contactIdParam);
            
            // Always update the cache with the latest data from Chatwoot
            // The `syncDataWithChatwoot` function already handles `putTickets` and `putConversations`
            
            // If data was NOT served from cache, use the newly synced data for the response
            if (!servedFromCache) {
                tickets = syncedData.tickets;
                conversationDetails = syncedData.conversations;
                totalTicketsCount = await getTotalTicketCount(); // Recalculate total count after sync
            }
        }

        // If after all attempts, we still have no tickets, return an error
        if (tickets.length === 0 && totalTicketsCount === 0) {
            return NextResponse.json({ error: 'Nenhum ticket disponível ou erro na sincronização.' }, { status: 500 });
        }

        return NextResponse.json({
            tickets: tickets,
            conversations: conversationDetails,
            totalTicketsCount: totalTicketsCount, // Return total count for frontend pagination
        });

    } catch (error: any) {
        console.error("API: Erro na rota /api/ticket-history:", error.message, error.stack);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor ao processar os tickets.' }, { status: 500 });
    }
}
