import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = Infinity;
const PAGE_LIMIT = 25;

const COLLECTION_TASKS = 'tasks';
const COLLECTION_CALENDARS = 'calendars';

(async () => {
  console.log(`---`);

  let taskSnapshots = await admin.firestore().collection(COLLECTION_TASKS).limit(PAGE_LIMIT).get();

  let page = 1;
  let updatedCount = 0;
  let totalCount = 0;

  // eslint-disable-next-line no-labels
  outerLoop: while (taskSnapshots.docs.length > 0) {
    console.log(`- Page ${page}: totalCount=${totalCount} updatedCount=${updatedCount}`);

    for (const doc of taskSnapshots.docs) {
      totalCount += 1;

      if (totalCount >= LIMIT) {
        console.log(`Break at limit ${LIMIT}`);
        // eslint-disable-next-line no-labels
        break outerLoop;
      }

      const taskId = doc.id;
      const { calendarBlockCalendarId, calendarBlockProviderCalendarId, completed } = doc.data();

      if (calendarBlockCalendarId == null) {
        // console.log(`⚪️ No changes. calendarBlockCalendarId is null`);
        continue;
      }

      if (calendarBlockProviderCalendarId) {
        console.log(
          `⚪️ No changes. Task ${taskId} with event was fine. calendarBlockProviderCalendarId set to ${calendarBlockProviderCalendarId}`,
        );
        continue;
      }

      const calendarSnapshot = await admin
        .firestore()
        .collection(COLLECTION_CALENDARS)
        .doc(calendarBlockCalendarId)
        .get();
      if (!calendarSnapshot.exists) {
        if (completed) {
          console.log(`❕ Warning. missing calendar for task ${taskId} (but task is completed)`);
        } else {
          console.log(`⚠️ Warning. missing calendar for task ${taskId}`);
        }
        continue;
      }
      const { providerCalendarId } = calendarSnapshot.data();

      await admin.firestore().collection(COLLECTION_TASKS).doc(taskId).update({
        calendarBlockProviderCalendarId: providerCalendarId,
      });
      console.log(
        `✅ Added. Added calendarBlockProviderCalendarId ${providerCalendarId} to task ${taskId} ${
          completed ? '(was completed)' : ''
        }`,
      );
      updatedCount += 1;
    }

    const lastVisible = taskSnapshots.docs[taskSnapshots.docs.length - 1];

    taskSnapshots = await admin
      .firestore()
      .collection(COLLECTION_TASKS)
      .startAfter(lastVisible)
      .limit(PAGE_LIMIT)
      .get();
    page += 1;
  }

  console.log(`---`);
})();
