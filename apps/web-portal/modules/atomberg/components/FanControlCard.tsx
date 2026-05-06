import React, { useState } from 'react';
import { useFanControl } from '../hooks/useFanControl';

interface FanControlCardProps {
    hubId: string;
    deviceId: string;
    deviceName: string;
}

export const FanControlCard: React.FC<FanControlCardProps> = ({ hubId, deviceId, deviceName }) => {
    const { state, loading, setPower, setSpeed } = useFanControl(hubId, deviceId);

    if (loading) {
        return <div className="fan-card loading">Loading {deviceName}...</div>;
    }

    const power = state?.power || false;
    const speed = state?.speed || 1;
    const syncStatus = state?.syncStatus || 'SYNCED';

    const handlePowerToggle = () => {
        setPower(!power);
    };

    const handleSpeedChange = (newSpeed: number) => {
        if (newSpeed >= 1 && newSpeed <= 6) {
            setSpeed(newSpeed);
        }
    };

    return (
        <div className={`fan-card ${power ? 'on' : 'off'}`}>
            <div className="card-header">
                <h3>{deviceName}</h3>
                <span className={`status-badge ${syncStatus.toLowerCase()}`}>
                    {syncStatus}
                </span>
            </div>
            
            <div className="controls">
                <button 
                    className={`power-btn ${power ? 'active' : ''}`} 
                    onClick={handlePowerToggle}
                >
                    {power ? 'Turn Off' : 'Turn On'}
                </button>

                {power && (
                    <div className="speed-controller">
                        <label>Speed: {speed}</label>
                        <div className="speed-steps">
                            {[1, 2, 3, 4, 5, 6].map((s) => (
                                <button
                                    key={s}
                                    className={`speed-step ${s === speed ? 'current' : ''}`}
                                    onClick={() => handleSpeedChange(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .fan-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                    border: 1px solid #edf2f7;
                    transition: all 0.3s ease;
                }
                .fan-card.on {
                    border-color: #bee3f8;
                    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.15);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #2d3748;
                }
                .status-badge {
                    font-size: 10px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-weight: bold;
                }
                .status-badge.synced { background: #c6f6d5; color: #22543d; }
                .status-badge.pending { background: #feebc8; color: #7b341e; }
                .status-badge.failed { background: #fed7d7; color: #822727; }

                .power-btn {
                    width: 100%;
                    padding: 12px;
                    border-radius: 8px;
                    border: none;
                    background: #edf2f7;
                    color: #4a5568;
                    font-weight: bold;
                    cursor: pointer;
                    margin-bottom: 16px;
                }
                .power-btn.active {
                    background: #3182ce;
                    color: white;
                }

                .speed-controller label {
                    display: block;
                    font-size: 14px;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .speed-steps {
                    display: flex;
                    gap: 8px;
                    justify-content: space-between;
                }
                .speed-step {
                    flex: 1;
                    padding: 8px 0;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .speed-step.current {
                    background: #ebf8ff;
                    border-color: #3182ce;
                    color: #2b6cb0;
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
};
