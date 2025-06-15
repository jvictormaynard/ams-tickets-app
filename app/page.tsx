"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter and usePathname

import {
    ChatwootAttachment,
    TicketForFrontend,
    ConversationMessageForFrontend,
    ConversationData,
} from '../types';
import TicketTable from '../components/TicketTable';
import ConversationModal from '../components/ConversationModal';

export const dynamic = 'force-dynamic'; // Force dynamic rendering for this page

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
    const ticketsPerPage = 20; // Max tickets per page (aligned with Chatwoot API fixed page size)
    const [totalTicketsCount, setTotalTicketsCount] = useState(0); // New state for total ticket count
    const router = useRouter(); // Initialize useRouter
    const pathname = usePathname(); // Get current pathname

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
            console.log('PAGE: Fetched data - Total Tickets Count:', data.totalTicketsCount); // Debug log
        } catch (err: any) {
            console.error("PAGE: Erro ao buscar dados:", err);
            setError(err.message || "Ocorreu um erro ao carregar os tickets.");
        } finally {
            setLoading(false);
        }
    }, [currentPage, ticketsPerPage]); // Add currentPage and ticketsPerPage to dependency array

    useEffect(() => {
        fetchData();
        // Re-fetch data on interval only if not searching and not on a specific page
        // This interval will be removed once webhooks are fully reliable in production
        const intervalId = setInterval(() => {
            if (!searchTerm && currentPage === 1) { fetchData(); }
        }, 30000);
        return () => clearInterval(intervalId);
    }, [fetchData, searchTerm, currentPage]);

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
    // When searching, we paginate over filteredTickets. When not searching, we use allTickets (which are already paginated by API)
    const currentTickets = searchTerm ? filteredTickets.slice((currentPage - 1) * ticketsPerPage, currentPage * ticketsPerPage) : allTickets;
    const totalPages = Math.ceil((searchTerm ? filteredTickets.length : totalTicketsCount) / ticketsPerPage);

    const handleNextPage = () => {
        setCurrentPage((prev: number) => Math.min(prev + 1, totalPages));
    };

    const handlePrevPage = () => {
        setCurrentPage((prev: number) => Math.max(prev - 1, 1));
    };


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

                {/* New navigation/tabs section */}
                <div className="dashboard-nav-tabs">
                    <button className="nav-tab active">Solicitações</button>
                    <button className="nav-tab" onClick={() => router.push('/stats')}>
                        Estatísticas e Dashboards
                    </button>
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
                    {loading && allTickets.length > 0 && (
                        <div className="inline-spinner-container">
                            <div className="loading-spinner small-spinner"></div>
                            <span className="loading-text">Atualizando...</span>
                        </div>
                    )}
                </div>
                
                {error && !loading && allTickets.length > 0 &&
                    <p className="warning-message">
                        Aviso ao tentar atualizar: {error} (Exibindo últimos dados carregados)
                    </p>
                }

                {!loading && filteredTickets.length === 0 ? (
                     <div className="no-history" style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                        {searchTerm ? "Nenhuma solicitação encontrada para sua pesquisa." : "Nenhuma solicitação para exibir no momento."}
                    </div>
                ) : (
                    <>
                        <TicketTable
                            tickets={currentTickets}
                            onTicketClick={handleShowConversationHistory}
                            formatLastActivity={formatLastActivity}
                        />
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

                <ConversationModal
                    visible={modalVisible}
                    onClose={handleCloseConversationHistory}
                    ticket={currentTicketForModal}
                    conversations={ticketConversations}
                    formatMessageTimestampDetails={formatMessageTimestampDetails}
                />
            </div>
        </>
    );
}
