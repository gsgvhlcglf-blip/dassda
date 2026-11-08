import "server-only";
import { repository } from "../server/persistence/index";
import type { Repositories } from "../server/persistence/contracts";

export const workTerms: Repositories["requests"]["workTerms"] = async (
  ...args
) => (await repository("requests")).workTerms(...args);
export const workReadiness: Repositories["requests"]["workReadiness"] = async (
  ...args
) => (await repository("requests")).workReadiness(...args);
export const saveWorkTerms: Repositories["requests"]["saveWorkTerms"] = async (
  ...args
) => (await repository("requests")).saveWorkTerms(...args);
export const allWorkRequests: Repositories["requests"]["allWorkRequests"] =
  async (...args) => (await repository("requests")).allWorkRequests(...args);
export const workInsights: Repositories["requests"]["workInsights"] = async (
  ...args
) => (await repository("requests")).workInsights(...args);
export const findWorkRequest: Repositories["requests"]["findWorkRequest"] =
  async (...args) => (await repository("requests")).findWorkRequest(...args);
export const workHistory: Repositories["requests"]["workHistory"] = async (
  ...args
) => (await repository("requests")).workHistory(...args);
export const workFiles: Repositories["requests"]["workFiles"] = async (
  ...args
) => (await repository("requests")).workFiles(...args);
export const saveWorkMutation: Repositories["requests"]["saveWorkMutation"] =
  async (...args) => (await repository("requests")).saveWorkMutation(...args);
export const submitWork: Repositories["requests"]["submitWork"] = async (
  ...args
) => (await repository("requests")).submitWork(...args);
export const storeWorkPhotos: Repositories["requests"]["storeWorkPhotos"] =
  async (...args) => (await repository("requests")).storeWorkPhotos(...args);
export const removeWorkPhotos: Repositories["requests"]["removeWorkPhotos"] =
  async (...args) => (await repository("requests")).removeWorkPhotos(...args);
export const discardUnlinkedWorkPhotos: Repositories["requests"]["discardUnlinkedWorkPhotos"] =
  async (...args) =>
    (await repository("requests")).discardUnlinkedWorkPhotos(...args);
export const attachWorkPhotos: Repositories["requests"]["attachWorkPhotos"] =
  async (...args) => (await repository("requests")).attachWorkPhotos(...args);
export const localWorkPhoto: Repositories["requests"]["readPrivateRequestPhoto"] =
  async (...args) =>
    (await repository("requests")).readPrivateRequestPhoto(...args);

export type { PreparedPhoto } from "../server/persistence/contracts";
export {
  boundedForm,
  parseWorkPhotos,
  workFingerprint,
  workSource,
} from "../server/persistence/adapters/existing/requests";
