import React, { useState, useCallback, useEffect } from 'react';
import Calculator from './Calculator';
import LeaderboardMetrics from './LeaderboardMetrics';
import './styles.css';
import './calculatorStyles.css';
import './LeaderboardStyles.css';

const App = () => {
    const [search, setSearch] = useState('');
    const [symbol, setSymbol] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [stockData, setStockData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAllData, setShowAllData] = useState(false);
    const [activeMenu, setActiveMenu] = useState('search');
    const INITIAL_DISPLAY_COUNT = 10;

    // Filters state
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    const menuItems = [
        { 
            id: 'search', 
            label: 'Earnings Move', 
            sublabel: 'Price History Before & After Earnings'
        },
        { 
            id: 'leaderboard', 
            label: 'Leaderboard & Metrics',
            sublabel: 'Best & Worst Earnings Performers'
        },
        { 
            id: 'calculator', 
            label: 'Earnings Calculator',
            sublabel: 'Calculate Historical Returns'
        }
    ];

    const timeRangeOptions = [
        { value: 'all', label: 'All History' },
        { value: '1', label: '1 Year' },
        { value: '2', label: '2 Years' },
        { value: '3', label: '3 Years' },
        { value: '4', label: '4 Years' },
        { value: '5', label: '5 Years' }
    ];

    useEffect(() => {
        const loadDefaultData = async () => {
            try {
                setSymbol('AAPL');
                setSearch('AAPL');
                setLoading(true);
                setError(null);
                
                const response = await fetch('/api/stock/AAPL');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch data');
                }
                
                if (!data || data.length === 0) {
                    throw new Error('No data found for AAPL');
                }

                setStockData(data);
            } catch (error) {
                console.error('Error loading default AAPL data:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        loadDefaultData();
    }, []);

    const handleSearch = async (searchText) => {
        setSearch(searchText);
        if (searchText.length > 0) {
            try {
                const response = await fetch(`/api/search/companies?q=${encodeURIComponent(searchText)}`);
                const data = await response.json();
                setSuggestions(data);
            } catch (error) {
                console.error('Error searching companies:', error);
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
        }
    };

    const selectCompany = async (selectedSymbol) => {
        setSymbol(selectedSymbol);
        setSearch(selectedSymbol);
        setSuggestions([]);
        try {
            setLoading(true);
            setError(null);
            setStockData(null);
            
            const response = await fetch(`/api/stock/${selectedSymbol}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch data');
            }
            
            if (!data || data.length === 0) {
                throw new Error('No data found for this symbol');
            }

            setStockData(data);
        } catch (err) {
            console.error('Error fetching stock data:', err);
            setError(err.message);
            setStockData(null);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = useCallback((data) => {
        if (!data || !data.length) return null;
        
        let filteredData = [...data];
        
        if (selectedTimeRange !== 'all') {
            const yearsAgo = new Date();
            yearsAgo.setFullYear(yearsAgo.getFullYear() - parseInt(selectedTimeRange));
            filteredData = filteredData.filter(d => new Date(d.date) >= yearsAgo);
        }

        const validMoves = filteredData
            .filter(d => d.priceChange !== 'N/A')
            .map(d => parseFloat(d.priceChange));
        
        if (validMoves.length === 0) return null;
        
        const upMoves = validMoves.filter(change => change > 0);
        const downMoves = validMoves.filter(change => change < 0);

        const recentMoves = validMoves.slice(0, 10);
        const recentUpMoves = recentMoves.filter(change => change > 0);
        const recentAverage = recentMoves.reduce((a, b) => a + b, 0) / recentMoves.length;
        const recentWinRate = (recentUpMoves.length / recentMoves.length * 100).toFixed(1);

        let longestPositiveStreak = 0;
        let longestNegativeStreak = 0;
        let currentPositiveStreak = 0;
        let currentNegativeStreak = 0;

        validMoves.forEach(move => {
            if (move > 0) {
                currentPositiveStreak++;
                currentNegativeStreak = 0;
                if (currentPositiveStreak > longestPositiveStreak) {
                    longestPositiveStreak = currentPositiveStreak;
                }
            } else if (move < 0) {
                currentNegativeStreak++;
                currentPositiveStreak = 0;
                if (currentNegativeStreak > longestNegativeStreak) {
                    longestNegativeStreak = currentNegativeStreak;
                }
            }
        });
        
        return {
            totalMoves: validMoves.length,
            upMoves: upMoves.length,
            downMoves: downMoves.length,
            averageMove: validMoves.reduce((a, b) => a + b, 0) / validMoves.length,
            averageUpMove: upMoves.length ? upMoves.reduce((a, b) => a + b, 0) / upMoves.length : 0,
            averageDownMove: downMoves.length ? downMoves.reduce((a, b) => a + b, 0) / downMoves.length : 0,
            longestPositiveStreak,
            longestNegativeStreak,
            maxGain: Math.max(...validMoves),
            maxLoss: Math.min(...validMoves),
            winRate: (upMoves.length / validMoves.length * 100).toFixed(1),
            recentAverage: recentAverage,
            recentWinRate: recentWinRate,
            recentUpMoves: recentUpMoves.length,
            recentTotal: recentMoves.length
        };
    }, [selectedTimeRange]);

    const stats = stockData ? calculateStats(stockData) : null;
    const displayData = showAllData ? stockData : stockData?.slice(0, INITIAL_DISPLAY_COUNT);

    return (
        <div className="container">
            <h1>Earnings Report Card</h1>
            <h2 className="subtitle">Stock Prices 1 Day After Earnings</h2>
            <div className="menu-container">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        className={`menu-item ${activeMenu === item.id ? 'active' : ''}`}
                        onClick={() => setActiveMenu(item.id)}
                    >
                        <span className="menu-label">{item.label}</span>
                        {item.sublabel && <span className="menu-sublabel">{item.sublabel}</span>}
                    </button>
                ))}
            </div>

            {activeMenu === 'search' && (
                <>
                    <div className="search-section">
                        <div className="search-box-container">
                            <div className="search-container">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value.toUpperCase())}
                                    onFocus={() => setSearch('')}
                                    placeholder="Enter company name or symbol (e.g., Apple or AAPL)"
                                    className="search-input"
                                />
                                {suggestions.length > 0 && (
                                    <div className="suggestions-dropdown">
                                        {suggestions.map((company, index) => (
                                            <div
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => selectCompany(company.symbol)}
                                            >
                                                <span className="company-name">{company.name}</span>
                                                <span className="company-symbol">{company.symbol}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button 
                                type="button" 
                                className="filter-button"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                Filter
                            </button>
                        </div>

                        {showFilters && (
                            <div className="filters-container">
                                <div className="filter-group">
                                    <label>Time Range:</label>
                                    <div className="custom-select">
                                        <select 
                                            value={selectedTimeRange}
                                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                                        >
                                            {timeRangeOptions.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && <div className="error">{error}</div>}
                    {loading && <div className="loading">Loading data...</div>}
                    
                    {stockData && stats && (
                        <div className="results">
                            <div className="stats-grid">
                                <div className="stat-box earnings-summary">
                                    <div className="stat-row">
                                        <div className="stat-item positive">
                                            <h3>Moves Higher</h3>
                                            <p className="green">{stats.upMoves} Times ({stats.winRate}%)</p>
                                            <p className="avg-move">Avg: +{stats.averageUpMove.toFixed(2)}%</p>
                                            <p className="streak">Longest Streak: {stats.longestPositiveStreak}</p>
                                        </div>
                                        <div className="stat-item negative">
                                            <h3>Moves Lower</h3>
                                            <p className="red">{stats.downMoves} Times</p>
                                            <p className="avg-move">Avg: {stats.averageDownMove.toFixed(2)}%</p>
                                            <p className="streak">Longest Streak: {stats.longestNegativeStreak}</p>
                                        </div>
                                    </div>
                                    <div className="stat-row">
                                        <div className="stat-item recent" title="Statistics from the most recent 10 earnings reports">
                                            <h3>Last 10 Earnings</h3>
                                            <p className={stats.recentAverage >= 0 ? "green" : "red"}>
                                                {stats.recentAverage >= 0 ? '+' : ''}{stats.recentAverage.toFixed(2)}%
                                            </p>
                                            <p className="avg-move">{stats.recentUpMoves} Up, {stats.recentTotal - stats.recentUpMoves} Down</p>
                                            <p className="streak">Win Rate: {stats.recentWinRate}%</p>
                                        </div>
                                        <div className="stat-item">
                                            <h3>Best/Worst Move</h3>
                                            <p className="green">+{stats.maxGain.toFixed(2)}%</p>
                                            <p className="red">{stats.maxLoss.toFixed(2)}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="table-container">
                                <table className="earnings-table">
                                    <thead>
                                        <tr>
                                            <th className="table-header">Date</th>
                                            <th className="table-header close-before">Close Before</th>
                                            <th className="table-header">Close After</th>
                                            <th className="table-header">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayData?.map((earning, index) => (
                                            <tr key={index}>
                                                <td>{earning.date}</td>
                                                <td>${earning.closePriceDayBefore}</td>
                                                <td>${earning.closePriceOnDay}</td>
                                                <td className={`change-cell ${parseFloat(earning.priceChange) >= 0 ? 'positive-change' : 'negative-change'}`}>
                                                    {earning.priceChange > 0 ? '+' : ''}{earning.priceChange}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {stockData.length > INITIAL_DISPLAY_COUNT && (
                                <div className="show-more-container">
                                    <button 
                                        className="show-more-button"
                                        onClick={() => setShowAllData(!showAllData)}
                                    >
                                        {showAllData ? 'Show Less' : `Show ${stockData.length - INITIAL_DISPLAY_COUNT} More`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {activeMenu === 'leaderboard' && <LeaderboardMetrics />}

            {activeMenu === 'calculator' && <Calculator />}
        </div>
    );
};

export default App;