import React, { useState, useCallback, useEffect, useRef } from 'react';

const Calculator = () => {
    const [investmentAmount, setInvestmentAmount] = useState(10000);
    const [earningsRange, setEarningsRange] = useState([1, 10]);
    const [debouncedRange, setDebouncedRange] = useState(earningsRange);
    const [calculatorResults, setCalculatorResults] = useState(null);
    const [calculatorLoading, setCalculatorLoading] = useState(false);
    const [sortColumn, setSortColumn] = useState('tradeReturn');
    const [sortDirection, setSortDirection] = useState('desc');
    const [availableCompanies, setAvailableCompanies] = useState(null);
    const MAX_EARNINGS = 100;

    const buttonPressTimer = useRef(null);
    const buttonPressInterval = useRef(null);
    const speedMultiplier = useRef(1);
    const [debouncedInvestment, setDebouncedInvestment] = useState(investmentAmount);

    const formatNumber = (value, isPercent = false) => {
        if (value === null || value === undefined) return 'N/A';
        
        const num = Number(value);
        const isNegative = num < 0;
        const absoluteNum = Math.abs(num);
        
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });

        const formatted = formatter.format(Math.round(absoluteNum));

        if (isPercent) {
            return `${isNegative ? '▼' : '▲'} ${formatted}%`;
        }
        
        return `${isNegative ? '-$' : '$'}${formatted}`;
    };

    const formatInvestmentAmount = (value) => {
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0
        }).format(value);
    };

    const getTotalInvestment = () => {
        return investmentAmount * (earningsRange[1] - earningsRange[0] + 1);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const handleInvestmentChange = (value) => {
        const numValue = parseInt(value.replace(/[^0-9]/g, ''));
        if (!isNaN(numValue)) {
            setInvestmentAmount(Math.min(Math.max(1, numValue), 10000000));
        }
    };

    const updateAmount = (increment) => {
        const step = 1000 * speedMultiplier.current;
        setInvestmentAmount(prev => {
            const newValue = prev + (increment ? step : -step);
            return Math.min(Math.max(1, newValue), 10000000);
        });
    };

    const startIncrement = (increment) => {
        speedMultiplier.current = 1;
        updateAmount(increment);

        buttonPressTimer.current = setTimeout(() => {
            buttonPressInterval.current = setInterval(() => {
                speedMultiplier.current = Math.min(speedMultiplier.current + 0.5, 10);
                updateAmount(increment);
            }, 50);
        }, 500);
    };

    const stopIncrement = () => {
        if (buttonPressTimer.current) clearTimeout(buttonPressTimer.current);
        if (buttonPressInterval.current) clearInterval(buttonPressInterval.current);
        buttonPressTimer.current = null;
        buttonPressInterval.current = null;
        speedMultiplier.current = 1;
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedInvestment(investmentAmount);
        }, 500);
        return () => clearTimeout(timer);
    }, [investmentAmount]);

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

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedRange(earningsRange);
        }, 500);

        return () => clearTimeout(timer);
    }, [earningsRange]);

    const getAvailableCompaniesInfo = () => {
        if (!availableCompanies) return null;

        const minEarningsNeeded = earningsRange[1];
        const availableCount = Object.entries(availableCompanies).filter(
            ([_, count]) => count >= minEarningsNeeded
        ).length;

        return `${availableCount} companies have sufficient history for this range`;
    };

    const getTimelinePosition = (value) => {
        const percentage = (value / MAX_EARNINGS) * 100;
        const thumbOffset = 10;
        const trackWidth = document.querySelector('.timeline-track')?.offsetWidth || 0;
        const offsetPercentage = (thumbOffset / trackWidth) * 100;

        return percentage + (value === 1 ? offsetPercentage : -offsetPercentage);
    };

    const fetchCalculatorResults = useCallback(async () => {
        try {
            setCalculatorLoading(true);
            const count = debouncedRange[1] - debouncedRange[0] + 1;
            
            const response = await fetch(
                `/api/calculator?amount=${debouncedInvestment}&earnings=${count}&start=${debouncedRange[0]}&end=${debouncedRange[1]}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch calculator data');
            }
            
            const data = await response.json();
            setCalculatorResults(data);
        } catch (error) {
            console.error('Error fetching calculator data:', error);
        } finally {
            setCalculatorLoading(false);
        }
    }, [debouncedInvestment, debouncedRange]);

    useEffect(() => {
        fetchCalculatorResults();
    }, [debouncedInvestment, debouncedRange, fetchCalculatorResults]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const sortedResults = calculatorResults ? [...calculatorResults]
        .sort((a, b) => {
            const direction = sortDirection === 'asc' ? 1 : -1;
            switch (sortColumn) {
                case 'symbol':
                    return direction * a.symbol.localeCompare(b.symbol);
                case 'tradeReturn':
                    return direction * (a.tradeReturn - b.tradeReturn);
                case 'tradeReturnPercent':
                    return direction * (a.tradeReturnPercent - b.tradeReturnPercent);
                case 'holdReturn':
                    return direction * (a.holdReturn - b.holdReturn);
                case 'holdReturnPercent':
                    return direction * (a.holdReturnPercent - b.holdReturnPercent);
                case 'avgReturn':
                    return direction * (a.avgReturn - b.avgReturn);
                default:
                    return 0;
            }
        }) : [];

    return (
        <div className="calculator-container">
            <div className="calculator-controls">
                <div className="investment-section">
                    <div className="investment-input">
                        <label>Investment Amount per Earnings:</label>
                        <div className="input-group">
                            <button 
                                onMouseDown={() => startIncrement(false)}
                                onMouseUp={stopIncrement}
                                onMouseLeave={stopIncrement}
                                onTouchStart={() => startIncrement(false)}
                                onTouchEnd={stopIncrement}
                                className="amount-button"
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
                                onMouseDown={() => startIncrement(true)}
                                onMouseUp={stopIncrement}
                                onMouseLeave={stopIncrement}
                                onTouchStart={() => startIncrement(true)}
                                onTouchEnd={stopIncrement}
                                className="amount-button"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <div className="total-invested">
                        Total Investment: {formatCurrency(getTotalInvestment())}
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
                                <th onClick={() => handleSort('symbol')} 
                                    title="Stock symbol">
                                    Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th title="Company name">
                                    Company
                                </th>
                                <th onClick={() => handleSort('tradeReturn')} 
                                    title="Total dollar return if you invested the specified amount in each earnings event separately. Earnings event = buy day before and sell day after earnings. For example, if you invested $1,000 in 4 earnings events, this shows the profit/loss from $4000 total investment.">
                                    Trade Return {sortColumn === 'tradeReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('tradeReturnPercent')} 
                                    title="Percentage return on investment from trading earnings separately. Calculated as (Total Profit or Loss / Total Investment Amount) × 100">
                                    Trade % {sortColumn === 'tradeReturnPercent' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('holdReturn')} 
                                    title="Total dollar return if you held through all earnings events, reinvesting the specified amount at each earnings. This simulates buying and holding while adding more investment at each earnings.">
                                    Hold Return {sortColumn === 'holdReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('holdReturnPercent')} 
                                    title="Percentage return from the hold strategy. Calculated as (Final Portfolio Value - Total Invested Amount) / Total Invested Amount × 100">
                                    Hold % {sortColumn === 'holdReturnPercent' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('tradesCount')} 
                                    title="Number of earnings events analyzed in the selected date range">
                                    # of Trades {sortColumn === 'tradesCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedResults.map((result) => (
                                <tr key={result.symbol}>
                                    <td>{result.symbol}</td>
                                    <td>{result.name}</td>
                                    <td className={result.tradeReturn >= 0 ? 'positive' : 'negative'}>
                                        {formatNumber(result.tradeReturn)}
                                    </td>
                                    <td className={result.tradeReturnPercent >= 0 ? 'positive' : 'negative'}>
                                        {formatNumber(result.tradeReturnPercent, true)}
                                    </td>
                                    <td className={result.holdReturn >= 0 ? 'positive' : 'negative'}>
                                        {formatNumber(result.holdReturn)}
                                    </td>
                                    <td className={result.holdReturnPercent >= 0 ? 'positive' : 'negative'}>
                                        {formatNumber(result.holdReturnPercent, true)}
                                    </td>
                                    <td>
                                        {result.tradesCount}
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