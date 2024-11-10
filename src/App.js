import React, { useState, useCallback, useEffect } from 'react';

const App = () => {
  // Original state variables
  const [search, setSearch] = useState('');
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllData, setShowAllData] = useState(false);
  const [nextEarningsInfo, setNextEarningsInfo] = useState(null);
  
  // Event search state
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState(null);
  const [activeMenu, setActiveMenu] = useState('search');
  
  // Filters state
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedMovementType, setSelectedMovementType] = useState('after');
  const [showFilters, setShowFilters] = useState(false);

  const INITIAL_DISPLAY_COUNT = 10;

  const timeRangeOptions = [
    { value: 'all', label: 'All History' },
    { value: '1', label: '1 Year' },
    { value: '2', label: '2 Years' },
    { value: '3', label: '3 Years' },
    { value: '4', label: '4 Years' },
    { value: '5', label: '5 Years' },
    { value: '6', label: '6 Years' },
    { value: '7', label: '7 Years' },
    { value: '8', label: '8 Years' },
    { value: '9', label: '9 Years' },
    { value: '10', label: '10 Years' }
  ];

  const movementTypeOptions = [
    { value: 'after', label: 'Movement After Earnings Report' },
    { value: 'during', label: 'Movement 1 Day Prior to Announcement' }
  ];
  // Load AAPL data by default
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

        const formattedData = data.map(item => ({
          ...item,
          date: new Date(item.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        }));

        setStockData(formattedData);
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

  const handleEventSearch = async (searchText) => {
    if (searchText.length < 3) {
      setEventError('Please enter at least 3 characters');
      return;
    }
    
    setEventLoading(true);
    setEventError(null);
    setEventResults(null);  // Clear previous results
    
    try {
      const response = await fetch(`/api/events/analyze?query=${encodeURIComponent(searchText)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze event');
      }
      
      setEventResults(data);
    } catch (error) {
      console.error('Event search error:', error);
      setEventError(error.message);
    } finally {
      setEventLoading(false);
    }
  };

  const selectCompany = async (selectedSymbol) => {
    setSymbol(selectedSymbol);
    setSearch(selectedSymbol);
    setSuggestions([]);
    // Automatically fetch data when company is selected
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

      const formattedData = data.map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }));

      setStockData(formattedData);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError(err.message);
      setStockData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFocus = () => {
    setSearch('');
  };
  const calculateStats = useCallback((data) => {
    if (!data || !data.length) return null;
    
    let filteredData = [...data];
    
    // Apply time range filter
    if (selectedTimeRange !== 'all') {
      const yearsAgo = new Date();
      yearsAgo.setFullYear(yearsAgo.getFullYear() - parseInt(selectedTimeRange));
      filteredData = filteredData.filter(d => new Date(d.date) >= yearsAgo);
    }

    const validMoves = filteredData
      .filter(d => selectedMovementType === 'after' ? d.earningsEffect !== 'N/A' : d.preEarningsChange !== 'N/A')
      .map(d => selectedMovementType === 'after' ? parseFloat(d.earningsEffect) : parseFloat(d.preEarningsChange));
    
    if (validMoves.length === 0) return null;
    
    const upMoves = validMoves.filter(change => change > 0);
    const downMoves = validMoves.filter(change => change < 0);

    // Calculate recent earnings stats (last 10)
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
  }, [selectedTimeRange, selectedMovementType]);

  const renderEarningsEffect = (effect) => {
    if (effect === 'N/A') return <span className="neutral-effect">−</span>;
    const value = parseFloat(effect);
    const effectClassName = value >= 0 ? 'positive-effect' : 'negative-effect';
    
    return (
      <div className="effect-container">
        <span className={effectClassName}>
          {value > 0 ? '+' : ''}{effect}%
          <span className="arrow-icon">
            {value > 0 ? '▲' : '▼'}
          </span>
        </span>
      </div>
    );
  };

  const renderEventSearch = () => {
    const handleSubmit = (e) => {
      e.preventDefault();
      if (eventSearch.length > 0) {
        handleEventSearch(eventSearch);
      }
    };

    return (
      <div className="event-search-section">
        <form onSubmit={handleSubmit} className="search-section">
          <div className="search-container">
            <input
              type="text"
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              placeholder="Try 'since iPhone release' or 'since Vision Pro announcement'"
              className="search-input"
            />
          </div>
          <button type="submit" className="search-button">
            Search
          </button>
        </form>

        {eventLoading && <div className="loading">Analyzing market data...</div>}
        {eventError && <div className="error">{eventError}</div>}

        {eventResults && eventResults.event && (
          <div className="results">
            <div className="event-header">
              <h3>{eventResults.event.name || 'Event Analysis'}</h3>
              <p>{eventResults.event.description || ''}</p>
              <p>Date: {new Date(eventResults.event.date).toLocaleDateString()}</p>
            </div>

            {eventResults.market && (
              <div className="stats-grid">
                <div className="stat-box earnings-summary">
                  <div className="stat-row">
                    <div className="stat-item">
                      <h3>Market Impact (S&P 500)</h3>
                      <p className={eventResults.market.percentChange >= 0 ? "green" : "red"}>
                        {eventResults.market.percentChange >= 0 ? '+' : ''}{eventResults.market.percentChange}%
                      </p>
                      <p className="price-change">
                        ${eventResults.market.startPrice.toFixed(2)} → ${eventResults.market.currentPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {eventResults.comparisons && eventResults.comparisons.length > 0 && (
              <div className="table-container">
                <table className="earnings-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Start Price</th>
                      <th>Current Price</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventResults.comparisons.map((stock, index) => (
                      <tr key={index}>
                        <td>{stock.symbol}</td>
                        <td>${stock.startPrice.toFixed(2)}</td>
                        <td>${stock.currentPrice.toFixed(2)}</td>
                        <td className={stock.percentChange >= 0 ? 'positive-effect' : 'negative-effect'}>
                          {stock.percentChange >= 0 ? '+' : ''}{stock.percentChange}%
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

  const renderEarningsSearch = () => {
    const stats = stockData ? calculateStats(stockData) : null;
    const displayData = showAllData ? stockData : stockData?.slice(0, INITIAL_DISPLAY_COUNT);

    return (
      <>
        <div className="search-section">
          <div className="search-container">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value.toUpperCase())}
              onFocus={handleSearchFocus}
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
              <label>Movement Type:</label>
              <select 
                value={selectedMovementType}
                onChange={(e) => setSelectedMovementType(e.target.value)}
              >
                {movementTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
                    <th className="table-header" title="The date when earnings were reported">
                      Date
                    </th>
                    {selectedMovementType === 'during' ? (
                      <>
                        <th className="table-header" title="The opening price of the stock on the day of earnings">
                          Pre Open
                        </th>
                        <th className="table-header" title="The closing price of the stock on the day of earnings">
                          Pre Close
                        </th>
                        <th className="table-header" title="The price change during earnings day trading">
                          Day Change
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="table-header" title="The closing price of the stock on the day of earnings">
                          Pre Close
                        </th>
                        <th className="table-header" title="The opening price of the stock on the day after earnings">
                          Post Open
                        </th>
                        <th className="table-header" title="Percentage change from earnings day close to next day open">
                          Effect
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayData?.map((earning, index) => (
                    <tr key={index}>
                      <td>{earning.date}</td>
                      {selectedMovementType === 'during' ? (
                        <>
                          <td>${earning.preEarningsOpen}</td>
                          <td>${earning.preEarningsClose}</td>
                          <td className={parseFloat(earning.preEarningsChange) >= 0 ? 'green' : 'red'}>
                            {earning.preEarningsChange !== 'N/A' && (earning.preEarningsChange > 0 ? '+' : '')}
                            {earning.preEarningsChange}%
                          </td>
                        </>
                      ) : (
                        <>
                          <td>${earning.preEarningsClose}</td>
                          <td>${earning.postEarningsOpen}</td>
                          <td className="effect-cell">
                            {renderEarningsEffect(earning.earningsEffect)}
                          </td>
                        </>
                      )}
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
    );
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'events':
        return renderEventSearch();
      default:
        return renderEarningsSearch();
    }
  };

  return (
    <div className="container">
      <h1>Earnings Stock Movement History</h1>
      
      <div className="menu-container">
        <button
          className={`menu-item ${activeMenu !== 'events' ? 'active' : ''}`}
          onClick={() => setActiveMenu('search')}
        >
          <span className="menu-label">Search Earnings</span>
          <span className="menu-sublabel">Price Movement After Earnings</span>
        </button>
        <button
          className={`menu-item ${activeMenu === 'events' ? 'active' : ''}`}
          onClick={() => {
            setActiveMenu('events');
            setEventSearch('');
            setEventResults(null);
          }}
        >
          <span className="menu-label">Search by Events</span>
          <span className="menu-sublabel">eg Price of Apple since Vision Pro release</span>
        </button>
        <button className="menu-item">
          <span className="menu-label">Trends & Records</span>
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default App;