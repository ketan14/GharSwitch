import React, { useState } from 'react';
import { useCreateTenant } from '../hooks/useCreateTenant';

export default function CreateTenantForm() {
    const [tenantName, setTenantName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [tier, setTier] = useState<'BASIC' | 'PRO'>('BASIC');
    const [success, setSuccess] = useState<any>(null);

    const { createTenant, loading, error } = useCreateTenant();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccess(null);

        try {
            const result = await createTenant(tenantName, adminEmail, adminPassword, tier);
            setSuccess(result);

            // Clear form
            setTenantName('');
            setAdminEmail('');
            setAdminPassword('');
            setTier('BASIC');

            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            // Error handled by hook
        }
    };

    return (
        <div className="create-tenant-form">
            <h2>Create New Tenant</h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="tenantName">Tenant Name</label>
                    <input
                        id="tenantName"
                        type="text"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        placeholder="e.g., Acme Corporation"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="adminEmail">Admin Email</label>
                    <input
                        id="adminEmail"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@example.com"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="adminPassword">Admin Password</label>
                    <input
                        id="adminPassword"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        minLength={6}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="tier">Subscription Tier</label>
                    <select
                        id="tier"
                        value={tier}
                        onChange={(e) => setTier(e.target.value as 'BASIC' | 'PRO')}
                        disabled={loading}
                    >
                        <option value="BASIC">BASIC (10 devices, 5 users)</option>
                        <option value="PRO">PRO (50 devices, 20 users)</option>
                    </select>
                </div>

                {error && (
                    <div className="error-message">
                        {error.message || 'Failed to create tenant'}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        <strong>✓ Tenant Created Successfully!</strong>
                        <div className="success-details">
                            <p>Tenant ID: <code>{success.tenantId}</code></p>
                            <p>Admin Email: <code>{success.adminEmail}</code></p>
                            <p>Admin can now login and start using the platform.</p>
                        </div>
                    </div>
                )}

                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? 'Creating Tenant...' : 'Create Tenant'}
                </button>
            </form>

            <style jsx>{`
        .create-tenant-form {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 600px;
        }

        .create-tenant-form h2 {
          margin: 0 0 24px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
          color: #333;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #9c27b0;
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          color: #c62828;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .success-message {
          padding: 16px;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .success-message strong {
          display: block;
          margin-bottom: 12px;
        }

        .success-details {
          margin-top: 8px;
        }

        .success-details p {
          margin: 4px 0;
        }

        .success-details code {
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 13px;
        }

        .submit-btn {
          width: 100%;
          padding: 12px;
          background: #9c27b0;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #7b1fa2;
        }

        .submit-btn:disabled {
          background: #9e9e9e;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}
