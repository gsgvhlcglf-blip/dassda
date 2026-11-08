import "server-only";
import { repository } from "../server/persistence/index";
import type { Repositories } from "../server/persistence/contracts";

export const publishedDesign: Repositories["workspace"]["publishedDesign"] =
  async (...args) => (await repository("workspace")).publishedDesign(...args);
export const getWorkspace: Repositories["workspace"]["getWorkspace"] = async (
  ...args
) => (await repository("workspace")).getWorkspace(...args);
export const saveWorkspace: Repositories["workspace"]["saveWorkspace"] = async (
  ...args
) => (await repository("workspace")).saveWorkspace(...args);
export const publishWorkspace: Repositories["workspace"]["publishWorkspace"] =
  async (...args) => (await repository("workspace")).publishWorkspace(...args);

export { validatedSnapshot } from "../server/persistence/adapters/existing/workspace";
