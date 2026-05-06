import React, { useState } from 'react';
import { AtombergApi } from '../api/client';

export const AtombergRegistrationForm: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [hubNickname, setHubNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            // 1. Submit credentials to our secure Cloud Function
            const loginRes = await AtombergApi.login(apiKey, hubNickname || 'Atomberg Hub');
            
            if (loginRes.success && loginRes.data.hubId) {
                // 2. Trigger Discovery to fetch devices
                const discoverRes = await AtombergApi.discover(loginRes.data.hubId);
                
                if (discoverRes.success) {
                    setStatus({ 
                        type: 'success', 
                        message: `Successfully connected and discovered ${discoverRes.data.devices.length} devices.` 
                    });
                    setApiKey('');
                    setHubNickname('');
                } else {
                    setStatus({ type: 'error', message: 'Failed to discover devices.' });
                }
            } else {
                setStatus({ type: 'error', message: loginRes.error?.message || 'Login failed.' });
            }
        } catch (error: any) {
            console.error('Registration Error:', error);
            setStatus({ type: 'error', message: error.response?.data?.error?.message || 'Network error occurred.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="registration-form">
            <h3>Add Atomberg Devices</h3>
            <p className="subtitle">Enter your Atomberg API Key to link your fans.</p>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Hub Nickname (Optional)</label>
                    <input 
                        type="text" 
                        value={hubNickname} 
                        onChange={e => setHubNickname(e.target.value)} 
                        placeholder="e.g. Living Room Fans"
                    />
                </div>

                <div className="form-group">
                    <label>Atomberg API Key</label>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={e => setApiKey(e.target.value)} 
                        placeholder="Enter API Key"
                        required
                    />
                </div>

                {status && (
                    <div className={`status-message ${status.type}`}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={loading || !apiKey}>
                    {loading ? 'Connecting...' : 'Connect & Discover'}
                </button>
            </form>

            <style jsx>{`
                .registration-form {
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                    border: 1px solid #edf2f7;
                    max-width: 400px;
                }
                h3 { margin: 0 0 8px 0; color: #2d3748; }
                .subtitle { color: #718096; font-size: 14px; margin-bottom: 20px; }
                
                .form-group {
                    margin-bottom: 16px;
                }
                label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                input:focus {
                    outline: none;
                    border-color: #3182ce;
                    box-shadow: 0 0 0 1px #3182ce;
                }

                .status-message {
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 13px;
                    margin-bottom: 16px;
                }
                .status-message.error { background: #fed7d7; color: #c53030; }
                .status-message.success { background: #c6f6d5; color: #276749; }

                button {
                    width: 100%;
                    padding: 12px;
                    background: #3182ce;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                button:hover:not(:disabled) { background: #2b6cb0; }
                button:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
};
