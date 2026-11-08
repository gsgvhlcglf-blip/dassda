import "server-only";
import { repository } from "../../server/persistence/index";
import type { Repositories } from "../../server/persistence/contracts";

export const getPaymentSettings: Repositories["payments"]["getPaymentSettings"] =
  async (...args) => (await repository("payments")).getPaymentSettings(...args);
export const setPaymentSettings: Repositories["payments"]["setPaymentSettings"] =
  async (...args) => (await repository("payments")).setPaymentSettings(...args);
export const findPayment: Repositories["payments"]["findPayment"] = async (
  ...args
) => (await repository("payments")).findPayment(...args);
export const paymentOrder: Repositories["payments"]["paymentOrder"] = async (
  ...args
) => (await repository("payments")).paymentOrder(...args);
export const expirePayments: Repositories["payments"]["expirePayments"] =
  async (...args) => (await repository("payments")).expirePayments(...args);
export const preparePayment: Repositories["payments"]["preparePayment"] =
  async (...args) => (await repository("payments")).preparePayment(...args);
export const readyPayment: Repositories["payments"]["readyPayment"] = async (
  ...args
) => (await repository("payments")).readyPayment(...args);
export const initializationFailed: Repositories["payments"]["initializationFailed"] =
  async (...args) =>
    (await repository("payments")).initializationFailed(...args);
export const settlePayment: Repositories["payments"]["settlePayment"] = async (
  ...args
) => (await repository("payments")).settlePayment(...args);
export const paymentLedger: Repositories["payments"]["paymentLedger"] = async (
  ...args
) => (await repository("payments")).paymentLedger(...args);
