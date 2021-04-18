import admin from 'firebase-admin';
import dotenv from 'dotenv';

import { utcToZonedTime } from 'date-fns-tz';
import format from 'date-fns/format';
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = 1000;
const TIME_FORMAT = 'HH:mm';

const getTaskById = async (taskId) => {
  const snapshot = await admin.firestore().collection('tasks').doc(taskId).get();
  return snapshot.exists ? snapshot.data() : undefined;
};

const getUserExternalConfig = async (userId) => {
  const snapshot = await admin.firestore().collection('userExternalConfigs').doc(userId).get();
  return snapshot.exists ? snapshot.data() : undefined;
};

const getTimeZone = async (recurringConfig) => {
  if (!recurringConfig.userId) {
    throw new Error('Recurring config has no userId');
  }
  const userExternalConfig = await getUserExternalConfig(recurringConfig.userId);
  if (!userExternalConfig) {
    throw new Error('Unable to migrate because missing user external config');
  }
  const { timeZone } = userExternalConfig;
  if (!timeZone) {
    throw new Error('Unable to migrate because missing time zone');
  }
  return timeZone;
};

const migrateRecurringConfig = async (recurringConfig, timeZone) => {
  if (!recurringConfig.mostRecentTaskId) {
    throw new Error('Recurring config has no mostRecentTaskId');
  }
  const task = await getTaskById(recurringConfig.mostRecentTaskId);
  if (!task) {
    throw new Error('Unable to migrate because missing task');
  }

  const migratedRecurringConfig = { ...recurringConfig };

  if (migratedRecurringConfig.referenceDate == null) {
    if (!task.scheduledStart) {
      throw new Error('Unable to migrate because missing scheduled start');
    }
    migratedRecurringConfig.referenceDate = task.scheduledStart;
  }
  if (migratedRecurringConfig.taskDetails == null) {
    const { userId } = recurringConfig;
    if (!userId) {
      throw new Error('Unable to migrate because missing user ID');
    }

    migratedRecurringConfig.taskDetails = {
      title: task.title,
      description: task.description,
      effort: task.effort,
      impact: task.impact,
      scheduledTime: format(
        utcToZonedTime(migratedRecurringConfig.referenceDate, timeZone),
        TIME_FORMAT,
      ),
      dueOffsetDays: task.due
        ? differenceInCalendarDays(task.due, migratedRecurringConfig.referenceDate)
        : null,
      dueTime: task.due ? format(utcToZonedTime(task.due, timeZone), TIME_FORMAT) : null,
    };
  }

  return migratedRecurringConfig;
};

(async () => {
  console.log(`---`);

  const snapshots = await admin.firestore().collection('recurringConfigs').limit(LIMIT).get();
  const recurringConfigs = snapshots.docs.map((doc) => [doc.id, doc.data()]);

  console.log(`${recurringConfigs.length} recurring configs retrieved`);

  for (const [rcId, recurringConfig] of recurringConfigs) {
    try {
      if (recurringConfig.referenceDate && recurringConfig.taskDetails) {
        console.log(`🤍  No changes needed for ${rcId}`);
        continue;
      }

      const timeZone = await getTimeZone(recurringConfig);

      const migrated = await migrateRecurringConfig(recurringConfig, timeZone);
      console.log(
        `✅  Migrated ${rcId}`,
        migrated.referenceDate,
        migrated.taskDetails.scheduledTime,
        timeZone,
      );

      // @todo: actually save the change
    } catch (error) {
      console.error(`🔥  Error ${rcId} ${error.message}`);
    }
  }
  console.log(`---`);
})();
