export interface DailyUsage {
    id: string; // "tnt_123_2023-10-27"
    tenantId: string;
    date: string;
    requestCount: number;
    limit: number;
}
