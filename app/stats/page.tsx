"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BarChart from '../../components/BarChart';
import { ChartBarIcon, ClockIcon, TicketIcon, CheckCircleIcon, ExclamationCircleIcon, BeakerIcon } from '@heroicons/react/24/outline';


const LOGO_URL = "https://s3.dev.amssergipe.com.br/general/frgtbsrravgteb.png";

export default function StatsDashboardPage() {
    const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'today', 'lastWeek', 'lastMonth', 'all'
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false); // State for dropdown visibility
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statsData, setStatsData] = useState({
        totalTickets: 0,
        ticketsByStatus: {
            "Resolvido": 0,
            "Pendente": 0,
            "Aberto": 0,
            "Adiado": 0,
        },
        ticketsByAgent: {},
        ticketsByType: {},
        avgResolutionTime: 'N/A',
    });
    const router = useRouter();

    const fetchStats = useCallback(async (period: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/stats?period=${period}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Falha: ${response.statusText}` }));
                throw new Error(errorData.error || `Falha ao buscar dados: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Ensure all status categories are present, even if count is 0
            const defaultTicketsByStatus = {
                "Resolvido": 0,
                "Pendente": 0,
                "Aberto": 0,
                "Adiado": 0,
            };
            const mergedTicketsByStatus = { ...defaultTicketsByStatus, ...data.ticketsByStatus };

            setStatsData({
                totalTickets: data.totalTickets || 0,
                ticketsByStatus: mergedTicketsByStatus,
                ticketsByAgent: data.ticketsByAgent || {},
                ticketsByType: data.ticketsByType || {},
                avgResolutionTime: data.avgResolutionTime || 'N/A',
            });
        } catch (err: any) {
            console.error("Error fetching stats:", err);
            setError(err.message || "Ocorreu um erro ao carregar as estatísticas.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats(selectedPeriod);
    }, [selectedPeriod, fetchStats]);

    const handlePeriodChange = (period: string) => {
        setSelectedPeriod(period);
        setShowPeriodDropdown(false); // Close dropdown after selection
    };

    // Helper to get status color class
    const getStatusColorClass = (status: string) => {
        switch (status) {
            case "Resolvido": return "status-resolved";
            case "Pendente": return "status-pending";
            case "Aberto": return "status-aberto";
            case "Adiado": return "status-snoozed";
            case "Loja Parada": return "status-loja-parada"; // Keep this for the main ticket list if needed
            default: return "";
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container dashboard-v2" style={{ textAlign: 'center', padding: '50px', color: '#e0e0e0' }}>
                <Image src={LOGO_URL} alt="Logo AMS Sergipe" width={40} height={40} style={{ marginBottom: '20px' }} priority />
                <p>Carregando estatísticas...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container dashboard-v2" style={{ textAlign: 'center', padding: '20px', color: '#ff6b6b' }}>
                <Image src={LOGO_URL} alt="Logo AMS Sergipe" width={40} height={40} style={{ marginBottom: '20px' }} priority />
                <h2>Erro ao Carregar Estatísticas</h2>
                <p>{error}</p>
            </div>
        );
    }

    // Calculate max count for bar chart scaling
    const maxStatusCount = Math.max(...Object.values(statsData.ticketsByStatus).map(c => c as number));
    const maxAgentCount = Math.max(...Object.values(statsData.ticketsByAgent).map(c => c as number));
    const maxTypeCount = Math.max(...Object.values(statsData.ticketsByType).map(c => c as number));


    return (
        <div className="dashboard-container dashboard-v2 stats-page">
            <div className="dashboard-header-v2">
                <h1>Estatísticas e Dashboards</h1>
                <button className="nav-tab" onClick={() => router.push('/')}>Voltar para Solicitações</button>
            </div>

            <div className="period-filter-container">
                <button className="period-dropdown-button" onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}>
                    {selectedPeriod === 'today' && 'Hoje'}
                    {selectedPeriod === 'lastWeek' && 'Última Semana'}
                    {selectedPeriod === 'lastMonth' && 'Último Mês'}
                    {selectedPeriod === 'all' && 'Todos'}
                    <i className="fas fa-chevron-down dropdown-arrow"></i>
                </button>
                {showPeriodDropdown && (
                    <div className="period-dropdown-menu">
                        <button className="filter-option" onClick={() => handlePeriodChange('today')}>Hoje</button>
                        <button className="filter-option" onClick={() => handlePeriodChange('lastWeek')}>Última Semana</button>
                        <button className="filter-option" onClick={() => handlePeriodChange('lastMonth')}>Último Mês</button>
                        <button className="filter-option" onClick={() => handlePeriodChange('all')}>Todos</button>
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-card total">
                    <div className="stat-icon"><TicketIcon className="h-8 w-8" /></div>
                    <h3>Total de Tickets</h3>
                    <p className="stat-value">{statsData.totalTickets}</p>
                </div>
                <div className="stat-card resolved">
                    <div className="stat-icon"><CheckCircleIcon className="h-8 w-8" /></div>
                    <h3>Tickets Resolvidos</h3>
                    <p className="stat-value">{statsData.ticketsByStatus["Resolvido"]}</p>
                </div>
                <div className="stat-card pending">
                    <div className="stat-icon"><ExclamationCircleIcon className="h-8 w-8" /></div>
                    <h3>Tickets Pendentes</h3>
                    <p className="stat-value">{statsData.ticketsByStatus["Pendente"]}</p>
                </div>
                <div className="stat-card open">
                    <div className="stat-icon"><BeakerIcon className="h-8 w-8" /></div>
                    <h3>Tickets Abertos</h3>
                    <p className="stat-value">{statsData.ticketsByStatus["Aberto"]}</p>
                </div>
                <div className="stat-card snoozed">
                    <div className="stat-icon"><ClockIcon className="h-8 w-8" /></div>
                    <h3>Tickets Adiados</h3>
                    <p className="stat-value">{statsData.ticketsByStatus["Adiado"]}</p>
                </div>
                <div className="stat-card avg-time">
                    <div className="stat-icon"><ClockIcon className="h-8 w-8" /></div>
                    <h3>Tempo Médio de Resolução</h3>
                    <p className="stat-value">{statsData.avgResolutionTime}</p>
                </div>
            </div>

            <BarChart title="Distribuição por Status" data={statsData.ticketsByStatus} colorClass="status-bar" />
            <BarChart title="Tickets por Agente" data={statsData.ticketsByAgent} colorClass="agent-bar" />
            <BarChart title="Tickets por Tipo" data={statsData.ticketsByType} colorClass="type-bar" />
        </div>
    );
}
