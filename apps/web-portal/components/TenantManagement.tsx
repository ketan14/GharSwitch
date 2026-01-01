import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function TenantManagement() {
    const [tenants, setTenants] = useState<any[]>([]);
    const { setTenantStatus, assignSubscriptionPlan, loading } = useSuperAdmin();

    useEffect(() => {
        const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTenants(docs);
        });
        return () => unsub();
    }, []);

    const handleToggleStatus = async (tenantId: string, currentStatus: boolean) => {
        const action = currentStatus ? "SUSPEND" : "ACTIVATE";
        const reason = !currentStatus ? "" : window.prompt("Reason for suspension:", "Policy violation");

        if (reason !== null && window.confirm(`Are you sure you want to ${action} this tenant?`)) {
            await setTenantStatus(tenantId, !currentStatus, reason);
        }
    };

    const handleChangePlan = async (tenantId: string) => {
        const plan = window.prompt("Enter new plan (bronze, silver, gold):");
        if (plan && ['bronze', 'silver', 'gold'].includes(plan.toLowerCase())) {
            await assignSubscriptionPlan(tenantId, plan.toLowerCase() as any);
        } else if (plan) {
            alert("Invalid plan! Use bronze, silver, or gold.");
        }
    };

    return (
        <div className="tenant-management">
            <h3>Tenant Lifecycle & Subscriptions</h3>

            <div className="tenant-list">
                {tenants.map((tenant) => (
                    <div key={tenant.id} className={`tenant-row ${tenant.active === false ? 'suspended' : ''}`}>
                        <div className="tenant-info">
                            <span className="tenant-name">{tenant.name}</span>
                            <span className="tenant-id">ID: {tenant.id}</span>
                            <div className="badges">
                                <span className={`badge ${tenant.active !== false ? 'active' : 'inactive'}`}>
                                    {tenant.active !== false ? 'ACTIVE' : 'SUSPENDED'}
                                </span>
                                <span className="badge plan">{tenant.plan?.toUpperCase() || 'FREE'}</span>
                            </div>
                        </div>

                        <div className="tenant-actions">
                            <button
                                onClick={() => handleChangePlan(tenant.id)}
                                className="action-btn outline"
                                disabled={loading}
                            >
                                Change Plan
                            </button>
                            <button
                                onClick={() => handleToggleStatus(tenant.id, tenant.active !== false)}
                                className={`action-btn ${tenant.active !== false ? 'danger' : 'success'}`}
                                disabled={loading}
                            >
                                {tenant.active !== false ? 'Suspend' : 'Activate'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .tenant-management {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .tenant-list {
                    margin-top: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .tenant-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: #f9f9f9;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    transition: all 0.2s;
                }
                .tenant-row.suspended {
                    border-left: 4px solid #f44336;
                    background: #fffafa;
                }
                .tenant-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .tenant-name {
                    font-weight: 600;
                    font-size: 16px;
                }
                .tenant-id {
                    font-size: 12px;
                    color: #999;
                }
                .badges {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                }
                .badge {
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge.active { background: #e8f5e9; color: #2e7d32; }
                .badge.inactive { background: #ffebee; color: #c62828; }
                .badge.plan { background: #e3f2fd; color: #1565c0; }
                
                .tenant-actions {
                    display: flex;
                    gap: 8px;
                }
                .action-btn {
                    padding: 6px 12px;
                    border-radius: 4px;
                    border: none;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .action-btn.outline {
                    background: transparent;
                    border: 1px solid #ccc;
                    color: #666;
                }
                .action-btn.danger { background: #f44336; color: white; }
                .action-btn.success { background: #4caf50; color: white; }
                .action-btn:hover:not(:disabled) { opacity: 0.8; }
                .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
