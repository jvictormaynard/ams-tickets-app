export interface ChatwootAttachment {
    id: number;
    file_type: 'image' | 'audio' | 'video' | 'file' | 'story_mention' | 'fallback';
    data_url: string;
    thumb_url?: string;
    file_name?: string;
}

export interface TicketForFrontend {
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

export interface ConversationMessageForFrontend {
    id: number;
    sender: string;
    text: string;
    timestamp: number;
    isSystemMessage: boolean;
    attachments?: ChatwootAttachment[];
}

export interface ConversationData {
    [ticketId: string]: ConversationMessageForFrontend[];
}
