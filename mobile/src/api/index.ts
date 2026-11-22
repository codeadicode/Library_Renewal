import { isApiMode } from '../config';
import { httpApi } from './httpClient';
import { mockApi } from './mockStore';
import type { LibraryApi } from './types';

/**
 * The one API object screens use. With EXPO_PUBLIC_API_URL set, every call
 * goes to the backend and failures surface as errors. There is no silent
 * fallback to mock data in API mode.
 */
export const api: LibraryApi = isApiMode ? httpApi : mockApi;

export type { LibraryApi, PublicStudent, BookQuery } from './types';
export { session, ApiError } from './httpClient';
