import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const PAGE_LIMIT = 25;

const COLLECTION_TASKS = 'tasks';
const COLLECTION_CALENDARS = 'calendars';

(async () => {
  console.log(`---`);

  let taskSnapshots = await admin.firestore().collection(COLLECTION_TASKS).limit(PAGE_LIMIT).get();

  let page = 1;
  let updatedCount = 0;
  let totalCount = 0;

  while (taskSnapshots.docs.length > 0) {
    console.log(`- Page ${page}: totalCount=${totalCount} updatedCount=${updatedCount}`);

    for (const doc of taskSnapshots.docs) {
      totalCount += 1;

      const taskId = doc.id;
      const { calendarBlockCalendarId, calendarBlockProviderCalendarId, completed } = doc.data();

      if (calendarBlockCalendarId == null) {
        // console.log(`⚪️ No changes. calendarBlockCalendarId is null`);
        continue;
      }

      if (calendarBlockProviderCalendarId) {
        console.log(
          `⚪️ No changes. task ${taskId} calendarBlockProviderCalendarId set to ${calendarBlockProviderCalendarId}`,
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
