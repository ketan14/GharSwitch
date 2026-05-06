import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AtombergRegistrationForm } from '../../../modules/atomberg/components/AtombergRegistrationForm';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AddPrivateDevicePage() {
    const { user, role, loading, signOut } = useAuth();
    const router = useRouter();

    if (loading) {
        return <div className="loading-state">Loading...</div>;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

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
                                    <Link href="/user/private-devices/add" className="active-dropdown">Add Private Device</Link>
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
                    <h2>Add Private Device</h2>
                    <p>Connect third-party smart home accounts</p>
                </header>

                <div className="form-container">
                    <AtombergRegistrationForm />
                </div>
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
                .dropdown-content a.active-dropdown { background-color: #ebf8ff; color: #3182ce; font-weight: 500; }

                .user-info { display: flex; align-items: center; gap: 16px; }
                .user-email { color: #6c757d; font-size: 14px; }
                .role-badge { padding: 4px 10px; background: #e9ecef; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                .logout-btn { padding: 8px 16px; background: transparent; color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; cursor: pointer; font-weight: 500; }
                .logout-btn:hover { background: #dc3545; color: white; }
                
                .main-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
                .page-header { margin-bottom: 24px; }
                .page-header h2 { margin: 0 0 4px 0; font-size: 28px; font-weight: 700; color: #1a1a1a; }
                .page-header p { margin: 0; color: #6c757d; font-size: 16px; }
                
                .form-container { margin-top: 32px; }
            `}</style>
        </div>
    );
}
