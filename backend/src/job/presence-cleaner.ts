// src/jobs/presence-cleaner.ts
import cron from 'node-cron';
import { db } from '../database/db-promise';

// รันทุก 1 นาที ตามเวลา Asia/Bangkok
cron.schedule('* * * * *', async () => {
  try {
    await db.none(
      `UPDATE public.users
          SET is_online = FALSE
        WHERE is_online = TRUE
          AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '10 minutes')`
    );
    // console.log('[presence-cleaner] done');
  } catch (e) {
    console.error('[presence-cleaner] error:', e);
  }
}, {
  timezone: 'Asia/Bangkok'
});
