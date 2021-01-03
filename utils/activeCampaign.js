import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Utils
export const buildUrl = (path) => `${process.env.AC_API_URL}/api/3${path}`;

export const apiHeader = {
  'Api-Token': process.env.AC_API_KEY,
};

// Requests
export const postRequest = (endpoint, headers, body) =>
  fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).then((res) => res.json());

export const createContact = async (contact) =>
  postRequest(buildUrl('/contacts'), apiHeader, contact);
export const addContactToList = async (contactList) =>
  postRequest(buildUrl('/contactLists'), apiHeader, contactList);
export const addTagToUser = async (contactTag) =>
  postRequest(buildUrl('/contactTags'), apiHeader, contactTag);

// Constants
// Custom Lists
export const MAIN_LIST_ID = '1';
export const DEV_LIST_ID = '2';

// Custom Tags
export const SIGNED_PASSWORD_TAG_ID = '1';
export const SIGNED_GOOGLE_TAG_ID = '2';

// Custom Fields
export const CALENDARS_FIELD_ID = '1';
