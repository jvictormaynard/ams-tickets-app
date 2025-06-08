"use client";

import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
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
        const apiUrl = "/api/ticket-history";
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
        } catch (err: any) {
            console.error("PAGE: Erro ao buscar dados:", err);
            setError(err.message || "Ocorreu um erro ao carregar os tickets.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticating) { // Only fetch data if authenticated
            fetchData();
            const intervalId = setInterval(() => {
                if (!searchTerm) { fetchData(); }
            }, 30000);
            return () => clearInterval(intervalId);
        }
    }, [fetchData, searchTerm, isAuthenticating]); // Add isAuthenticating to dependency array

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
    const currentTickets = filteredTickets.slice(indexOfFirstTicket, indexOfLastTicket);
    const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
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
            <Head><title>{pageTitle}</title></Head>
            <div className="dashboard-container dashboard-v2">
                <div className="dashboard-header-v2">
                    <h1>Painel de Tickets</h1>
                </div>

                <div className="search-bar-container-v2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Pesquisar por assunto, ID, empresa, solicitante, agente..."
                    />
                    <button onClick={() => fetchData()} className="refresh-button" title="Atualizar lista de tickets">
                        &#x21bb; {/* Unicode for refresh symbol */}
                    </button>
                </div>
                
                {error && !loading && allTickets.length > 0 &&
                    <p style={{textAlign: 'center', color: 'orange', padding: '10px 0', margin: '-15px 0 10px 0', fontSize: '0.9em'}}>
                        Aviso ao tentar atualizar: {error} (Exibindo últimos dados carregados)
                    </p>
                }
                {loading && allTickets.length > 0 &&
                    <p style={{textAlign: 'center', color: '#aaa', padding: '10px 0', margin: '-15px 0 10px 0', fontSize: '0.9em'}}>
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
                                        <td className="assunto-cell" title={ticket.assunto}>{ticket.assunto}</td>
                                        <td>#{ticket.id}</td>
                                        <td title={ticket.empresa}>{ticket.empresa}</td>
                                        <td title={ticket.contactName}>{ticket.contactName}</td>
                                        <td>{ticket.agent}</td>
                                        <td>{ticket.dateCreated}</td>
                                        <td>{formatLastActivity(ticket.lastActivityAt)}</td>
                                        <td><span className={`status ${ticket.statusClass}`}>{ticket.status}</span></td>
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
                    <div id="conversationHistoryModal" className="conversation-history-modal" style={{ display: 'block' }}>
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
                                        .sort((a, b) => a.timestamp - b.timestamp)
                                        .map((msg) => {
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
                                                            {msg.attachments && msg.attachments.map(att => (
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
                )}
            </div>
            {/* Estilos Globais (mantendo os da sua versão anterior e adicionando/ajustando para anexos) */}
            <style jsx global>{`
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #1a1d21;
                    color: #e0e0e0;
                    margin: 0;
                    font-size: 14px;
                }

                .dashboard-container.dashboard-v2 {
                    background-color: #1a1d21;
                    padding: 25px 35px;
                    max-width: 100%;
                    min-height: 100vh;
                    margin: 0;
                    color: #e0e0e0;
                }

                .dashboard-header-v2 {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 25px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #2c3035;
                }

                .dashboard-header-v2 h1 {
                    margin: 0;
                    font-size: 26px;
                    color: #e0e0e0;
                    font-weight: 500;
                }
                
                .search-bar-container-v2 {
                    margin-bottom: 25px;
                    display: flex;
                    align-items: center; /* Align items vertically */
                }

                .search-bar-container-v2 input {
                    flex-grow: 1;
                    padding: 10px 15px;
                    border-radius: 4px;
                    border: 1px solid #3a3f44;
                    background-color: #25282c;
                    color: #e0e0e0;
                    font-size: 14px;
                    margin-right: 10px; /* Add some space between input and button */
                }
                 .search-bar-container-v2 input::placeholder {
                    color: #777;
                }

                .refresh-button {
                    background-color: #007bff; /* Same as pagination buttons */
                    color: white;
                    border: none;
                    padding: 0; /* Remove padding to control size with width/height */
                    width: 36px; /* Square button width */
                    height: 36px; /* Square button height */
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 20px; /* Adjust symbol size */
                    line-height: 36px; /* Center symbol vertically */
                    text-align: center;
                    flex-shrink: 0; /* Prevent button from shrinking */
                }

                .refresh-button:hover {
                    background-color: #0056b3; /* Darker blue on hover */
                }

                .tickets-table-v2 {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }

                .tickets-table-v2 th, .tickets-table-v2 td {
                    padding: 10px 12px;
                    text-align: left;
                    border-bottom: 1px solid #2c3035;
                    vertical-align: middle;
                    font-size: 13px;
                }

                .tickets-table-v2 th {
                    background-color: transparent;
                    color: #8899a6;
                    font-weight: 500;
                    text-transform: uppercase;
                    font-size: 11px;
                }
                .tickets-table-v2 td {
                    color: #c0c0c0;
                }
                .tickets-table-v2 .assunto-cell {
                    color: #e0e0e0;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .tickets-table-v2 tr.ticket-row:hover {
                    background-color: #25282c;
                    cursor: pointer;
                }

                .status { padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: 500; text-align: center; display: inline-block; min-width: 70px; }
                .status-open { background-color: #28a745; color: white; }
                .status-on-hold { background-color: #ffc107; color: #333; }
                .status-resolved { background-color: #6c757d; color: white; }
                .status-loja-parada { background-color: #dc3545; color: white; }
                .status-aberto { background-color: #dd3b00; color: white; }
                .status-pendente { background-color: #ffab00; color: #212529; }
                .status-adiado { background-color: #6c757d; color: white; }

                .conversation-history-modal { background-color: #25282c; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); max-width: 700px; margin: 30px auto; border: 1px solid #007bff; }
                .conversation-history-modal h3 { color: #4AC9FF; margin-top: 0; border-bottom: 1px solid #3a3f44; padding-bottom: 10px; margin-bottom: 20px; font-size: 18px; }
                .close-history { background-color: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 13px; float: right; margin-bottom:10px; }
                .close-history:hover { background-color: #c82333; }
                .message { padding: 10px; margin-bottom: 10px; border-radius: 5px; line-height: 1.5; clear: both; }
                .message.customer { background-color: #353a3f; text-align: left; margin-right: 25%; }
                .message.agent { background-color: #0056b3; color: white; text-align: left; margin-left: 25%; }
                .message .sender { font-weight: bold; font-size: 0.9em; display: block; margin-bottom: 4px; color: #00A0E3; }
                .message.customer .sender { color: #6DD5FA; }
                .message-date-separator { text-align: center; margin: 15px 0 10px 0; color: #888; font-size: 0.9em; position: relative; }
                .message-date-separator span { background-color: #25282c; padding: 0 10px; position: relative; z-index: 1; }
                .message-date-separator::before { content: ""; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background-color: #3a3f44; z-index: 0; }
                .message .message-time { font-size: 0.75em; color: #999; margin-left: 8px; display: inline; }
                .message.agent .message-time { color: #e0e0e0; }
                .message.system { background-color: #3c4147; color: #a0a7af; text-align: center; font-size: 0.8em; font-style: italic; padding: 6px 10px; margin: 10px auto; max-width: 75%; border-radius: 15px; }
                
                .message.system .message-text { display: block; } /* Mantém o texto da msg de sistema */
                .message.system .message-time { display: block; font-size: 0.85em; color: #888; margin-top: 3px; }
                
                #historyMessages { display: flex; flex-direction: column; }

                /* Estilos para anexos */
                .message-content {
                    /* margin-top: 5px; */ /* Removido, pois o texto/anexo é o conteúdo principal */
                }
                .message-text { /* Texto normal da mensagem */
                    white-space: pre-wrap; 
                    word-break: break-word; 
                }
                .message-attachment {
                    margin-top: 8px; /* Espaço entre texto (se houver) e anexo, ou entre anexos */
                }
                .attachment-link {
                    color: #8ab4f8; /* Azul mais claro para links, bom em tema escuro */
                    text-decoration: none;
                    display: inline-block;
                    padding: 6px 10px;
                    background-color: #3c4147; 
                    border-radius: 4px;
                    font-size: 0.9em;
                    border: 1px solid #4a4f54;
                }
                .attachment-link:hover {
                    background-color: #4a5867;
                    border-color: #5a6877;
                    text-decoration: underline;
                }
                .message.agent .attachment-link { /* Para links em mensagens de agente */
                    color: #ffffff;
                    background-color: #0069d9; /* Um pouco mais escuro que o fundo da msg do agente */
                    border: none;
                }
                 .message.agent .attachment-link:hover {
                    background-color: #005cbf;
                 }

                .pagination-controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px 0;
                    margin-top: 10px;
                }
                .pagination-controls button {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin: 0 8px;
                }
                .pagination-controls button:hover {
                    background-color: #0056b3;
                }
                .pagination-controls button:disabled {
                    background-color: #495057;
                    cursor: not-allowed;
                }
                .pagination-controls span {
                    color: #e0e0e0;
                    font-size: 14px;
                }

            `}</style>
        </>
    );
}