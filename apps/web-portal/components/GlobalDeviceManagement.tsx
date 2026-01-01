import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function GlobalDeviceManagement() {
    const [devices, setDevices] = useState<any[]>([]);
    const { setDeviceGlobalStatus, loading } = useSuperAdmin();

    useEffect(() => {
        const q = query(collection(db, 'global_devices'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDevices(docs);
        });
        return () => unsub();
    }, []);

    const toggleDeviceStatus = async (deviceId: string, currentStatus: boolean) => {
        const action = currentStatus ? "DEACTIVATE" : "RE-ACTIVATE";
        if (window.confirm(`⚠️ CRITICAL: Are you sure you want to ${action} this hardware globally? This will override all tenant controls.`)) {
            await setDeviceGlobalStatus(deviceId, !currentStatus);
        }
    };

    return (
        <div className="global-devices">
            <h3>Global Hardware Registry</h3>

            <div className="device-table">
                <table>
                    <thead>
                        <tr>
                            <th>Device ID</th>
                            <th>Model</th>
                            <th>Status</th>
                            <th>Tenant</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devices.map((device) => (
                            <tr key={device.id} className={device.active === false ? 'suspended' : ''}>
                                <td className="font-mono">{device.id}</td>
                                <td>{device.model}</td>
                                <td>
                                    <span className={`badge ${device.active !== false ? 'active' : 'inactive'}`}>
                                        {device.active !== false ? 'ACTIVE' : 'DISABLED'}
                                    </span>
                                </td>
                                <td>{device.claimedBy || 'Unclaimed'}</td>
                                <td>
                                    <button
                                        onClick={() => toggleDeviceStatus(device.id, device.active !== false)}
                                        className={`btn-sml ${device.active !== false ? 'danger' : 'success'}`}
                                        disabled={loading}
                                    >
                                        {device.active !== false ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .global-devices {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .device-table {
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
                .suspended { background: #fff8f8; }
                .badge {
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge.active { background: #e8f5e9; color: #2e7d32; }
                .badge.inactive { background: #ffebee; color: #c62828; }
                
                .btn-sml {
                    padding: 4px 10px;
                    border-radius: 4px;
                    border: none;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    color: white;
                }
                .btn-sml.danger { background: #f44336; }
                .btn-sml.success { background: #4caf50; }
                .btn-sml:disabled { opacity: 0.5; }
            `}</style>
        </div>
    );
}
