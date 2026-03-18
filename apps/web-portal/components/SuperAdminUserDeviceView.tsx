import React, { useState } from 'react';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function SuperAdminUserDeviceView() {
    const [userEmail, setUserEmail] = useState('');
    const [userDetails, setUserDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getUserDeviceAccess, revokeUserDeviceAccess, loading: actionLoading } = useSuperAdmin();

    const handleSearch = async () => {
        if (!userEmail.trim()) {
            setError('Please enter a user email or ID');
            return;
        }

        setLoading(true);
        setError(null);
        setUserDetails(null);

        try {
            const result = await getUserDeviceAccess(userEmail.trim());
            if (result.success) {
                setUserDetails(result.data);
            } else {
                setError(result.error || 'User not found');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch user details');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeAccess = async (deviceId: string, deviceName: string) => {
        const confirmed = window.confirm(
            `⚠️ EMERGENCY REVOCATION\n\nRevoke ${userDetails.email || userDetails.userId}'s access to device "${deviceName}" (${deviceId})?\n\nThis is a Super Admin override and will be logged for audit.`
        );

        if (!confirmed) return;

        try {
            const result = await revokeUserDeviceAccess(userDetails.userId, deviceId);
            if (result.success) {
                alert('Access revoked successfully!');
                // Refresh user details
                handleSearch();
            } else {
                alert(`Revocation failed: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Revocation failed: ${err.message}`);
        }
    };

    return (
        <div className="user-device-view">
            <h3>User Device Access Viewer</h3>
            <p className="description">Search for a user to view all devices they have access to and manage emergency access revocation.</p>

            {/* Search Section */}
            <div className="search-section">
                <div className="search-row">
                    <input
                        type="text"
                        placeholder="Enter User Email or User ID"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="user-input"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="search-btn"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {error && <div className="error-msg">{error}</div>}
            </div>

            {/* User Details */}
            {userDetails && (
                <div className="user-details">
                    <div className="detail-header">
                        <div>
                            <h4>{userDetails.email || userDetails.userId}</h4>
                            <span className="user-id">ID: {userDetails.userId}</span>
                        </div>
                        <span className={`status-badge ${userDetails.active ? 'active' : 'inactive'}`}>
                            {userDetails.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                    </div>

                    <div className="detail-grid">
                        <div className="detail-item">
                            <label>Tenant</label>
                            <span className="tenant-name">{userDetails.tenantId || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                            <label>Role</label>
                            <span className="role-badge">{userDetails.role?.toUpperCase() || 'USER'}</span>
                        </div>
                        <div className="detail-item">
                            <label>Total Devices</label>
                            <span className="count">{userDetails.devices?.length || 0}</span>
                        </div>
                    </div>

                    {/* Devices List */}
                    <div className="devices-section">
                        <h5>Device Access ({userDetails.devices?.length || 0})</h5>
                        {userDetails.devices && userDetails.devices.length > 0 ? (
                            <div className="device-list">
                                {userDetails.devices.map((device: any) => (
                                    <div key={device.deviceId} className="device-item">
                                        <div className="device-info">
                                            <div className="device-main">
                                                <span className="device-name">{device.deviceName || device.deviceId}</span>
                                                <span className="device-id">ID: {device.deviceId}</span>
                                            </div>
                                            <div className="device-meta">
                                                <span className="device-model">{device.model || 'Unknown Model'}</span>
                                                <span className={`device-status ${device.active ? 'active' : 'inactive'}`}>
                                                    {device.active ? '● Online' : '○ Offline'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeAccess(device.deviceId, device.deviceName || device.deviceId)}
                                            disabled={actionLoading}
                                            className="revoke-btn"
                                        >
                                            Revoke Access
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-text">This user has no device access.</p>
                        )}
                    </div>

                    {/* Warning Notice */}
                    <div className="warning-notice">
                        <strong>⚠️ Emergency Use Only:</strong> Revoking access here is a Super Admin override.
                        Normal access management should be done by Tenant Admins. All actions are logged for audit.
                    </div>
                </div>
            )}

            <style jsx>{`
                .user-device-view {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    margin-top: 24px;
                }

                h3 {
                    margin: 0 0 8px 0;
                    font-size: 18px;
                }

                .description {
                    margin: 0 0 20px 0;
                    color: #666;
                    font-size: 14px;
                }

                .search-section {
                    margin-bottom: 24px;
                }

                .search-row {
                    display: flex;
                    gap: 10px;
                }

                .user-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }

                .user-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                }

                .search-btn {
                    padding: 10px 20px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .search-btn:hover:not(:disabled) {
                    background: #2563eb;
                }

                .search-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .error-msg {
                    margin-top: 10px;
                    padding: 10px;
                    background: #fee;
                    color: #c00;
                    border-radius: 6px;
                    font-size: 13px;
                }

                .user-details {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    background: #f9fafb;
                }

                .detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .detail-header h4 {
                    margin: 0 0 4px 0;
                    font-size: 16px;
                }

                .user-id {
                    font-size: 12px;
                    color: #6b7280;
                    font-family: monospace;
                }

                .status-badge {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .status-badge.active {
                    background: #e8f5e9;
                    color: #2e7d32;
                }

                .status-badge.inactive {
                    background: #ffebee;
                    color: #c62828;
                }

                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .detail-item label {
                    font-size: 12px;
                    color: #666;
                    font-weight: 500;
                }

                .detail-item span {
                    font-size: 14px;
                    color: #1f2937;
                }

                .tenant-name {
                    font-weight: 600;
                    color: #3b82f6;
                }

                .role-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    background: #e3f2fd;
                    color: #1565c0;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .count {
                    font-weight: 600;
                    font-size: 18px;
                    color: #3b82f6;
                }

                .devices-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }

                h5 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    color: #374151;
                }

                .device-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .device-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    transition: box-shadow 0.2s;
                }

                .device-item:hover {
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .device-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .device-main {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .device-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1f2937;
                }

                .device-id {
                    font-size: 11px;
                    color: #9ca3af;
                    font-family: monospace;
                }

                .device-meta {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .device-model {
                    font-size: 12px;
                    color: #6b7280;
                }

                .device-status {
                    font-size: 11px;
                    font-weight: 500;
                }

                .device-status.active {
                    color: #16a34a;
                }

                .device-status.inactive {
                    color: #9ca3af;
                }

                .revoke-btn {
                    padding: 6px 12px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                    white-space: nowrap;
                }

                .revoke-btn:hover:not(:disabled) {
                    background: #dc2626;
                }

                .revoke-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .empty-text {
                    color: #9ca3af;
                    font-size: 13px;
                    font-style: italic;
                }

                .warning-notice {
                    margin-top: 20px;
                    padding: 12px;
                    background: #fef3c7;
                    border: 1px solid #fbbf24;
                    border-radius: 6px;
                    font-size: 12px;
                    color: #92400e;
                }

                .warning-notice strong {
                    display: block;
                    margin-bottom: 4px;
                }
            `}</style>
        </div>
    );
}
