import React, { useState } from 'react';
import { useMembers, TenantMember } from '../hooks/useMembers';
import { useInviteUser } from '../hooks/useInviteUser';

export default function MemberManagement() {
    const { members, loading: loadingMembers, error: errorMembers } = useMembers();
    const { inviteUser, loading: inviting, error: errorInvite } = useInviteUser();

    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');
    const [success, setSuccess] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccess(false);
        try {
            await inviteUser(email, role);
            setSuccess(true);
            setEmail('');
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            // Error managed by hook
        }
    };

    return (
        <div className="member-management">
            <div className="members-section">
                <h3>Team Members ({members.length})</h3>
                {loadingMembers ? (
                    <p>Loading members...</p>
                ) : (
                    <div className="members-list">
                        {members.map((member: TenantMember) => (
                            <div key={member.id} className="member-item">
                                <div className="member-info">
                                    <span className="member-email">{member.email || member.id}</span>
                                    <span className={`role-tag ${member.role?.toLowerCase()}`}>
                                        {member.role?.replace('_', ' ')}
                                    </span>
                                </div>
                                <small className="joined-date">
                                    Joined: {member.joinedAt?.toDate ? member.joinedAt.toDate().toLocaleDateString() : 'Pending'}
                                </small>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="invite-section">
                <h3>Invite New Member</h3>
                <form onSubmit={handleInvite} className="invite-form">
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={inviting}
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                        disabled={inviting}
                    >
                        <option value="user">User (Control Only)</option>
                        <option value="admin">Admin (Manage & Control)</option>
                    </select>
                    <button type="submit" disabled={inviting}>
                        {inviting ? 'Inviting...' : 'Send Invitation'}
                    </button>
                </form>

                {errorInvite && <div className="error">{errorInvite.message}</div>}
                {success && <div className="success">✓ Invitation sent!</div>}
            </div>

            <style jsx>{`
                .member-management {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 32px;
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                @media (min-width: 992px) {
                    .member-management {
                        grid-template-columns: 1.5fr 1fr;
                    }
                }

                h3 { margin: 0 0 20px 0; font-size: 18px; color: #1a1a1a; }

                .members-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .member-item {
                    padding: 12px;
                    border: 1px solid #edf2f7;
                    border-radius: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .member-info { display: flex; align-items: center; gap: 12px; }
                .member-email { font-size: 14px; color: #4a5568; }

                .role-tag {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .role-tag.admin { background: #ebf8ff; color: #2c5282; }
                .role-tag.tenant_admin { background: #f0fff4; color: #22543d; }
                .role-tag.user { background: #fffaf0; color: #7b341e; }

                .joined-date { color: #a0aec0; font-size: 12px; }

                .invite-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                input, select, button {
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    font-size: 14px;
                }

                button {
                    background: #3182ce;
                    color: white;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                button:hover { background: #2b6cb0; }
                button:disabled { opacity: 0.6; cursor: not-allowed; }

                .error { color: #e53e3e; font-size: 13px; margin-top: 8px; }
                .success { color: #38a169; font-size: 13px; margin-top: 8px; }
            `}</style>
        </div>
    );
}
