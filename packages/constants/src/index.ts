export const PLAN_LIMITS = {
    BRONZE: {
        ID: 'bronze',
        MAX_REQUESTS_PER_DAY: 100,
        MAX_SWITCHES_PER_DEVICE: 4,
        // Free 3 months logic is handled in Stripe/Billing, not here physically
    },
    SILVER: {
        ID: 'silver',
        MAX_REQUESTS_PER_DAY: 250,
        MAX_SWITCHES_PER_DEVICE: 8,
    },
    GOLD: {
        ID: 'gold',
        MAX_REQUESTS_PER_DAY: 500,
        MAX_SWITCHES_PER_DEVICE: 16,
    }
} as const;

export const DB_PATHS = {
    FIRESTORE: {
        TENANTS: 'tenants',
        USERS: 'users',
        DEVICES: 'devices',
        DEVICE_TYPES: 'deviceTypes',
        DEVICE_USERS: 'deviceUsers',
        USAGE_COUNTERS: 'usageCounters',
    },
    RTDB: {
        DEVICE_STATES: 'device_states',
        DEVICE_COMMANDS: 'device_commands',
        DEVICE_STATUS: 'device_status',
    }
} as const;
