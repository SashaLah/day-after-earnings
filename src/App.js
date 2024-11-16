import React, { useState, useCallback, useEffect } from 'react';
import './styles.css';
import './calculatorStyles.css';

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

    // New state for Earnings Calculator
    const [investmentAmount, setInvestmentAmount] = useState(10000);
    const [earningsCount, setEarningsCount] = useState(10);
    const [calculatorResults, setCalculatorResults] = useState(null);
    const [calculatorLoading, setCalculatorLoading] = useState(false);
    const [sortColumn, setSortColumn] = useState('tradeReturn');
    const [sortDirection, setSortDirection] = useState('desc');

    const menuItems = [
        { 
            id: 'search', 
            label: 'Search Earnings', 
            sublabel: 'Price Movement After Earnings'
        },
        { 
            id: 'events', 
            label: 'Search by Events',
            sublabel: 'eg Price of Apple since Vision Pro release'
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

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Handle investment amount changes
    const handleInvestmentChange = (value) => {
        const numValue = parseInt(value.replace(/[^0-9]/g, ''));
        if (!isNaN(numValue) && numValue <= 10000000) {
            setInvestmentAmount(numValue);
        }
    };

    const incrementInvestment = () => {
        if (investmentAmount < 10000000) {
            setInvestmentAmount(prev => Math.min(prev + 1000, 10000000));
        }
    };

    const decrementInvestment = () => {
        if (investmentAmount > 1000) {
            setInvestmentAmount(prev => prev - 1000);
        }
    };

    // Fetch calculator results
    const fetchCalculatorResults = useCallback(async () => {
        try {
            setCalculatorLoading(true);
            const response = await fetch(`/api/calculator?amount=${investmentAmount}&earnings=${earningsCount}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch calculator data');
            }
            
            setCalculatorResults(data);
        } catch (error) {
            console.error('Error fetching calculator data:', error);
        } finally {
            setCalculatorLoading(false);
        }
    }, [investmentAmount, earningsCount]);

    // Fetch results when calculator inputs change
    useEffect(() => {
        if (activeMenu === 'calculator') {
            fetchCalculatorResults();
        }
    }, [investmentAmount, earningsCount, activeMenu, fetchCalculatorResults]);

    // Sorting function for calculator results
    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const sortedResults = calculatorResults ? [...calculatorResults].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        switch (sortColumn) {
            case 'symbol':
                return direction * a.symbol.localeCompare(b.symbol);
            case 'tradeReturn':
                return direction * (a.tradeReturn - b.tradeReturn);
            case 'tradeReturnPercent':
                return direction * (a.tradeReturnPercent - b.tradeReturnPercent);
            case 'holdValue':
                return direction * (a.holdValue - b.holdValue);
            case 'holdReturn':
                return direction * (a.holdReturn - b.holdReturn);
            case 'avgReturn':
                return direction * (a.avgReturn - b.avgReturn);
            default:
                return 0;
        }
    }) : [];

    // Your existing loading functionality for AAPL
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
        if (searchText.length > 1) {
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
            <h1>Earnings Stock Movement History</h1>
            
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
                    )}

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
                                            <th className="table-header" title="The date of earnings announcement">
                                                Date
                                            </th>
                                            <th className="table-header" title="The closing price before earnings impact">
                                                Close Before
                                            </th>
                                            <th className="table-header" title="The closing price after earnings impact">
                                                Close After
                                            </th>
                                            <th className="table-header" title="Percentage price change">
                                                Change
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayData?.map((earning, index) => (
                                            <tr key={index}>
                                                <td>{earning.date}</td>
                                                <td>${earning.closePriceDayBefore}</td>
                                                <td>${earning.closePriceOnDay}</td>
                                                <td className={parseFloat(earning.priceChange) >= 0 ? 'positive-effect' : 'negative-effect'}>
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

            {activeMenu === 'events' && (
                <div className="events-container">
                    {/* Placeholder for events feature */}
                    <p>Events feature coming soon...</p>
                </div>
            )}

            {activeMenu === 'calculator' && (
                <div className="calculator-container">
                    <div className="calculator-controls">
                        <div className="investment-input">
                            <label>Investment Amount:</label>
                            <div className="input-group">
                                <button 
                                    onClick={decrementInvestment}
                                    className="amount-button"
                                    disabled={investmentAmount <= 1000}
                                >
                                    -
                                </button>
                                <input
                                    type="text"
                                    value={formatCurrency(investmentAmount)}
                                    onChange={(e) => handleInvestmentChange(e.target.value)}
                                    className="amount-input"
                                />
                                <button 
                                    onClick={incrementInvestment}
                                    className="amount-button"
                                    disabled={investmentAmount >= 10000000}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="earnings-slider">
                            <label>Last {earningsCount} Earnings</label>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={earningsCount}
                                onChange={(e) => setEarningsCount(parseInt(e.target.value))}
                                className="slider"
                            />
                        </div>
                    </div>

                    {calculatorLoading ? (
                        <div className="loading">Calculating returns...</div>
                    ) : (
                        <div className="results-table-container">
                            <table className="calculator-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('symbol')}>
                                            Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th>Company</th>
                                        <th onClick={() => handleSort('tradeReturn')}>
                                            Trade Return ($) {sortColumn === 'tradeReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('tradeReturnPercent')}>
                                            Trade Return (%) {sortColumn === 'tradeReturnPercent' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('holdValue')}>
                                            Buy & Hold Value ($) {sortColumn === 'holdValue' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('holdReturn')}>
                                            Buy & Hold Return (%) {sortColumn === 'holdReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('avgReturn')}>
                                            Avg Return/Earnings (%) {sortColumn === 'avgReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedResults.map((result, index) => (
                                        <tr key={result.symbol}>
                                            <td>{result.symbol}</td>
                                            <td>{result.name}</td>
                                            <td className={result.tradeReturn >= 0 ? 'positive' : 'negative'}>
                                                {formatCurrency(result.tradeReturn)}
                                            </td>
                                            <td className={result.tradeReturnPercent >= 0 ? 'positive' : 'negative'}>
                                                {result.tradeReturnPercent > 0 ? '+' : ''}{result.tradeReturnPercent.toFixed(2)}%
                                            </td>
                                            <td className={result.holdValue >= investmentAmount ? 'positive' : 'negative'}>
                                                {formatCurrency(result.holdValue)}
                                            </td>
                                            <td className={result.holdReturn >= 0 ? 'positive' : 'negative'}>
                                                {result.holdReturn > 0 ? '+' : ''}{result.holdReturn.toFixed(2)}%
                                            </td>
                                            <td className={result.avgReturn >= 0 ? 'positive' : 'negative'}>
                                                {result.avgReturn > 0 ? '+' : ''}{result.avgReturn.toFixed(2)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default App;