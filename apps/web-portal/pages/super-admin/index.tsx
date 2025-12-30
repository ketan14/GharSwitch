import React from 'react';
import { useAuth } from '../../context/AuthContext';
import CreateTenantForm from '../../components/CreateTenantForm';
import { useRouter } from 'next/router';

export default function SuperAdminPage() {
    const { user, role, loading, signOut } = useAuth();
    const router = useRouter();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    // Only super admins can access this page
    if (role !== 'super_admin') {
        router.push('/login');
        return null;
    }

    return (
        <div className="super-admin-page">
            <header className="header">
                <div className="header-content">
                    <h1>Super Admin Dashboard</h1>
                    <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        <span className="user-role">SUPER ADMIN</span>
                        <button onClick={signOut} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                <div className="welcome-section">
                    <h2>Welcome, Super Administrator</h2>
                    <p>You have full access to create and manage tenants across the platform.</p>
                </div>

                <div className="admin-grid">
                    <div className="section">
                        <CreateTenantForm />
                    </div>

                    <div className="section info-panel">
                        <h3>Platform Overview</h3>
                        <div className="info-card">
                            <h4>Tenant Management</h4>
                            <p>Create new tenants with dedicated admin accounts. Each tenant is isolated with its own devices and users.</p>
                        </div>

                        <div className="info-card">
                            <h4>Subscription Tiers</h4>
                            <ul>
                                <li><strong>BASIC:</strong> 10 devices, 5 users</li>
                                <li><strong>PRO:</strong> 50 devices, 20 users</li>
                            </ul>
                        </div>

                        <div className="info-card">
                            <h4>Quick Actions</h4>
                            <ul>
                                <li>Create tenant → Admin receives credentials</li>
                                <li>Admin logs in → Registers devices</li>
                                <li>Users control switches in real-time</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
        .super-admin-page {
          min-height: 100vh;
          background: #f5f5f5;
        }

        .header {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 20px;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .user-email {
          color: #666;
          font-size: 14px;
        }

        .user-role {
          padding: 4px 12px;
          background: #9c27b0;
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .logout-btn {
          padding: 8px 16px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .logout-btn:hover {
          background: #d32f2f;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .welcome-section {
          background: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .welcome-section h2 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }

        .welcome-section p {
          margin: 0;
          color: #666;
        }

        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .info-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .info-panel h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
        }

        .info-card {
          margin-bottom: 20px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .info-card h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #9c27b0;
        }

        .info-card p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .info-card ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .info-card li {
          color: #666;
          font-size: 14px;
          margin: 4px 0;
        }

        @media (max-width: 768px) {
          .admin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
}
