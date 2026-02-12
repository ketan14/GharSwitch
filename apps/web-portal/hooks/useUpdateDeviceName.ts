import { useState } from 'react';
import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

export function useUpdateDeviceName() {
  const [loading, setLoading] = useState(false);

  const updateDeviceName = async (deviceId: string, name: string) => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'updateDeviceName');
      await fn({ deviceId, name });
    } finally {
      setLoading(false);
    }
  };

  return { updateDeviceName, loading };
}

