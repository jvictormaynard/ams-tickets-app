"use client";

import React from 'react';
import { TicketForFrontend } from '../types';

interface TicketTableProps {
    tickets: TicketForFrontend[];
    onTicketClick: (ticket: TicketForFrontend) => void;
    formatLastActivity: (timestamp: number) => string;
}

const TicketTable: React.FC<TicketTableProps> = ({ tickets, onTicketClick, formatLastActivity }) => {
    return (
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
                {tickets.map(ticket => (
                    <tr key={ticket.id} className="ticket-row" onClick={() => onTicketClick(ticket)}>
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
    );
};

export default TicketTable;
