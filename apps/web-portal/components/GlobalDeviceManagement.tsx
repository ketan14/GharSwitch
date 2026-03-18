import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useSuperAdmin } from '../hooks/useSuperAdmin';

export default function GlobalDeviceManagement() {
    const [devices, setDevices] = useState<any[]>([]);
    const { setDeviceGlobalStatus, loading } = useSuperAdmin();

    // Pagination & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [tenantFilter, setTenantFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState<'deviceId' | 'model' | 'status' | 'tenant'>('deviceId');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const itemsPerPage = 20;

    useEffect(() => {
        const q = query(collection(db, 'global_devices'));
        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDevices(docs);
        });
        return () => unsub();
    }, []);

    // Get unique tenants for filter dropdown
    const uniqueTenants = useMemo(() => {
        const tenants = new Set(devices.map(d => d.claimedBy).filter(Boolean));
        return Array.from(tenants).sort();
    }, [devices]);

    // Filter and sort devices
    const filteredAndSortedDevices = useMemo(() => {
        let filtered = devices.filter(device => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                device.id.toLowerCase().includes(searchLower) ||
                device.deviceId?.toLowerCase().includes(searchLower) ||
                device.model?.toLowerCase().includes(searchLower) ||
                device.claimedBy?.toLowerCase().includes(searchLower);

            // Status filter
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && device.active !== false) ||
                (statusFilter === 'disabled' && device.active === false);

            // Tenant filter
            const matchesTenant = tenantFilter === 'all' || device.claimedBy === tenantFilter;

            return matchesSearch && matchesStatus && matchesTenant;
        });

        // Sort
        filtered.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'deviceId':
                    aVal = a.id || '';
                    bVal = b.id || '';
                    break;
                case 'model':
                    aVal = a.model || '';
                    bVal = b.model || '';
                    break;
                case 'status':
                    aVal = a.active !== false ? 'active' : 'disabled';
                    bVal = b.active !== false ? 'active' : 'disabled';
                    break;
                case 'tenant':
                    aVal = a.claimedBy || 'Unclaimed';
                    bVal = b.claimedBy || 'Unclaimed';
                    break;
                default:
                    aVal = a.id || '';
                    bVal = b.id || '';
            }

            const comparison = aVal.toString().localeCompare(bVal.toString());
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [devices, searchTerm, statusFilter, tenantFilter, sortBy, sortOrder]);

    // Pagination
    const totalPages = Math.ceil(filteredAndSortedDevices.length / itemsPerPage);
    const paginatedDevices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedDevices.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedDevices, currentPage]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, tenantFilter]);

    const toggleDeviceStatus = async (deviceId: string, currentStatus: boolean) => {
        const action = currentStatus ? "DEACTIVATE" : "RE-ACTIVATE";
        if (window.confirm(`⚠️ CRITICAL: Are you sure you want to ${action} this hardware globally? This will override all tenant controls.`)) {
            await setDeviceGlobalStatus(deviceId, !currentStatus);
        }
    };

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const SortIcon = ({ column }: { column: typeof sortBy }) => {
        if (sortBy !== column) return <span className="sort-icon">⇅</span>;
        return <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="global-devices">
            <h3>Global Hardware Registry</h3>

            {/* Filters Section */}
            <div className="filters-section">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search by Device ID, Model, or Tenant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-controls">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="filter-select"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="disabled">Disabled Only</option>
                    </select>

                    <select
                        value={tenantFilter}
                        onChange={(e) => setTenantFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Tenants</option>
                        {uniqueTenants.map(tenant => (
                            <option key={tenant} value={tenant}>{tenant}</option>
                        ))}
                    </select>

                    {(searchTerm || statusFilter !== 'all' || tenantFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setTenantFilter('all');
                            }}
                            className="clear-filters-btn"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Results Info */}
            <div className="results-info">
                Showing {paginatedDevices.length} of {filteredAndSortedDevices.length} devices
                {filteredAndSortedDevices.length !== devices.length && ` (filtered from ${devices.length} total)`}
            </div>

            {/* Device Table */}
            <div className="device-table">
                <table>
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('deviceId')} className="sortable">
                                Device ID <SortIcon column="deviceId" />
                            </th>
                            <th onClick={() => handleSort('model')} className="sortable">
                                Model <SortIcon column="model" />
                            </th>
                            <th onClick={() => handleSort('status')} className="sortable">
                                Status <SortIcon column="status" />
                            </th>
                            <th onClick={() => handleSort('tenant')} className="sortable">
                                Tenant <SortIcon column="tenant" />
                            </th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedDevices.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="empty-state">
                                    {devices.length === 0
                                        ? 'No devices registered yet.'
                                        : 'No devices match your filters.'}
                                </td>
                            </tr>
                        ) : (
                            paginatedDevices.map((device) => (
                                <tr key={device.id} className={device.active === false ? 'suspended' : ''}>
                                    <td className="font-mono">{device.id}</td>
                                    <td>{device.model} - {device.deviceId}</td>
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="page-btn"
                    >
                        First
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="page-btn"
                    >
                        Previous
                    </button>

                    <span className="page-info">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="page-btn"
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="page-btn"
                    >
                        Last
                    </button>
                </div>
            )}

            <style jsx>{`
                .global-devices {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                h3 {
                    margin: 0 0 20px 0;
                }

                .filters-section {
                    margin-bottom: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .search-box {
                    width: 100%;
                }

                .search-input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }

                .search-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                }

                .filter-controls {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .filter-select {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                }

                .clear-filters-btn {
                    padding: 8px 12px;
                    background: #f3f4f6;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .clear-filters-btn:hover {
                    background: #e5e7eb;
                }

                .results-info {
                    margin-bottom: 12px;
                    font-size: 13px;
                    color: #666;
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
                    white-space: nowrap;
                }

                th.sortable {
                    cursor: pointer;
                    user-select: none;
                    transition: background 0.2s;
                }

                th.sortable:hover {
                    background: #f9f9f9;
                }

                .sort-icon {
                    margin-left: 4px;
                    color: #999;
                    font-size: 12px;
                }

                td {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }

                .font-mono { 
                    font-family: monospace; 
                    font-size: 12px; 
                }

                .suspended { 
                    background: #fff8f8; 
                }

                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                }

                .badge {
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .badge.active { 
                    background: #e8f5e9; 
                    color: #2e7d32; 
                }

                .badge.inactive { 
                    background: #ffebee; 
                    color: #c62828; 
                }
                
                .btn-sml {
                    padding: 4px 10px;
                    border-radius: 4px;
                    border: none;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    color: white;
                }

                .btn-sml.danger { 
                    background: #f44336; 
                }

                .btn-sml.success { 
                    background: #4caf50; 
                }

                .btn-sml:disabled { 
                    opacity: 0.5; 
                    cursor: not-allowed;
                }

                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    margin-top: 20px;
                    padding-top: 16px;
                    border-top: 1px solid #eee;
                }

                .page-btn {
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .page-btn:hover:not(:disabled) {
                    background: #f3f4f6;
                    border-color: #3b82f6;
                }

                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-info {
                    padding: 0 12px;
                    font-size: 13px;
                    color: #666;
                }

                @media (max-width: 768px) {
                    .filter-controls {
                        flex-direction: column;
                    }

                    .filter-select, .clear-filters-btn {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
}
