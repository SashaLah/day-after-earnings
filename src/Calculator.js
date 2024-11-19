import React, { useState, useCallback, useEffect } from 'react';

const Calculator = () => {
    const [investmentAmount, setInvestmentAmount] = useState(10000);
    const [earningsRange, setEarningsRange] = useState([0, 10]); // [start, end]
    const [debouncedRange, setDebouncedRange] = useState(earningsRange);
    const [calculatorResults, setCalculatorResults] = useState(null);
    const [calculatorLoading, setCalculatorLoading] = useState(false);
    const [sortColumn, setSortColumn] = useState('tradeReturn');
    const [sortDirection, setSortDirection] = useState('desc');
    const [availableCompanies, setAvailableCompanies] = useState(null);
    const MAX_EARNINGS = 100;

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Fetch available earnings data for companies when component mounts
    useEffect(() => {
        const fetchAvailableEarnings = async () => {
            try {
                const response = await fetch('/api/available-earnings');
                const data = await response.json();
                setAvailableCompanies(data);
            } catch (error) {
                console.error('Error fetching available earnings:', error);
            }
        };

        fetchAvailableEarnings();
    }, []);

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

    // Debounce the range changes
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedRange(earningsRange);
        }, 500);

        return () => clearTimeout(timer);
    }, [earningsRange]);

    // Get available companies info
    const getAvailableCompaniesInfo = () => {
        if (!availableCompanies) return null;

        const minEarningsNeeded = earningsRange[1];
        const availableCount = Object.entries(availableCompanies).filter(
            ([_, count]) => count >= minEarningsNeeded
        ).length;

        return `${availableCount} companies have sufficient history for this range`;
    };

    // Calculate percentage position for timeline visual
    const getTimelinePosition = (value) => {
        // Adjust calculation to account for thumb width
        const percentage = (value / MAX_EARNINGS) * 100;
        const thumbOffset = 10; // Half the thumb width in pixels
        const trackWidth = document.querySelector('.timeline-track')?.offsetWidth || 0;
        const offsetPercentage = (thumbOffset / trackWidth) * 100;

        return percentage + (value === 0 ? offsetPercentage : -offsetPercentage);
    };

    // Fetch calculator results
    const fetchCalculatorResults = useCallback(async () => {
        try {
            setCalculatorLoading(true);
            const count = debouncedRange[1] - debouncedRange[0];
            const startIndex = debouncedRange[0];
            const endIndex = debouncedRange[1];

            const response = await fetch(
                `/api/calculator?amount=${investmentAmount}&earnings=${count}&start=${startIndex}&end=${endIndex}`
            );
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch data');
            }
            
            setCalculatorResults(data);
        } catch (error) {
            console.error('Error fetching calculator data:', error);
        } finally {
            setCalculatorLoading(false);
        }
    }, [investmentAmount, debouncedRange]);

    // Fetch results when calculator inputs change
    useEffect(() => {
        fetchCalculatorResults();
    }, [investmentAmount, debouncedRange, fetchCalculatorResults]);

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

    return (
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

                <div className="timeline-container">
                    <label>Select Earnings Range:</label>
                    <div className="timeline-slider">
                        <div className="timeline-track">
                            <div 
                                className="timeline-fill"
                                style={{
                                    left: `${getTimelinePosition(earningsRange[0])}%`,
                                    width: `${getTimelinePosition(earningsRange[1] - earningsRange[0])}%`
                                }}
                            />
                        </div>
                        <input
                            type="range"
                            id="startRange"
                            min="0"
                            max={MAX_EARNINGS}
                            value={earningsRange[0]}
                            onChange={handleRangeChange}
                            className="timeline-input start"
                        />
                        <input
                            type="range"
                            id="endRange"
                            min="0"
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
                        <small>({earningsRange[1] - earningsRange[0]} earnings total)</small>
                        {availableCompanies && (
                            <small className="available-companies">
                                {getAvailableCompaniesInfo()}
                            </small>
                        )}
                    </div>
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
                            {sortedResults.map((result) => (
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
    );
};

export default Calculator;