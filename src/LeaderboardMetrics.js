import React, { useState, useEffect } from 'react';
import './LeaderboardStyles.css';

const LeaderboardMetrics = () => {
    const [metricsData, setMetricsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState('recoveryRate');
    const [sortDirection, setSortDirection] = useState('desc');
    const [earningsRange, setEarningsRange] = useState([1, 10]);
    const [debouncedRange, setDebouncedRange] = useState(earningsRange);
    const MAX_EARNINGS = 100;

    // Add debounced effect for range changes
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedRange(earningsRange);
        }, 500);

        return () => clearTimeout(timer);
    }, [earningsRange]);

    // Update fetch to use debouncedRange instead of earningsRange
    useEffect(() => {
        const fetchMetricsData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/metrics/leaderboard?start=${debouncedRange[0]}&end=${debouncedRange[1]}`);
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
    }, [debouncedRange]); // Changed dependency to debouncedRange

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const handleRangeChange = (e) => {
        const value = parseInt(e.target.value);
        const isEndSlider = e.target.id === 'endRange';
        
        setEarningsRange(prev => {
            const newRange = [...prev];
            if (isEndSlider) {
                newRange[1] = Math.max(value, newRange[0]);
            } else {
                newRange[0] = Math.min(value, newRange[1]);
            }
            return newRange;
        });
    };

    const getTimelinePosition = (value) => {
        return ((value - 1) / (MAX_EARNINGS - 1)) * 100;
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
                <h2>Stock Earnings Performance</h2>
                <p className="metrics-description">
                    Compare how stocks perform after earnings announcements
                </p>
            </div>

            <div className="calculator-controls">
                <div className="timeline-container">
                    <label>Select Earnings Range:</label>
                    <div className="timeline-slider">
                        <div className="timeline-track">
                            <div 
                                className="timeline-fill"
                                style={{
                                    left: `${getTimelinePosition(earningsRange[0])}%`,
                                    right: `${100 - getTimelinePosition(earningsRange[1])}%`
                                }}
                            />
                        </div>
                        <input
                            type="range"
                            id="startRange"
                            min="1"
                            max={MAX_EARNINGS}
                            value={earningsRange[0]}
                            onChange={handleRangeChange}
                            className="timeline-input start"
                        />
                        <input
                            type="range"
                            id="endRange"
                            min="1"
                            max={MAX_EARNINGS}
                            value={earningsRange[1]}
                            onChange={handleRangeChange}
                            className="timeline-input end"
                        />
                    </div>
                    <div className="timeline-labels">
                        <div className="timeline-label">Most Recent</div>
                        <div className="timeline-label">Oldest</div>
                    </div>
                    <div className="timeline-info">
                        Analyzing earnings {earningsRange[0]} to {earningsRange[1]} 
                        <br />
                        <small>({earningsRange[1] - earningsRange[0] + 1} earnings total)</small>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="metrics-loading">Calculating performance metrics...</div>
            ) : (
                <div className="metrics-table-container">
                    <table className="metrics-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('symbol')}>
                                    Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th>Company</th>
                                <th onClick={() => handleSort('winRate')} title="Percentage of positive moves after earnings">
                                    Win Rate {sortColumn === 'winRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('avgMove')} title="Average move after earnings">
                                    Avg Move {sortColumn === 'avgMove' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('bestMove')} title="Best performance after earnings">
                                    Best Move {sortColumn === 'bestMove' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('worstMove')} title="Worst performance after earnings">
                                    Worst Move {sortColumn === 'worstMove' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('lastQuarterMove')} title="Most recent earnings move">
                                    Last Quarter {sortColumn === 'lastQuarterMove' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th title="Up/Down moves after earnings">
                                    Record
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((stock) => (
                                <tr key={stock.symbol}>
                                    <td>{stock.symbol}</td>
                                    <td>{stock.name}</td>
                                    <td className={stock.winRate >= 60 ? 'positive' : stock.winRate <= 40 ? 'negative' : ''}>
                                        {formatNumber(stock.winRate)}%
                                    </td>
                                    <td className={stock.avgMove >= 0 ? 'positive' : 'negative'}>
                                        {stock.avgMove >= 0 ? '+' : ''}{formatNumber(stock.avgMove)}%
                                    </td>
                                    <td className="positive">
                                        +{formatNumber(stock.bestMove)}%
                                    </td>
                                    <td className="negative">
                                        {formatNumber(stock.worstMove)}%
                                    </td>
                                    <td className={stock.lastQuarterMove >= 0 ? 'positive' : 'negative'}>
                                        {stock.lastQuarterMove >= 0 ? '+' : ''}{formatNumber(stock.lastQuarterMove)}%
                                    </td>
                                    <td>
                                        {stock.upMoveCount}/{stock.downMoveCount}
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