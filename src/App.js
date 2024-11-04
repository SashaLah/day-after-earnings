import React, { useState, useCallback, useEffect } from 'react';

const App = () => {
  const [search, setSearch] = useState('');
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllData, setShowAllData] = useState(false);
  const INITIAL_DISPLAY_COUNT = 10;
  
  // New state for filters
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedMovementType, setSelectedMovementType] = useState('after');
  const [showFilters, setShowFilters] = useState(false);

  // Time range options
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

  // Movement type options
  const movementTypeOptions = [
    { value: 'after', label: 'Movement After Earnings' },
    { value: 'during', label: 'Movement During Day of Earnings' }
  ];

  // Load AAPL data by default
  useEffect(() => {
    const loadDefaultData = async () => {
      setSymbol('AAPL');
      setSearch('AAPL');
      const event = { preventDefault: () => {} };
      await fetchStockData(event);
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

  const selectCompany = (selectedSymbol) => {
    setSymbol(selectedSymbol);
    setSearch(selectedSymbol);
    setSuggestions([]);
  };

  const handleSearchFocus = () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.select();
    }
  };

  const fetchStockData = async (e) => {
    e.preventDefault();
    if (!symbol && !search.trim()) {
      setError('Please enter a company name or stock symbol');
      return;
    }

    const searchSymbol = symbol || search.toUpperCase();
    setLoading(true);
    setError(null);
    setStockData(null);
    
    try {
      const earningsResponse = await fetch(`/api/stock/${searchSymbol}`);
      const earningsData = await earningsResponse.json();
      
      if (!earningsResponse.ok) throw new Error(earningsData.error || 'Failed to fetch data');
      if (!earningsData || earningsData.length === 0) throw new Error('No data found for this symbol');

      const processedData = await Promise.all(
        earningsData.map(async (earning) => {
          const earningsDate = new Date(earning.date);
          const priorDay = new Date(earningsDate);
          const nextDay = new Date(earningsDate);
          priorDay.setDate(earningsDate.getDate());
          nextDay.setDate(earningsDate.getDate() + 1);

          const priceResponse = await fetch(
            `/api/prices/${searchSymbol}?from=${priorDay.toISOString().split('T')[0]}&to=${nextDay.toISOString().split('T')[0]}`
          );
          
          if (!priceResponse.ok) {
            throw new Error('Failed to fetch price data');
          }
          
          const priceData = await priceResponse.json();

          const nextDayPrices = priceData[0] || {};
          const earningsDayPrices = priceData[1] || {};

          const preEarningsChange = earningsDayPrices.open && earningsDayPrices.close
            ? ((earningsDayPrices.close - earningsDayPrices.open) / earningsDayPrices.open) * 100
            : null;

          const earningsEffect = earningsDayPrices.close && nextDayPrices.open
            ? ((nextDayPrices.open - earningsDayPrices.close) / earningsDayPrices.close) * 100
            : null;

          return {
            date: earning.date,
            preEarningsOpen: earningsDayPrices.open?.toFixed(2) || 'N/A',
            preEarningsClose: earningsDayPrices.close?.toFixed(2) || 'N/A',
            postEarningsOpen: nextDayPrices.open?.toFixed(2) || 'N/A',
            preEarningsChange: preEarningsChange?.toFixed(2) || 'N/A',
            earningsEffect: earningsEffect?.toFixed(2) || 'N/A'
          };
        })
      );

      setStockData(processedData);
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

  const stats = stockData ? calculateStats(stockData) : null;
  const displayData = showAllData ? stockData : stockData?.slice(0, INITIAL_DISPLAY_COUNT);

  return (
    <div className="container">
      <h1>Earnings Stock Movement History</h1>
      {symbol && <h2 className="subtitle">Viewing {symbol}</h2>}
      
      <form onSubmit={fetchStockData} className="search-form">
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
        <div className="button-group">
          <button type="submit" disabled={loading} className="search-button">
            {loading ? 'Loading...' : 'Search'}
          </button>
          <button 
            type="button" 
            className="filter-button"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
          </button>
        </div>
      </form>

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
                {displayData.map((earning, index) => (
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
    </div>
  );
};

export default App;