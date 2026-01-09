import React, { useState } from 'react';
import { useMembers, TenantMember } from '../hooks/useMembers';
import { useAssignDevice } from '../hooks/useAssignDevice';

interface DeviceAccessControlProps {
    deviceId: string;
    deviceName: string;
    assignedUsers?: string[];
}

export default function DeviceAccessControl({ deviceId, deviceName, assignedUsers = [] }: DeviceAccessControlProps) {
    const { members, loading: loadingMembers } = useMembers();
    const { assignDevice, loading: assigning } = useAssignDevice();
    const [localAssigned, setLocalAssigned] = useState<string[]>(assignedUsers);

    const handleToggleAccess = async (userId: string) => {
        const isCurrentlyAssigned = localAssigned.includes(userId);
        const newAccessState = !isCurrentlyAssigned;

        try {
            await assignDevice(deviceId, userId, newAccessState);

            // Update local state on success
            if (newAccessState) {
                setLocalAssigned(prev => [...prev, userId]);
            } else {
                setLocalAssigned(prev => prev.filter(id => id !== userId));
            }
        } catch (err) {
            alert('Failed to update access. Please try again.');
        }
    };

    return (
        <div className="access-control">
            <div className="header">
                <h3>Access for {deviceName}</h3>
                <small className="device-id">ID: {deviceId}</small>
            </div>

            {loadingMembers ? (
                <p>Loading members...</p>
            ) : (
                <div className="members-list">
                    {members
                        .filter(m => !['tenant_admin', 'super_admin'].includes(m.role?.toLowerCase()))
                        .length === 0 ? (
                        <p className="empty-state">No manageable members found.</p>
                    ) : (
                        members
                            .filter(m => !['tenant_admin', 'super_admin'].includes(m.role?.toLowerCase()))
                            .map((member: TenantMember) => {
                                const isAssigned = localAssigned.includes(member.id);
                                const isProcessing = assigning;

                                return (
                                    <div key={member.id} className="member-access-item">
                                        <div className="member-info">
                                            <span className="email">{member.email || member.id}</span>
                                            <span className="role">{member.role?.replace('_', ' ')}</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={isAssigned}
                                                onChange={() => handleToggleAccess(member.id)}
                                                disabled={isProcessing}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                );
                            })
                    )}
                </div>
            )}

            <style jsx>{`
                .access-control {
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 16px;
                    border: 1px solid #e2e8f0;
                }

                .header {
                    margin-bottom: 16px;
                }

                h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #1e293b;
                }

                .device-id {
                    color: #94a3b8;
                    font-size: 12px;
                }

                .members-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .member-access-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #f1f5f9;
                }

                .member-info {
                    display: flex;
                    flex-direction: column;
                }

                .email {
                    font-size: 14px;
                    font-weight: 500;
                    color: #334155;
                }

                .role {
                    font-size: 11px;
                    color: #64748b;
                    text-transform: uppercase;
                }

                .empty-state {
                    font-size: 14px;
                    color: #94a3b8;
                    text-align: center;
                }

                /* Toggle Switch Style */
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                }

                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #cbd5e1;
                    transition: .4s;
                }

                .slider:before {
                    position: absolute;
                    content: "";
                    height: 14px;
                    width: 14px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .4s;
                }

                input:checked + .slider {
                    background-color: #3b82f6;
                }

                input:focus + .slider {
                    box-shadow: 0 0 1px #3b82f6;
                }

                input:checked + .slider:before {
                    transform: translateX(20px);
                }

                .slider.round {
                    border-radius: 20px;
                }

                .slider.round:before {
                    border-radius: 50%;
                }

                input:disabled + .slider {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
