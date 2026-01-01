import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function UserManagement() {
    const [userSummaries, setUserSummaries] = useState<any[]>([]);
    const { setUserActiveStatus, loading, error } = useSuperAdmin();

    useEffect(() => {
        // Read from the admin aggregated view
        const q = query(
            collection(db, 'adminViews', 'userSummaries', 'users'),
            orderBy('lastUpdated', 'desc'),
            limit(100)
        );

        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserSummaries(docs);
        });
        return () => unsub();
    }, []);

    const handleToggleStatus = async (userId: string, currentActive: boolean) => {
        const action = currentActive ? "DISABLE" : "ENABLE";
        if (window.confirm(`Are you sure you want to ${action} this user? They will be blocked from logging into the platform.`)) {
            await setUserActiveStatus(userId, !currentActive);
        }
    };

    return (
        <div className="user-management">
            <h3>User Monitoring (Security View)</h3>

            <div className="summary-table">
                <table>
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Tenant</th>
                            <th>Role</th>
                            <th>Devices</th>
                            <th>Switches</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {userSummaries.map((u) => (
                            <tr key={u.id} className={u.active === false ? 'row-disabled' : ''}>
                                <td className="font-mono">{u.id.substring(0, 8)}...</td>
                                <td>{u.tenantId || 'N/A'}</td>
                                <td>
                                    <span className={`badge role ${u.role}`}>
                                        {u.role?.toUpperCase() || 'USER'}
                                    </span>
                                </td>
                                <td>{u.deviceCount || 0}</td>
                                <td>{u.switchCount || 0}</td>
                                <td>
                                    <span className={`badge ${u.active !== false ? 'active' : 'inactive'}`}>
                                        {u.active !== false ? 'ACTIVE' : 'DISABLED'}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        onClick={() => handleToggleStatus(u.id, u.active !== false)}
                                        className={`btn-sml ${u.active !== false ? 'danger' : 'success'}`}
                                        disabled={loading}
                                    >
                                        {u.active !== false ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {userSummaries.length === 0 && (
                    <div className="empty-state">No users monitored yet. Triggers will populate data on change.</div>
                )}
            </div>

            {error && <div className="error-msg">{error}</div>}

            <style jsx>{`
                .user-management {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    margin-top: 24px;
                }
                .summary-table {
                    margin-top: 16px;
                    overflow-x: auto;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    text-align: left;
                    padding: 12px;
                    border-bottom: 2px solid #eee;
                    font-size: 13px;
                    color: #666;
                }
                td {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                .font-mono { font-family: monospace; font-size: 12px; }
                .row-disabled { background: #fff8f8; }
                
                .badge {
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge.active { background: #e8f5e9; color: #2e7d32; }
                .badge.inactive { background: #ffebee; color: #c62828; }
                .badge.role { background: #e3f2fd; color: #1565c0; }
                .badge.role.tenant_admin { background: #f3e5f5; color: #7b1fa2; }
                .badge.role.super_admin { background: #fff3e0; color: #e65100; }
                
                .btn-sml {
                    padding: 4px 10px;
                    border-radius: 4px;
                    border: none;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    color: white;
                    min-width: 60px;
                }
                .btn-sml.danger { background: #f44336; }
                .btn-sml.success { background: #4caf50; }
                .btn-sml:disabled { opacity: 0.5; }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #999;
                    font-size: 14px;
                }
                .error-msg {
                    margin-top: 16px;
                    color: #f44336;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
}
