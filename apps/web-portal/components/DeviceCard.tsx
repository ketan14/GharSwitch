import React from 'react';
import { useDeviceState } from '../hooks/useDeviceState';
import { useSendCommand, SwitchTarget } from '../hooks/useSendCommand';
import { useAuth } from '../context/AuthContext';
import DeviceAccessControl from './DeviceAccessControl';
import { useUpdateSwitchNames } from '../hooks/useUpdateSwitchNames';
import { useUpdateDeviceName } from '../hooks/useUpdateDeviceName';

interface DeviceCardProps {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  status?: 'ONLINE' | 'OFFLINE';
  assignedUsers?: string[];
  switchNames?: string[];
}

export default function DeviceCard({ deviceId, deviceName, deviceType, status, assignedUsers, switchNames }: DeviceCardProps) {
  const { state, loading: stateLoading, pendingSwitches, pendingCountBySwitch } = useDeviceState(deviceId);
  const { sendCommand, loading: commandLoading } = useSendCommand();
  const { role } = useAuth();
  // Normalize role for comparison (handles 'ADMIN' or 'tenant-admin')
  const normalizedRole = role?.toLowerCase().replace('-', '_');
  const canControl = ['super_admin', 'tenant_admin', 'admin', 'user'].includes(normalizedRole || '');

  // Track local loading state for EACH switch independently
  const [localLoading, setLocalLoading] = React.useState<Record<string, boolean>>({});
  const [showAccess, setShowAccess] = React.useState(false);

  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(normalizedRole || '');
  const canEditDeviceName = ['super_admin', 'tenant_admin', 'user'].includes(normalizedRole || '');

  const { updateSwitchNames, loading: updatingNames } = useUpdateSwitchNames();
  const { updateDeviceName, loading: updatingDeviceName } = useUpdateDeviceName();
  const [isEditingNames, setIsEditingNames] = React.useState(false);
  const [editedNames, setEditedNames] = React.useState<string[]>([]);
  const [isEditingDeviceName, setIsEditingDeviceName] = React.useState(false);
  const [editedDeviceName, setEditedDeviceName] = React.useState(deviceName);

  // Initialize editedNames when switchNames prop changes
  React.useEffect(() => {
    const defaultNames = ['Switch 1', 'Switch 2', 'Switch 3', 'Switch 4'];

    // Create a robust copy of switchNames (ensure 4 elements)
    const normalizedNames = defaultNames.map((def, idx) =>
      (switchNames && switchNames[idx]) ? switchNames[idx] : def
    );

    setEditedNames(normalizedNames);
  }, [switchNames]); // runs when props arrive from Firestore

  // Keep local device name in sync when props change (e.g. after Firestore update)
  React.useEffect(() => {
    setEditedDeviceName(deviceName);
  }, [deviceName]);

  const handleSaveNames = async () => {
    try {
      await updateSwitchNames(deviceId, editedNames);
      setIsEditingNames(false);
    } catch (err) {
      alert('Failed to save switch names. Please try again.');
    }
  };

  const handleSaveDeviceName = async () => {
    try {
      await updateDeviceName(deviceId, editedDeviceName);
      setIsEditingDeviceName(false);
    } catch (err) {
      console.error('Failed to save device name:', err);
      alert('Failed to save device name. Please try again.');
    }
  };

  const handleToggle = async (target: SwitchTarget, currentState: boolean) => {
    if (!canControl) return;

    setLocalLoading(prev => ({ ...prev, [target]: true }));
    try {
      await sendCommand(deviceId, target, !currentState);
    } catch (error) {
      console.error('Failed to send command:', error);
      alert('Failed to toggle switch. Please try again.');
    } finally {
      setLocalLoading(prev => {
        const next = { ...prev };
        delete next[target];
        return next;
      });
    }
  };

  const switches: SwitchTarget[] = ['s1', 's2', 's3', 's4'];

  const isOffline = status === 'OFFLINE';
  const pendingCount = pendingSwitches ? Object.keys(pendingSwitches).length : 0;
  const hasPendingSwitches = pendingCount > 0;

  const cardClass = [
    'device-card',
    hasPendingSwitches && 'has-pending',
    isOffline && hasPendingSwitches && 'offline-with-pending'
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div className="device-header">
        <div className="device-header-main">
          {canEditDeviceName ? (
            <div className="device-name-edit">
              {isEditingDeviceName ? (
                <div className="device-name-row">
                  <input
                    className="device-name-input"
                    type="text"
                    value={editedDeviceName}
                    onChange={(e) => setEditedDeviceName(e.target.value)}
                    placeholder="Device name"
                  />
                  <button
                    type="button"
                    className="icon-btn btn-save-device-name"
                    onClick={handleSaveDeviceName}
                    disabled={updatingDeviceName || !editedDeviceName.trim()}
                    title="Save name"
                    aria-label="Save name"
                  >
                    {updatingDeviceName ? '…' : '✓'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn btn-cancel-device-name"
                    onClick={() => {
                      setIsEditingDeviceName(false);
                      setEditedDeviceName(deviceName);
                    }}
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="device-name-row">
                  <h3>{deviceName || deviceId}</h3>
                  <button
                    type="button"
                    className="icon-btn btn-inline-edit"
                    onClick={() => setIsEditingDeviceName(true)}
                    title="Edit device name"
                    aria-label="Edit device name"
                  >
                    ✎
                  </button>
                </div>
              )}
              <div className="device-id-subtle">{deviceId}</div>
            </div>
          ) : (
            <div>
              <h3>{deviceName || deviceId}</h3>
              <div className="device-id-subtle">{deviceId}</div>
            </div>
          )}
        </div>
        <span className={`status-badge ${status?.toLowerCase()}`}>
          {status || 'UNKNOWN'}
        </span>
      </div>

      <div className="device-type">{deviceType}</div>

      {hasPendingSwitches && (
        <div className="pending-banner" role="status">
          <span className="pending-banner-text">
            {pendingCount} command{pendingCount !== 1 ? 's' : ''} queued
            {isOffline && ' — will apply when device is back online'}
          </span>
        </div>
      )}

      <div className="switches-grid">
        {switches.map((switchId, index) => {
          const switchState = state?.switches?.[switchId] ?? false;
          // pendingAction is boolean (true=ON, false=OFF) if pending, or undefined
          const pendingAction = pendingSwitches?.[switchId];
          const isActuallyPending = pendingAction !== undefined;
          const isLoading = localLoading[switchId];
          const isBusy = isActuallyPending || isLoading;

          // Robust Status Text Logic
          let statusText = switchState ? 'ON' : 'OFF';
          if (isActuallyPending) {
            statusText = pendingAction ? 'Turning On...' : 'Turning Off...';
          } else if (isLoading) {
            // Fallback to local intent if Firebase hasn't synced yet
            statusText = !switchState ? 'Turning On...' : 'Turning Off...';
          }

          const pendingCount = pendingCountBySwitch?.[switchId] ?? 0;

          return (
            <div key={switchId} className="switch-container">
              <div className="label-row">
                <label className="switch-label">
                  {switchNames?.[index] || `Switch ${index + 1}`}
                </label>
              </div>
              <button
                className={`switch-button ${switchState ? 'on' : 'off'} ${isBusy ? 'pending' : ''}`}
                onClick={() => handleToggle(switchId, switchState)}
                disabled={!canControl || isLoading || stateLoading || isBusy || isEditingNames}
                title={pendingCount > 0 ? `${pendingCount} command${pendingCount !== 1 ? 's' : ''} queued for this switch` : undefined}
                aria-label={pendingCount > 0 ? `${statusText}, ${pendingCount} queued` : statusText}
              >
                {pendingCount > 0 && (
                  <span className="switch-pending-badge" aria-hidden="true">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
                {statusText}
              </button>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="admin-actions">
          <button
            className={`btn-access ${showAccess ? 'active' : ''}`}
            onClick={() => {
              setShowAccess(!showAccess);
              setIsEditingNames(false); // Close edit mode if opening access
            }}
          >
            {showAccess ? 'Close Access Control' : 'Manage Device Access'}
          </button>

          <button
            className={`btn-edit-names ${isEditingNames ? 'active' : ''}`}
            onClick={() => {
              setIsEditingNames(!isEditingNames);
              setShowAccess(false); // Close access control if editing names
            }}
            disabled={updatingNames}
          >
            {isEditingNames ? 'Cancel Editing' : 'Edit Switch Names'}
          </button>

          {isEditingNames && (
            <div className="edit-names-panel">
              <h4>Update Switch Labels</h4>
              <div className="names-grid">
                {['s1', 's2', 's3', 's4'].map((s, idx) => (
                  <div key={s} className="name-input-group">
                    <label>{s.toUpperCase()}:</label>
                    <input
                      type="text"
                      value={editedNames[idx] || ''}
                      onChange={(e) => {
                        const newNames = [...editedNames];
                        newNames[idx] = e.target.value;
                        setEditedNames(newNames);
                      }}
                      placeholder={`Label for ${s.toUpperCase()}`}
                    />
                  </div>
                ))}
              </div>
              <button
                className="btn-save-names"
                onClick={handleSaveNames}
                disabled={updatingNames}
              >
                {updatingNames ? 'Saving...' : 'Save All Names'}
              </button>
            </div>
          )}

          {showAccess && (
            <div className="access-panel">
              <DeviceAccessControl
                deviceId={deviceId}
                deviceName={deviceName}
                assignedUsers={assignedUsers}
              />
            </div>
          )}
        </div>
      )}

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

        .device-card.has-pending {
          border-color: #bdbdbd;
          background: #fafafa;
        }

        .device-card.offline-with-pending {
          border-color: #9e9e9e;
          background: #f5f5f5;
        }

        .pending-banner {
          padding: 6px 10px;
          margin-bottom: 12px;
          border-radius: 6px;
          background: #eeeeee;
          color: #616161;
          font-size: 12px;
          font-weight: 500;
        }

        .device-card.offline-with-pending .pending-banner {
          background: #e0e0e0;
          color: #424242;
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .device-header-main {
          flex: 1;
          min-width: 0;
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

        .device-name-edit {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .device-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .device-name-input {
          flex: 1;
          padding: 4px 8px;
          font-size: 14px;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .device-id-subtle {
          font-size: 11px;
          color: #94a3b8;
        }

        .icon-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          background: #f5f5f5; /* matches OFF switch */
          color: #666;
          line-height: 1;
        }

        .icon-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-inline-edit {
          /* uses .icon-btn base */
        }

        .btn-save-device-name {
          background: #4caf50; /* matches ON switch */
          border-color: #4caf50;
          color: white;
        }

        .btn-cancel-device-name {
          background: #f5f5f5;
          border-color: #e0e0e0;
          color: #666;
        }

        .device-type {
          color: #666;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .admin-actions {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        .btn-access {
          width: 100%;
          padding: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-access:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .btn-access.active {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .access-panel {
          margin-top: 12px;
        }

        .btn-edit-names {
          width: 100%;
          padding: 10px;
          margin-top: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-edit-names:hover:not(:disabled) {
          background: #f1f5f9;
        }

        .btn-edit-names.active {
          background: #64748b;
          color: white;
          border-color: #64748b;
        }

        .edit-names-panel {
          margin-top: 16px;
          padding: 16px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
        }

        .edit-names-panel h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #334155;
        }

        .names-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        .name-input-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .name-input-group label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          width: 30px;
        }

        .name-input-group input {
          flex: 1;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 13px;
        }

        .btn-save-names {
          width: 100%;
          padding: 10px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-save-names:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-save-names:disabled {
          opacity: 0.5;
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
          position: relative;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .switch-pending-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.35);
          color: white;
          line-height: 1;
        }

        .switch-button.pending .switch-pending-badge {
          background: #616161;
        }

        .switch-button.on {
          background: #4caf50;
          color: white;
        }

        .switch-button.off {
          background: #f5f5f5;
          color: #666;
        }

        .switch-button.pending {
          background: #bdbdbd !important;
          color: #616161 !important;
          cursor: wait;
        }

        .switch-button.pending.on {
          background: #9e9e9e !important;
          color: #757575 !important;
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
