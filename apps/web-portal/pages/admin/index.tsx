import React from 'react';
import { useAuth } from '../../context/AuthContext';
import DeviceList from '../../components/DeviceList';
import RegisterDeviceForm from '../../components/RegisterDeviceForm';
import { useRouter } from 'next/router';

export default function AdminPage() {
    const { user, tenantId, role, loading, signOut } = useAuth();
    const router = useRouter();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    // Only admins can access this page
    if (role !== 'ADMIN' && role !== 'admin') {
        router.push('/user');
        return null;
    }

    return (
        <div className="admin-page">
            <header className="header">
                <div className="header-content">
                    <h1>Admin Dashboard</h1>
                    <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        <span className="user-role">{role}</span>
                        <button onClick={signOut} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                <div className="admin-grid">
                    <div className="section">
                        <RegisterDeviceForm />
                    </div>

                    <div className="section full-width">
                        <DeviceList />
                    </div>
                </div>
            </main>

            <style jsx>{`
        .admin-page {
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
          background: #ff9800;
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
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

        .admin-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .section.full-width {
          grid-column: 1 / -1;
        }

        @media (min-width: 768px) {
          .admin-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
        </div>
    );
}
