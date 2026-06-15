import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getEnv } from './env.js';

let _queue: Queue | null = null;
let _redisConnection: Redis | null = null;

export function getJobsQueue() {
    if (!_queue) {
        _redisConnection = new Redis(getEnv().REDIS_URL, {
            maxRetriesPerRequest: null, // Required by BullMQ
            lazyConnect: true,
        });
        _queue = new Queue('scrape-jobs', {
            connection: _redisConnection as any,
            skipVersionCheck: true,
        });
    }
    return _queue;
}

export async function closeJobsQueue() {
    if (_queue) {
        await _queue.close();
        _queue = null;
    }
    if (_redisConnection) {
        await _redisConnection.quit();
        _redisConnection = null;
    }
}