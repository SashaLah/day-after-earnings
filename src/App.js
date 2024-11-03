import React, { useState, useCallback } from 'react';

const App = () => {
  const [symbol, setSymbol] = useState('');
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllData, setShowAllData] = useState(false);
  const [showPreEarnings, setShowPreEarnings] = useState(false);
  const INITIAL_DISPLAY_COUNT = 10;

  const fetchStockData = async (e) => {
    e.preventDefault();
    if (!symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }
    
    setLoading(true);
    setError(null);
    setStockData(null);
    
    try {
      const earningsResponse = await fetch(`/api/stock/${symbol.toUpperCase()}`);
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
            `/api/prices/${symbol}?from=${priorDay.toISOString().split('T')[0]}&to=${nextDay.toISOString().split('T')[0]}`
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
    
    const validMoves = data
      .filter(d => d.earningsEffect !== 'N/A')
      .map(d => parseFloat(d.earningsEffect));
    
    if (validMoves.length === 0) return null;
    
    const upMoves = validMoves.filter(change => change > 0);
    const downMoves = validMoves.filter(change => change < 0);

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

    const averageMove = validMoves.reduce((a, b) => a + b, 0) / validMoves.length;
    const variance = validMoves.reduce((a, b) => a + Math.pow(b - averageMove, 2), 0) / validMoves.length;
    const volatility = Math.sqrt(variance);
    
    return {
      totalMoves: validMoves.length,
      upMoves: upMoves.length,
      downMoves: downMoves.length,
      averageMove: validMoves.reduce((a, b) => a + b, 0) / validMoves.length,
      averageUpMove: upMoves.length ? upMoves.reduce((a, b) => a + b, 0) / upMoves.length : 0,
      averageDownMove: downMoves.length ? downMoves.reduce((a, b) => a + b, 0) / downMoves.length : 0,
      longestPositiveStreak,
      longestNegativeStreak,
      volatility,
      maxGain: Math.max(...validMoves),
      maxLoss: Math.min(...validMoves),
      winRate: (upMoves.length / validMoves.length * 100).toFixed(1)
    };
  }, []);

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
      <h2 className="subtitle">Historical Earnings Price Movements</h2>
      
      <form onSubmit={fetchStockData} className="search-form">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Enter stock symbol (e.g., AAPL)"
          required
          className="search-input"
        />
        <button type="submit" disabled={loading} className="search-button">
          {loading ? 'Loading...' : 'Analyze'}
        </button>
      </form>

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
                <div className="stat-item">
                  <h3>Volatility</h3>
                  <p>{stats.volatility.toFixed(2)}%</p>
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
                  <th>Earnings Date</th>
                  <th>Pre-Earnings Close</th>
                  {showPreEarnings && (
                    <>
                      <th>Pre-Earnings Open</th>
                      <th className="pre-earnings-change">Day Change</th>
                    </>
                  )}
                  <th>Post-Earnings Open</th>
                  <th className="effect-header">
                    <div className="effect-header-container">
                      <span>Earnings Effect</span>
                      <button 
                        className="expand-button"
                        onClick={() => setShowPreEarnings(!showPreEarnings)}
                        title={showPreEarnings ? "Hide details" : "Show details"}
                      >
                        {showPreEarnings ? '−' : '+'}
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((earning, index) => (
                  <tr key={index}>
                    <td data-label="Earnings Date">{earning.date}</td>
                    <td data-label="Pre-Earnings Close">${earning.preEarningsClose}</td>
                    {showPreEarnings && (
                      <>
                        <td data-label="Pre-Earnings Open">${earning.preEarningsOpen}</td>
                        <td 
                          data-label="Day Change" 
                          className={parseFloat(earning.preEarningsChange) >= 0 ? 'green' : 'red'}
                        >
                          {earning.preEarningsChange !== 'N/A' && (earning.preEarningsChange > 0 ? '+' : '')}
                          {earning.preEarningsChange}%
                        </td>
                      </>
                    )}
                    <td data-label="Post-Earnings Open">${earning.postEarningsOpen}</td>
                    <td data-label="Earnings Effect" className="effect-cell">
                      {renderEarningsEffect(earning.earningsEffect)}
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
    </div>
  );
};

export default App;