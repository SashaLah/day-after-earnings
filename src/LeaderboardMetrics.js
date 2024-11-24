import React, { useState, useEffect } from 'react';
import './leaderboardStyles.css';

const LeaderboardMetrics = () => {
    const [metricsData, setMetricsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState('recoveryRate');
    const [sortDirection, setSortDirection] = useState('desc');

    useEffect(() => {
        const fetchMetricsData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/metrics/leaderboard');
                if (!response.ok) {
                    throw new Error('Failed to fetch metrics data');
                }
                const data = await response.json();
                setMetricsData(data);
            } catch (error) {
                console.error('Error fetching metrics data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMetricsData();
    }, []);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const formatNumber = (value, decimals = 1) => {
        if (value === null || value === undefined) return 'N/A';
        return Number(value).toFixed(decimals);
    };

    const sortedData = metricsData ? [...metricsData].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        return direction * (aValue - bValue);
    }) : [];

    return (
        <div className="metrics-container">
            <div className="metrics-header">
                <h2>Stock Recovery Metrics</h2>
                <p className="metrics-description">
                    Analysis of how stocks recover after earnings drops
                </p>
            </div>

            {loading ? (
                <div className="metrics-loading">Calculating recovery metrics...</div>
            ) : (
                <div className="metrics-table-container">
                    <table className="metrics-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('symbol')}>
                                    Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th>Company</th>
                                <th onClick={() => handleSort('recoveryRate')} title="Percentage of earnings drops that eventually recover">
                                    Recovery Rate {sortColumn === 'recoveryRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('avgRecoveryPeriods')} title="Average number of earnings periods needed to recover">
                                    Avg Recovery Periods {sortColumn === 'avgRecoveryPeriods' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('fastestRecovery')} title="Fastest recovery in earnings periods">
                                    Fastest Recovery {sortColumn === 'fastestRecovery' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('worstRecovery')} title="Longest recovery in earnings periods">
                                    Worst Recovery {sortColumn === 'worstRecovery' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('consistencyScore')} title="Score based on consistency of earnings reactions">
                                    Consistency Score {sortColumn === 'consistencyScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th title="Number of drops analyzed vs successful recoveries">
                                    Recovery Stats
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((stock) => (
                                <tr key={stock.symbol}>
                                    <td>{stock.symbol}</td>
                                    <td>{stock.name}</td>
                                    <td className={stock.recoveryRate >= 70 ? 'positive' : stock.recoveryRate <= 30 ? 'negative' : ''}>
                                        {formatNumber(stock.recoveryRate)}%
                                    </td>
                                    <td className={stock.avgRecoveryPeriods <= 2 ? 'positive' : stock.avgRecoveryPeriods >= 6 ? 'negative' : ''}>
                                        {formatNumber(stock.avgRecoveryPeriods)}
                                    </td>
                                    <td className="positive">
                                        {stock.fastestRecovery === null ? 'N/A' : `${stock.fastestRecovery}`}
                                    </td>
                                    <td className="negative">
                                        {stock.worstRecovery === null ? 'N/A' : `${stock.worstRecovery}`}
                                    </td>
                                    <td className={stock.consistencyScore >= 7 ? 'positive' : stock.consistencyScore <= 3 ? 'negative' : ''}>
                                        {formatNumber(stock.consistencyScore, 1)}
                                    </td>
                                    <td>
                                        {stock.successfulRecoveries} / {stock.dropsAnalyzed}
                                        <div className="small-text">
                                            of {stock.totalEarnings} total
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LeaderboardMetrics;