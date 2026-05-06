import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useDevices } from '../../../hooks/useDevices';
import { FanControlCard } from '../../../modules/atomberg/components/FanControlCard';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function PrivateDevicesPage() {
    const { user, role, loading, signOut } = useAuth();
    const { devices, loading: devicesLoading } = useDevices();
    const router = useRouter();

    if (loading) {
        return <div className="loading-state">Loading...</div>;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    // Filter only ATOMBERG devices (or whatever is considered private)
    const privateDevices = devices.filter(d => (d as any).provider === 'ATOMBERG' || (d as any).type === 'FAN');

    return (
        <div className="dashboard-page">
            <header className="header">
                <div className="header-content">
                    <div className="nav-brand">
                        <Link href="/user"><h1>GharSwitch Pro</h1></Link>
                        <nav className="navbar">
                            <Link href="/user" className="nav-link">Global Devices</Link>
                            <div className="dropdown">
                                <span className="nav-link active">Private Devices ▾</span>
                                <div className="dropdown-content">
                                    <Link href="/user/private-devices">Show Private Devices</Link>
                                    <Link href="/user/private-devices/add">Add Private Device</Link>
                                </div>
                            </div>
                        </nav>
                    </div>
                    <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        <span className={`role-badge ${role?.toLowerCase()}`}>{role?.replace('_', ' ')}</span>
                        <button onClick={signOut} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                <header className="page-header">
                    <h2>Private Devices</h2>
                    <p>Manage your personal smart devices and integrations</p>
                </header>

                <div className="actions-bar">
                    <button onClick={() => router.push('/user/private-devices/add')} className="add-btn">
                        + Add Private Device
                    </button>
                </div>

                {devicesLoading ? (
                    <div className="loading-state">Fetching devices...</div>
                ) : privateDevices.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🏠</div>
                        <h3>No private devices</h3>
                        <p>You haven't linked any personal smart devices yet.</p>
                        <button onClick={() => router.push('/user/private-devices/add')} className="add-btn mt-4">
                            Link a Device
                        </button>
                    </div>
                ) : (
                    <div className="device-grid">
                        {privateDevices.map((device) => (
                            <FanControlCard
                                key={device.id}
                                hubId={(device as any).hubId || 'unknown'}
                                deviceId={device.id}
                                deviceName={device.name}
                            />
                        ))}
                    </div>
                )}
            </main>

            <style jsx>{`
                .dashboard-page { min-height: 100vh; background: #f8f9fa; font-family: 'Inter', sans-serif; }
                .header { background: white; border-bottom: 1px solid #e9ecef; padding: 16px 24px; position: sticky; top: 0; z-index: 100; }
                .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
                .nav-brand { display: flex; align-items: center; gap: 32px; }
                .nav-brand h1 { margin: 0; font-size: 20px; font-weight: 700; color: #1a1a1a; cursor: pointer; }
                
                .navbar { display: flex; gap: 24px; align-items: center; }
                .nav-link { text-decoration: none; color: #4a5568; font-weight: 500; font-size: 15px; transition: color 0.2s; cursor: pointer; }
                .nav-link:hover, .nav-link.active { color: #3182ce; }
                
                .dropdown { position: relative; display: inline-block; }
                .dropdown::after { content: ''; position: absolute; bottom: -10px; left: 0; width: 100%; height: 10px; }
                .dropdown-content {
                    display: none; position: absolute; background-color: white; min-width: 200px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.1); z-index: 1; border-radius: 8px; margin-top: 8px; overflow: hidden; top: 100%;
                }
                .dropdown:hover .dropdown-content { display: block; }
                .dropdown-content a { color: #4a5568; padding: 12px 16px; text-decoration: none; display: block; font-size: 14px; }
                .dropdown-content a:hover { background-color: #f7fafc; color: #3182ce; }

                .user-info { display: flex; align-items: center; gap: 16px; }
                .user-email { color: #6c757d; font-size: 14px; }
                .role-badge { padding: 4px 10px; background: #e9ecef; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                .logout-btn { padding: 8px 16px; background: transparent; color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; cursor: pointer; font-weight: 500; }
                .logout-btn:hover { background: #dc3545; color: white; }
                
                .main-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
                .page-header { margin-bottom: 24px; }
                .page-header h2 { margin: 0 0 4px 0; font-size: 28px; font-weight: 700; color: #1a1a1a; }
                .page-header p { margin: 0; color: #6c757d; font-size: 16px; }
                
                .actions-bar { margin-bottom: 24px; }
                .add-btn { background: #3182ce; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
                .add-btn:hover { background: #2b6cb0; }
                .mt-4 { margin-top: 16px; }

                .device-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
                .loading-state, .empty-state { text-align: center; padding: 48px; color: #6c757d; }
                .empty-state { background: white; border-radius: 16px; border: 2px dashed #e9ecef; padding: 80px 24px; }
                .empty-icon { font-size: 48px; margin-bottom: 16px; }
                .empty-state h3 { margin: 0 0 8px 0; font-size: 20px; color: #1a1a1a; }
            `}</style>
        </div>
    );
}
