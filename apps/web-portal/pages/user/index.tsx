import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDevices } from '../../hooks/useDevices';
import DeviceCard from '../../components/DeviceCard';
import { useRouter } from 'next/router';

export default function UserDashboard() {
    const { user, role, loading, signOut } = useAuth();
    const { devices, loading: devicesLoading } = useDevices();
    const router = useRouter();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading your dashboard...</p>
                <style jsx>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #666;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="dashboard-page">
            <header className="header">
                <div className="header-content">
                    <h1>GharSwitch Pro</h1>
                    <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        <span className={`role-badge ${role?.toLowerCase()}`}>{role?.replace('_', ' ')}</span>
                        <button onClick={signOut} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                <header className="page-header">
                    <h2>Your Devices</h2>
                    <p>Control your switches in real-time</p>
                </header>

                {devicesLoading ? (
                    <div className="loading-state">Fetching devices...</div>
                ) : devices.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔌</div>
                        <h3>No devices found</h3>
                        <p>Once your administrator registers a device, it will appear here.</p>
                    </div>
                ) : (
                    <div className="device-grid">
                        {devices.map((device) => (
                            <DeviceCard
                                key={device.id}
                                deviceId={device.id}
                                deviceName={device.name}
                                deviceType={device.type}
                                status={device.status}
                            />
                        ))}
                    </div>
                )}
            </main>

            <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: 'Inter', sans-serif;
        }

        .header {
          background: white;
          border-bottom: 1px solid #e9ecef;
          padding: 16px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
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
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          background: linear-gradient(135deg, #3498db, #2980b9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .user-email {
          color: #6c757d;
          font-size: 14px;
          display: none;
        }

        @media (min-width: 640px) {
          .user-email {
            display: block;
          }
        }

        .role-badge {
          padding: 4px 10px;
          background: #e9ecef;
          color: #495057;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .role-badge.super_admin { background: #fee2e2; color: #991b1b; }
        .role-badge.tenant_admin { background: #dcfce7; color: #166534; }
        .role-badge.user { background: #dbeafe; color: #1e40af; }

        .logout-btn {
          padding: 8px 16px;
          background: transparent;
          color: #dc3545;
          border: 1px solid #dc3545;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: #dc3545;
          color: white;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h2 {
          margin: 0 0 4px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .page-header p {
          margin: 0;
          color: #6c757d;
          font-size: 16px;
        }

        .device-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .loading-state {
          text-align: center;
          padding: 48px;
          color: #6c757d;
        }

        .empty-state {
          text-align: center;
          padding: 80px 24px;
          background: white;
          border-radius: 16px;
          border: 2px dashed #e9ecef;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a1a1a;
        }

        .empty-state p {
          margin: 0 auto;
          max-width: 320px;
          color: #6c757d;
        }
      `}</style>
        </div>
    );
}
