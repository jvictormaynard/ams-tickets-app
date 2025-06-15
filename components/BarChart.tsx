"use client";

import React from 'react';

interface BarChartProps {
    title: string;
    data: { [key: string]: number };
    colorClass: string;
}

const BarChart: React.FC<BarChartProps> = ({ title, data, colorClass }) => {
    const maxCount = Math.max(...Object.values(data));

    return (
        <div className="stats-section chart-section">
            <h2>{title}</h2>
            <div className="bar-chart-container">
                {Object.entries(data)
                    .sort(([, countA], [, countB]) => countB - countA)
                    .map(([label, count]) => (
                        <div key={label} className="bar-item">
                            <div className="bar-label">{label}</div>
                            <div className="bar-wrapper">
                                <div 
                                    className={`bar ${colorClass}`} 
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                ></div>
                                <span className="bar-value">{count}</span>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default BarChart;
