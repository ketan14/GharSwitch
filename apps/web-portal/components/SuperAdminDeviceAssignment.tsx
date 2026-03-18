import React, { useState } from 'react';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function SuperAdminDeviceAssignment() {
    const [deviceId, setDeviceId] = useState('');
    const [deviceDetails, setDeviceDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newTenantId, setNewTenantId] = useState('');
    const { getDeviceAccessDetails, transferDeviceToTenant, loading: actionLoading } = useSuperAdmin();

    const handleSearch = async () => {
        if (!deviceId.trim()) {
            setError('Please enter a device ID');
            return;
        }

        setLoading(true);
        setError(null);
        setDeviceDetails(null);

        try {
            const result = await getDeviceAccessDetails(deviceId.trim());
            if (result.success) {
                setDeviceDetails(result.data);
            } else {
                setError(result.error || 'Device not found');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch device details');
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!newTenantId.trim()) {
            alert('Please enter a tenant ID');
            return;
        }

        const confirmed = window.confirm(
            `⚠️ CRITICAL: Transfer device "${deviceId}" from "${deviceDetails?.currentTenant || 'Unknown'}" to "${newTenantId}"?\n\nThis will:\n- Remove device from current tenant\n- Revoke all current user access\n- Assign to new tenant\n\nThis action is logged for audit.`
        );

        if (!confirmed) return;

        try {
            const result = await transferDeviceToTenant(deviceId, newTenantId);
            if (result.success) {
                alert('Device transferred successfully!');
                setNewTenantId('');
                // Refresh device details
                handleSearch();
            } else {
                alert(`Transfer failed: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Transfer failed: ${err.message}`);
        }
    };

    return (
        <div className="device-assignment">
            <h3>Device Assignment & Transfer</h3>
            <p className="description">Search for a device to view access details and transfer ownership between tenants.</p>

            {/* Search Section */}
            <div className="search-section">
                <div className="search-row">
                    <input
                        type="text"
                        placeholder="Enter Device ID (e.g., PICO_ABC123)"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="device-input"
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

            {/* Device Details */}
            {deviceDetails && (
                <div className="device-details">
                    <div className="detail-header">
                        <h4>Device: {deviceDetails.deviceId}</h4>
                        <span className={`status-badge ${deviceDetails.active ? 'active' : 'inactive'}`}>
                            {deviceDetails.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                    </div>

                    <div className="detail-grid">
                        <div className="detail-item">
                            <label>Model</label>
                            <span>{deviceDetails.model || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                            <label>Current Tenant</label>
                            <span className="tenant-name">{deviceDetails.currentTenant || 'Unclaimed'}</span>
                        </div>
                        <div className="detail-item">
                            <label>Registered</label>
                            <span>{deviceDetails.createdAt ? new Date(deviceDetails.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>

                    {/* Users with Access */}
                    <div className="access-section">
                        <h5>Users with Access ({deviceDetails.users?.length || 0})</h5>
                        {deviceDetails.users && deviceDetails.users.length > 0 ? (
                            <div className="user-list">
                                {deviceDetails.users.map((user: any) => (
                                    <div key={user.userId} className="user-item">
                                        <div className="user-info">
                                            <span className="user-email">{user.email || user.userId}</span>
                                            <span className="user-role">{user.role}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-text">No users have access to this device.</p>
                        )}
                    </div>

                    {/* Transfer Section */}
                    <div className="transfer-section">
                        <h5>Transfer Device to Another Tenant</h5>
                        <div className="transfer-row">
                            <input
                                type="text"
                                placeholder="Enter new Tenant ID"
                                value={newTenantId}
                                onChange={(e) => setNewTenantId(e.target.value)}
                                className="tenant-input"
                            />
                            <button
                                onClick={handleTransfer}
                                disabled={actionLoading || !newTenantId.trim()}
                                className="transfer-btn"
                            >
                                Transfer Device
                            </button>
                        </div>
                        <small className="warning-text">
                            ⚠️ This will revoke all current user access and reassign the device.
                        </small>
                    </div>
                </div>
            )}

            <style jsx>{`
                .device-assignment {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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

                .device-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }

                .device-input:focus {
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

                .device-details {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    background: #f9fafb;
                }

                .detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .detail-header h4 {
                    margin: 0;
                    font-size: 16px;
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
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

                .access-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }

                h5 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    color: #374151;
                }

                .user-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .user-item {
                    padding: 10px 12px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                }

                .user-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .user-email {
                    font-size: 13px;
                    color: #1f2937;
                }

                .user-role {
                    font-size: 11px;
                    color: #6b7280;
                    text-transform: uppercase;
                    background: #f3f4f6;
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .empty-text {
                    color: #9ca3af;
                    font-size: 13px;
                    font-style: italic;
                }

                .transfer-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }

                .transfer-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 8px;
                }

                .tenant-input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 13px;
                }

                .tenant-input:focus {
                    outline: none;
                    border-color: #f59e0b;
                }

                .transfer-btn {
                    padding: 8px 16px;
                    background: #f59e0b;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .transfer-btn:hover:not(:disabled) {
                    background: #d97706;
                }

                .transfer-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .warning-text {
                    color: #d97706;
                    font-size: 12px;
                }
            `}</style>
        </div>
    );
}
