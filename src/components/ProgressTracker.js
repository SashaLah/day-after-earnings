import React, { useState, useEffect } from 'react';

const ProgressTracker = () => {
    const [progress, setProgress] = useState({
        lastProcessedIndex: 0,
        successfulCompanies: [],
        timestamp: new Date().toISOString()
    });

    useEffect(() => {
        // Load initial progress
        const loadProgress = async () => {
            try {
                const response = await fetch('/api/progress');
                if (response.ok) {
                    const data = await response.json();
                    setProgress(data);
                }
            } catch (error) {
                console.error('Failed to load progress:', error);
            }
        };

        loadProgress();
    }, []);

    return (
        <div className="progress-tracker">
            <h3>Processing Progress</h3>
            <div>Last Processed: {progress.lastProcessedIndex}</div>
            <div>Successful Companies: {progress.successfulCompanies.length}</div>
            <div>Last Updated: {new Date(progress.timestamp).toLocaleString()}</div>
        </div>
    );
};

export default ProgressTracker;