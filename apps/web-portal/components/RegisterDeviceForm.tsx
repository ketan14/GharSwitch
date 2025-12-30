import React, { useState } from 'react';
import { useRegisterDevice } from '../hooks/useRegisterDevice';

export default function RegisterDeviceForm() {
    const [deviceId, setDeviceId] = useState('');
    const [claimCode, setClaimCode] = useState('');
    const [success, setSuccess] = useState(false);
    const { registerDevice, loading, error } = useRegisterDevice();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccess(false);

        try {
            await registerDevice(deviceId, claimCode);
            setSuccess(true);
            setDeviceId('');
            setClaimCode('');

            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            // Error is handled by the hook
        }
    };

    return (
        <div className="register-form">
            <h2>Register New Device</h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="deviceId">Device ID</label>
                    <input
                        id="deviceId"
                        type="text"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        placeholder="e.g., ESP32_ABC123"
                        required
                        disabled={loading}
                    />
                    <small>The unique identifier printed on your device</small>
                </div>

                <div className="form-group">
                    <label htmlFor="claimCode">Claim Code</label>
                    <input
                        id="claimCode"
                        type="text"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value)}
                        placeholder="Enter claim code"
                        required
                        disabled={loading}
                    />
                    <small>The security code provided with your device</small>
                </div>

                {error && (
                    <div className="error-message">
                        {error.message || 'Failed to register device'}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        ✓ Device registered successfully!
                    </div>
                )}

                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? 'Registering...' : 'Register Device'}
                </button>
            </form>

            <style jsx>{`
        .register-form {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 500px;
        }

        .register-form h2 {
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

        .form-group input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #4caf50;
        }

        .form-group input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .form-group small {
          display: block;
          margin-top: 4px;
          color: #666;
          font-size: 12px;
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
          padding: 12px;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .submit-btn {
          width: 100%;
          padding: 12px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #45a049;
        }

        .submit-btn:disabled {
          background: #9e9e9e;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}
