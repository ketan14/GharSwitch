import { getAuth } from 'firebase/auth';

const BASE_URL = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'https://us-central1-gharswitch.cloudfunctions.net';

// Function to get the Firebase ID Token
const getAuthToken = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
        return await user.getIdToken();
    }
    throw new Error('User not authenticated');
};

// Helper for authenticated fetch requests
const fetchWithAuth = async (endpoint: string, body: any) => {
    const token = await getAuthToken();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw { response: { data } }; // Mimic axios error structure for the UI
    }

    return data;
};

export const AtombergApi = {
    login: async (apiKey: string, hubNickname: string) => {
        return await fetchWithAuth('/atombergLogin', { apiKey, hubNickname });
    },
    discover: async (hubId: string) => {
        return await fetchWithAuth('/atombergDiscover', { hubId });
    },
    sendCommand: async (hubId: string, deviceId: string, payload: { power?: boolean; speed?: number }) => {
        return await fetchWithAuth('/atombergCommand', { hubId, deviceId, payload });
    }
};
