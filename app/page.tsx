"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation'; // Import useRouter

// --- Interfaces (devem corresponder às da API, incluindo attachments) ---
interface ChatwootAttachment { // Necessária para os anexos
    id: number;
    file_type: 'image' | 'audio' | 'video' | 'file' | 'story_mention' | 'fallback';
    data_url: string;
    thumb_url?: string;
    file_name?: string;
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
    text: string; // Este texto virá da API já com o placeholder se for só anexo
    timestamp: number;
    isSystemMessage: boolean;
    attachments?: ChatwootAttachment[]; // <<<< ADICIONADO PARA ANEXOS
}

interface ConversationData {
    [ticketId: string]: ConversationMessageForFrontend[];
}

const LOGO_URL = "https://s3.dev.amssergipe.com.br/general/frgtbsrravgteb.png";

function formatLastActivity(timestamp: number): string {
    const now = new Date();
    const activityDate = new Date(timestamp * 1000);
    const diffSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return `Há ${diffSeconds} seg`;
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    if (now.toDateString() === activityDate.toDateString()) {
        return `Hoje, ${activityDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === activityDate.toDateString()) {
        return `Ontem, ${activityDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return activityDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + `, ${activityDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function TicketDashboardPage() {
    const [pageTitle] = useState("Painel de Solicitações AMS");
    const [headerTitle, setHeaderTitle] = useState("Solicitações");
    const [allTickets, setAllTickets] = useState<TicketForFrontend[]>([]);
    const [ticketConversations, setTicketConversations] = useState<ConversationData>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [currentTicketForModal, setCurrentTicketForModal] = useState<TicketForFrontend | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredTickets, setFilteredTickets] = useState<TicketForFrontend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1); // New state for current page
    const ticketsPerPage = 25; // Max tickets per page
    const [totalTicketsCount, setTotalTicketsCount] = useState(0); // New state for total ticket count
    const router = useRouter(); // Initialize useRouter
    const [isAuthenticating, setIsAuthenticating] = useState(true); // New state for auth check

    useEffect(() => {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const loginTimestamp = localStorage.getItem('loginTimestamp');
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

        if (isAuthenticated && loginTimestamp) {
            const timeSinceLogin = Date.now() - parseInt(loginTimestamp, 10);
            if (timeSinceLogin < oneHour) {
                setIsAuthenticating(false); // User is authenticated and session is valid
            } else {
                // Session expired
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('loginTimestamp');
                router.push('/login');
            }
        } else {
            // Not authenticated or no timestamp
            router.push('/login');
        }
    }, [router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Construct API URL with pagination parameters
        const apiUrl = `/api/ticket-history?page=${currentPage}&per_page=${ticketsPerPage}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Falha: ${response.statusText}` }));
                throw new Error(errorData.error || `Falha ao buscar dados: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setAllTickets(data.tickets || []);
            setTicketConversations(data.conversations || {});
            setTotalTicketsCount(data.totalTicketsCount || 0); // Set total ticket count
        } catch (err: any) {
            console.error("PAGE: Erro ao buscar dados:", err);
            setError(err.message || "Ocorreu um erro ao carregar os tickets.");
        } finally {
            setLoading(false);
        }
    }, [currentPage, ticketsPerPage]); // Add currentPage and ticketsPerPage to dependency array

    useEffect(() => {
        if (!isAuthenticating) { // Only fetch data if authenticated
            fetchData();
            // Re-fetch data on interval only if not searching and not on a specific page
            const intervalId = setInterval(() => {
                if (!searchTerm && currentPage === 1) { fetchData(); }
            }, 30000);
            return () => clearInterval(intervalId);
        }
    }, [fetchData, searchTerm, isAuthenticating, currentPage]); // Add currentPage to dependency array

    useEffect(() => {
        let tempFiltered = [...allTickets];
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            tempFiltered = allTickets.filter(ticket =>
                ticket.id.toLowerCase().includes(lowerSearchTerm) ||
                ticket.assunto.toLowerCase().includes(lowerSearchTerm) ||
                ticket.agent.toLowerCase().includes(lowerSearchTerm) ||
                ticket.type.toLowerCase().includes(lowerSearchTerm) ||
                ticket.status.toLowerCase().includes(lowerSearchTerm) ||
                ticket.contactName.toLowerCase().includes(lowerSearchTerm) ||
                ticket.empresa.toLowerCase().includes(lowerSearchTerm)
            );
            setCurrentPage(1); // Reset to first page on new search
        }
        setFilteredTickets(tempFiltered);
        if (searchTerm && tempFiltered.length !== allTickets.length) {
            setHeaderTitle(`${tempFiltered.length} de ${allTickets.length} solicitações encontradas`);
        } else if (allTickets.length > 0) {
            setHeaderTitle(`${tempFiltered.length > 0 ? tempFiltered.length : 'Nenhuma'} solicitaç${tempFiltered.length === 1 ? 'ão' : 'ões'}`);
        } else if (!loading) {
             setHeaderTitle("Nenhuma solicitação");
        } else {
            setHeaderTitle("Solicitações");
        }
    }, [searchTerm, allTickets, loading]);

    const formatMessageTimestampDetails = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return {
            date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const handleShowConversationHistory = (ticket: TicketForFrontend) => {
        setCurrentTicketForModal(ticket);
        setModalVisible(true);
    };

    const handleCloseConversationHistory = () => setModalVisible(false);

    // Pagination logic
    const indexOfLastTicket = currentPage * ticketsPerPage;
    const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
    // When searching, we paginate over filteredTickets. When not searching, we paginate over allTickets (which are paginated by API)
    const ticketsToPaginate = searchTerm ? filteredTickets : allTickets;
    const currentTickets = ticketsToPaginate.slice(indexOfFirstTicket, indexOfLastTicket);
    const totalPages = Math.ceil((searchTerm ? filteredTickets.length : totalTicketsCount) / ticketsPerPage);

    const handleNextPage = () => {
        setCurrentPage((prev: number) => Math.min(prev + 1, totalPages));
    };

    const handlePrevPage = () => {
        setCurrentPage((prev: number) => Math.max(prev - 1, 1));
    };

    // Render a loading state or null while checking authentication
    if (isAuthenticating) {
        return (
            <div className="dashboard-container dashboard-v2" style={{ textAlign: 'center', padding: '50px', color: '#e0e0e0' }}>
                <p>Verificando autenticação...</p>
            </div>
        );
    }

    if (loading && allTickets.length === 0) {
        return (
            <div className="dashboard-container dashboard-v2" style={{ textAlign: 'center', padding: '50px', color: '#e0e0e0' }}>
                <Image src={LOGO_URL} alt="Logo AMS Sergipe" width={40} height={40} style={{ marginBottom: '20px' }} priority />
                <p>Carregando solicitações...</p>
            </div>
        );
    }

    if (error && !loading && allTickets.length === 0) {
        return (
            <div className="dashboard-container dashboard-v2" style={{ textAlign: 'center', padding: '20px', color: '#ff6b6b' }}>
                <Image src={LOGO_URL} alt="Logo AMS Sergipe" width={40} height={40} style={{ marginBottom: '20px' }} priority />
                <h2>Ocorreu um Erro ao Carregar</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="dashboard-container dashboard-v2">
                <div className="dashboard-header-v2">
                    <h1>Painel de Tickets</h1>
                </div>

                <div className="search-bar-container-v2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        placeholder="Pesquisar por assunto, ID, empresa, solicitante, agente..."
                    />
                    <button onClick={() => fetchData()} className="refresh-button" title="Atualizar lista de tickets">
                        &#x21bb; {/* Unicode for refresh symbol */}
                    </button>
                </div>
                
                {error && !loading && allTickets.length > 0 &&
                    <p className="warning-message">
                        Aviso ao tentar atualizar: {error} (Exibindo últimos dados carregados)
                    </p>
                }
                {loading && allTickets.length > 0 &&
                    <p className="info-message">
                        Atualizando lista de solicitações...
                    </p>
                }

                {!loading && filteredTickets.length === 0 ? (
                     <div className="no-history" style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                        {searchTerm ? "Nenhuma solicitação encontrada para sua pesquisa." : "Nenhuma solicitação para exibir no momento."}
                    </div>
                ) : (
                    <>
                        <table id="ticketsTable" className="tickets-table-v2">
                            <thead>
                                <tr>
                                    <th style={{width: '35%'}}>Assunto</th>
                                    <th style={{width: '5%'}}>ID</th>
                                    <th style={{width: '15%'}}>Empresa</th>
                                    <th style={{width: '15%'}}>Solicitante</th>
                                    <th style={{width: '10%'}}>Agente</th>
                                    <th style={{width: '10%'}}>Criado em</th>
                                    <th style={{width: '10%'}}>Última Atualização</th>
                                    <th style={{width: '10%'}}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentTickets.map(ticket => ( // Use currentTickets here
                                    <tr key={ticket.id} className="ticket-row" onClick={() => handleShowConversationHistory(ticket)}>
                                        <td className="assunto-cell" data-label="Assunto" title={ticket.assunto}>{ticket.assunto}</td>
                                        <td data-label="ID">#{ticket.id}</td>
                                        <td data-label="Empresa" title={ticket.empresa}>{ticket.empresa}</td>
                                        <td data-label="Solicitante" title={ticket.contactName}>{ticket.contactName}</td>
                                        <td data-label="Agente">{ticket.agent}</td>
                                        <td data-label="Criado em">{ticket.dateCreated}</td>
                                        <td data-label="Última Atualização">{formatLastActivity(ticket.lastActivityAt)}</td>
                                        <td data-label="Status"><span className={`status ${ticket.statusClass}`}>{ticket.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalPages > 1 && (
                            <div className="pagination-controls">
                                <button onClick={handlePrevPage} disabled={currentPage === 1}>
                                    Anterior
                                </button>
                                <span>Página {currentPage} de {totalPages}</span>
                                <button onClick={handleNextPage} disabled={currentPage === totalPages}>
                                    Próxima
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Modal de Histórico */}
                {modalVisible && currentTicketForModal && (
                    <div 
                        className={`conversation-history-modal-overlay ${modalVisible ? 'modal-active' : ''}`}
                        onClick={handleCloseConversationHistory} // Close modal when clicking outside
                    >
                        <div 
                            id="conversationHistoryModal" 
                            className="conversation-history-modal" 
                            role="dialog" 
                            aria-modal="true" 
                            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
                        >
                        <button className="close-history" onClick={handleCloseConversationHistory}>Fechar Histórico X</button>
                        <h3>
                            Ticket #{currentTicketForModal.id}: {currentTicketForModal.assunto}
                            <br/>
                            <span style={{fontSize: '0.9em', color: '#ccc'}}>
                                Solicitante: {currentTicketForModal.contactName} ({currentTicketForModal.empresa || 'Empresa não informada'})
                            </span>
                        </h3>
                        <div id="historyMessages" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
                            {ticketConversations[currentTicketForModal.id] && ticketConversations[currentTicketForModal.id].length > 0 ? (
                                (() => {
                                    let lastDisplayedDate: string | null = null;
                                    return ticketConversations[currentTicketForModal.id]
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
                                                        
                                                        {/* MODIFICAÇÃO PRINCIPAL AQUI: Renderização de texto e/ou anexos */}
                                                        <div className="message-content">
                                                            {/* Renderiza o texto se ele existir E não for apenas o placeholder de anexo que a API já trata */}
                                                            {msg.text && !(msg.attachments && msg.attachments.length > 0 && msg.text.startsWith('[')) &&
                                                                <span className="message-text">{msg.text}</span>
                                                            }
                                                            {/* Renderiza os anexos */}
                                                            {msg.attachments && msg.attachments.map((att: ChatwootAttachment) => (
                                                                <div key={att.id} className="message-attachment">
                                                                    {att.file_type === 'image' ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
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
                                                                    ) : ( // file e outros
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
                                                             {/* Se não houver texto principal nem anexos (deve ser raro agora), ou se o texto for só o placeholder e não houver anexo visualizado */}
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
                )}
            </div>
        </>
    );
}
