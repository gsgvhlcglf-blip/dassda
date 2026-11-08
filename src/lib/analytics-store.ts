import "server-only";
import { repository } from "../server/persistence/index";
import type { Repositories } from "../server/persistence/contracts";

export const getAnalyticsSettings: Repositories["analytics"]["getAnalyticsSettings"] =
  async (...args) =>
    (await repository("analytics")).getAnalyticsSettings(...args);
export const setAnalyticsSettings: Repositories["analytics"]["setAnalyticsSettings"] =
  async (...args) =>
    (await repository("analytics")).setAnalyticsSettings(...args);
export const appendAnalyticsEvents: Repositories["analytics"]["appendAnalyticsEvents"] =
  async (...args) =>
    (await repository("analytics")).appendAnalyticsEvents(...args);
export const getAnalyticsReport: Repositories["analytics"]["getAnalyticsReport"] =
  async (...args) =>
    (await repository("analytics")).getAnalyticsReport(...args);
export const getAnalyticsHeatmap: Repositories["analytics"]["getAnalyticsHeatmap"] =
  async (...args) =>
    (await repository("analytics")).getAnalyticsHeatmap(...args);
export const clearAnalyticsEvents: Repositories["analytics"]["clearAnalyticsEvents"] =
  async (...args) =>
    (await repository("analytics")).clearAnalyticsEvents(...args);
