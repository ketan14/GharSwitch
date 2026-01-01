import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function PlatformSettings() {
    const [config, setConfig] = useState<any>(null);
    const { updatePlatformConfig, loading, error } = useSuperAdmin();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'platformConfig', 'global'), (snap) => {
            if (snap.exists()) {
                setConfig(snap.data());
            }
        });
        return () => unsub();
    }, []);

    const toggleMaintenanceMode = async () => {
        const isMaintenance = config?.maintenanceMode || false;
        const confirmMsg = isMaintenance
            ? "Are you sure you want to DISABLE maintenance mode? All users will regain control."
            : "Are you sure you want to ENABLE maintenance mode? This will block all device commands immediately.";

        if (window.confirm(confirmMsg)) {
            await updatePlatformConfig({ maintenanceMode: !isMaintenance });
        }
    };

    return (
        <div className="platform-settings">
            <h3>Global Platform Settings</h3>

            <div className="setting-card">
                <div className="setting-info">
                    <h4>Maintenance Mode</h4>
                    <p>When enabled, all device commands are blocked but real-time status updates remain active.</p>
                </div>
                <div className="setting-action">
                    <button
                        onClick={toggleMaintenanceMode}
                        className={`action-btn ${config?.maintenanceMode ? 'danger' : 'safe'}`}
                        disabled={loading}
                    >
                        {loading ? 'Updating...' : config?.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                    </button>
                    {config?.maintenanceMode && (
                        <div className="status-indicator warning">Platform is currently in maintenance mode</div>
                    )}
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <style jsx>{`
                .platform-settings {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .setting-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 8px;
                    margin-top: 16px;
                }
                .setting-info h4 {
                    margin: 0 0 4px 0;
                    font-size: 16px;
                }
                .setting-info p {
                    margin: 0;
                    font-size: 14px;
                    color: #666;
                }
                .action-btn {
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    min-width: 140px;
                    color: white;
                }
                .action-btn.danger { background: #f44336; }
                .action-btn.safe { background: #4caf50; }
                .action-btn:hover:not(:disabled) { opacity: 0.9; }
                .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .status-indicator.warning {
                    font-size: 12px;
                    color: #d32f2f;
                    margin-top: 8px;
                    font-weight: 600;
                }
                .error-message {
                    color: #f44336;
                    font-size: 14px;
                    margin-top: 16px;
                }
            `}</style>
        </div>
    );
}
