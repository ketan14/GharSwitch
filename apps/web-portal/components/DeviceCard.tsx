import React from 'react';
import { useDeviceState } from '../hooks/useDeviceState';
import { useSendCommand, SwitchTarget } from '../hooks/useSendCommand';
import { useAuth } from '../context/AuthContext';

interface DeviceCardProps {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  status?: 'ONLINE' | 'OFFLINE';
}

export default function DeviceCard({ deviceId, deviceName, deviceType, status }: DeviceCardProps) {
  const { state, loading: stateLoading } = useDeviceState(deviceId);
  const { sendCommand, loading: commandLoading } = useSendCommand();
  const { role } = useAuth();
  // Normalize role for comparison (handles 'ADMIN' or 'tenant-admin')
  const normalizedRole = role?.toLowerCase().replace('-', '_');
  const canControl = ['super_admin', 'tenant_admin', 'admin', 'user'].includes(normalizedRole || '');

  console.log(`DeviceCard [${deviceId}] Debug:`, {
    canControl,
    commandLoading,
    stateLoading,
    role,
    normalizedRole,
    stateExists: !!state
  });

  const handleToggle = async (target: SwitchTarget, currentState: boolean) => {
    if (!canControl) return;

    try {
      await sendCommand(deviceId, target, !currentState);
    } catch (error) {
      console.error('Failed to send command:', error);
      alert('Failed to toggle switch. Please try again.');
    }
  };

  const switches: SwitchTarget[] = ['s1', 's2', 's3', 's4'];

  const isOffline = status === 'OFFLINE';

  return (
    <div className="device-card">
      <div className="device-header">
        <h3>{deviceName}</h3>
        <span className={`status-badge ${status?.toLowerCase()}`}>
          {status || 'UNKNOWN'}
        </span>
      </div>

      <div className="device-type">{deviceType}</div>

      <div className="switches-grid">
        {switches.map((switchId, index) => {
          const switchState = state?.switches?.[switchId] ?? false;

          return (
            <div key={switchId} className="switch-container">
              <label className="switch-label">Switch {index + 1}</label>
              <button
                className={`switch-button ${switchState ? 'on' : 'off'}`}
                onClick={() => handleToggle(switchId, switchState)}
                disabled={!canControl || commandLoading || stateLoading || isOffline}
              >
                {switchState ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>

      {(state?.diagnostics || !canControl || stateLoading || isOffline) && (
        <div className="diagnostics">
          {isOffline && <div style={{ color: '#d32f2f', fontWeight: 600 }}>Device is Offline</div>}
          {!isOffline && !canControl && <div style={{ color: 'red' }}>Role "{role}" not authorized</div>}
          {!isOffline && stateLoading && <div style={{ color: 'blue' }}>Syncing with device...</div>}

          {state?.diagnostics && (
            <small>
              Signal: {state.diagnostics.rssi}dBm |
              Uptime: {Math.floor(state.diagnostics.uptime / 60)}m
            </small>
          )}
        </div>
      )}

      <style jsx>{`
        .device-card {
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .device-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.online {
          background: #4caf50;
          color: white;
        }

        .status-badge.offline {
          background: #9e9e9e;
          color: white;
        }

        .device-type {
          color: #666;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .switches-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .switch-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .switch-label {
          font-size: 13px;
          color: #666;
        }

        .switch-button {
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .switch-button.on {
          background: #4caf50;
          color: white;
        }

        .switch-button.off {
          background: #f5f5f5;
          color: #666;
        }

        .switch-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .switch-button:not(:disabled):hover {
          transform: scale(1.05);
        }

        .diagnostics {
          padding-top: 12px;
          border-top: 1px solid #f0f0f0;
          color: #999;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
