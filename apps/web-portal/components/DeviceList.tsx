import React from 'react';
import { useDevices } from '../hooks/useDevices';
import DeviceCard from './DeviceCard';

export default function DeviceList() {
  const { devices, loading, error } = useDevices();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading devices...</p>

        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: #666;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4caf50;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error loading devices: {error.message}</p>

        <style jsx>{`
          .error-container {
            padding: 20px;
            background: #ffebee;
            border-radius: 8px;
            color: #c62828;
          }
        `}</style>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Devices Found</h3>
        <p>Register your first device to get started.</p>

        <style jsx>{`
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
          }

          .empty-state h3 {
            margin-bottom: 8px;
            color: #333;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="device-list">
      <h2>My Devices ({devices.length})</h2>

      <div className="devices-grid">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            deviceId={device.id}
            deviceName={device.name}
            deviceType={device.type}
            status={device.status as 'ONLINE' | 'OFFLINE' | undefined}
          />
        ))}
      </div>

      <style jsx>{`
        .device-list {
          padding: 20px;
        }

        .device-list h2 {
          margin-bottom: 24px;
          font-size: 24px;
          font-weight: 600;
        }

        .devices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        @media (max-width: 768px) {
          .devices-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
