"use client";

import React from 'react';
import { TicketForFrontend, ConversationData, ConversationMessageForFrontend, ChatwootAttachment } from '../types';

interface ConversationModalProps {
    visible: boolean;
    onClose: () => void;
    ticket: TicketForFrontend | null;
    conversations: ConversationData;
    formatMessageTimestampDetails: (timestamp: number) => { date: string; time: string };
}

const ConversationModal: React.FC<ConversationModalProps> = ({ visible, onClose, ticket, conversations, formatMessageTimestampDetails }) => {
    if (!visible || !ticket) {
        return null;
    }

    return (
        <div 
            className={`conversation-history-modal-overlay ${visible ? 'modal-active' : ''}`}
            onClick={onClose}
        >
            <div 
                id="conversationHistoryModal" 
                className="conversation-history-modal" 
                role="dialog" 
                aria-modal="true" 
                onClick={(e) => e.stopPropagation()}
            >
                <button className="close-history" onClick={onClose}>Fechar Histórico X</button>
                <h3>
                    Ticket #{ticket.id}: {ticket.assunto}
                    <br/>
                    <span style={{fontSize: '0.9em', color: '#ccc'}}>
                        Solicitante: {ticket.contactName} ({ticket.empresa || 'Empresa não informada'})
                    </span>
                </h3>
                <div id="historyMessages" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
                    {conversations[ticket.id] && conversations[ticket.id].length > 0 ? (
                        (() => {
                            let lastDisplayedDate: string | null = null;
                            return conversations[ticket.id]
                                .sort((a: ConversationMessageForFrontend, b: ConversationMessageForFrontend) => a.timestamp - b.timestamp)
                                .map((msg: ConversationMessageForFrontend) => {
                                    const { date, time } = formatMessageTimestampDetails(msg.timestamp);
                                    const showDateSeparator = date !== lastDisplayedDate;
                                    if (showDateSeparator) {
                                        lastDisplayedDate = date;
                                    }
                                    return (
                                        <div key={msg.id}>
                                            {showDateSeparator && (
                                                <div className="message-date-separator"><span>{date}</span></div>
                                            )}
                                            <div className={`message ${msg.isSystemMessage ? 'system' : (msg.sender.includes('(Cliente)') ? 'customer' : 'agent')}`}>
                                                {!msg.isSystemMessage && (
                                                    <span className="sender">
                                                        {msg.sender}
                                                        <span className="message-time">{time}</span>
                                                    </span>
                                                )}
                                                
                                                <div className="message-content">
                                                    {msg.text && !(msg.attachments && msg.attachments.length > 0 && msg.text.startsWith('[')) &&
                                                        <span className="message-text">{msg.text}</span>
                                                    }
                                                    {msg.attachments && msg.attachments.map((att: ChatwootAttachment) => (
                                                        <div key={att.id} className="message-attachment">
                                                            {att.file_type === 'image' ? (
                                                                <img 
                                                                    src={att.data_url} 
                                                                    alt={att.file_name || 'Imagem anexa'} 
                                                                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '4px', marginTop: msg.text && !(msg.attachments && msg.attachments.length > 0 && msg.text.startsWith('[')) ? '8px' : '0px' }} 
                                                                />
                                                            ) : att.file_type === 'audio' ? (
                                                                <audio controls src={att.data_url} style={{ marginTop: '8px', width: '100%' }}>
                                                                    Seu navegador não suporta o elemento de áudio.
                                                                </audio>
                                                            ) : att.file_type === 'video' ? (
                                                                <video controls src={att.data_url} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '4px', marginTop: '8px' }}>
                                                                    Seu navegador não suporta o elemento de vídeo.
                                                                </video>
                                                            ) : (
                                                                <a 
                                                                    href={att.data_url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="attachment-link"
                                                                    style={{ marginTop: msg.text && !(msg.attachments && msg.attachments.length > 0 && msg.text.startsWith('[')) ? '8px' : '0px' }}
                                                                >
                                                                    📎 {att.file_name || `Anexo (${att.file_type})`}
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {(!msg.text || (msg.text.startsWith('[') && msg.text.endsWith(']') && (!msg.attachments || msg.attachments.length ===0 ))) && !msg.isSystemMessage && (!msg.attachments || msg.attachments.length === 0) &&
                                                        <span className="message-text">(Mensagem sem conteúdo visível)</span>
                                                    }
                                                </div>

                                                {msg.isSystemMessage && (
                                                    <span className="message-time system-time">{time}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                        })()
                    ) : (
                        <p>Nenhum histórico de mensagens encontrado para este ticket.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConversationModal;
