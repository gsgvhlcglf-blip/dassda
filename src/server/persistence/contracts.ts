import type { Row, Table } from "@/lib/types";
import type { SiteSnapshot, Workspace } from "@/lib/site-version";
import type {
  RequestTerms,
  WorkRequest,
  RequestFile,
  RequestEvent,
  RequestInsights,
} from "@/lib/requests";
import type {
  AnalyticsEvent,
  AnalyticsSettings,
  AnalyticsReport,
  HeatmapReport,
} from "@/lib/analytics";
import type {
  PaymentAttempt,
  PaymentOrder,
  PaymentSettings,
} from "@/lib/payments/types";
import type { z } from "zod";
import type { orderSchema } from "@/lib/validation";
import type {
  ManagedOrder,
  ShipmentInput,
  OrderShipment,
} from "@/lib/order-management";

export type CustomerIdentity = { id: string; email: string };
export type OrderOwner = CustomerIdentity | { guestKey: string };
export type StaffRole = "admin" | "editor" | null;
export type PreparedPhoto = {
  name: string;
  mime: string;
  extension: string;
  bytes: Buffer;
};
export type OrderInput = z.infer<typeof orderSchema>;
export type CustomerOrder = OrderShipment & {
  reference: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  payment_status: string;
  payment_provider: string | null;
  demo?: boolean;
};
export type InventoryChange = {
  table: "products" | "variants";
  id: string;
  stock: number;
};

/** Data access ports. No SQL dialect, SDK, browser storage or HTTP response types. */
export interface Repositories {
  catalog: { getRows(table: Table): Promise<Row[]> };
  workspace: {
    publishedDesign(): Promise<SiteSnapshot["design"]>;
    getWorkspace(): Promise<Workspace>;
    saveWorkspace(
      expected: number,
      snapshot: SiteSnapshot,
      inventory?: InventoryChange,
    ): Promise<void>;
    publishWorkspace(expected: number, restoreId?: string): Promise<string>;
  };
  requests: {
    workTerms(): Promise<RequestTerms>;
    workReadiness(): Promise<RequestTerms>;
    saveWorkTerms(terms: RequestTerms): Promise<RequestTerms>;
    allWorkRequests(): Promise<WorkRequest[]>;
    workInsights(days: number): Promise<RequestInsights>;
    findWorkRequest(id: string): Promise<WorkRequest>;
    workHistory(id: string): Promise<RequestEvent[]>;
    workFiles(id: string): Promise<RequestFile[]>;
    saveWorkMutation(
      expected: number,
      record: WorkRequest,
      event: RequestEvent,
    ): Promise<void>;
    submitWork(
      record: WorkRequest,
      files: RequestFile[],
      source: string,
      fingerprint: string,
    ): Promise<{ id: string; reference: string }>;
    storeWorkPhotos(
      id: string,
      photos: PreparedPhoto[],
      kind: RequestFile["kind"],
    ): Promise<RequestFile[]>;
    removeWorkPhotos(files: RequestFile[]): Promise<void>;
    discardUnlinkedWorkPhotos(files: RequestFile[]): Promise<void>;
    attachWorkPhotos(
      files: RequestFile[],
      expected: number,
      record: WorkRequest,
      event: RequestEvent,
    ): Promise<void>;
    readPrivateRequestPhoto(
      id: string,
    ): Promise<{ file: RequestFile; bytes: Buffer<ArrayBuffer> }>;
  };
  analytics: {
    getAnalyticsSettings(): Promise<AnalyticsSettings>;
    setAnalyticsSettings(settings: AnalyticsSettings): Promise<void>;
    appendAnalyticsEvents(events: AnalyticsEvent[]): Promise<void>;
    getAnalyticsReport(days: number): Promise<AnalyticsReport>;
    getAnalyticsHeatmap(
      days: number,
      path: string,
      width?: number,
      height?: number,
      revision?: string,
    ): Promise<HeatmapReport>;
    clearAnalyticsEvents(): Promise<void>;
  };
  payments: {
    getPaymentSettings(): Promise<PaymentSettings>;
    setPaymentSettings(value: PaymentSettings): Promise<void>;
    findPayment(
      value: string,
      by?: "id" | "merchant_ref",
    ): Promise<PaymentAttempt | null>;
    paymentOrder(attempt: PaymentAttempt): Promise<PaymentOrder>;
    expirePayments(): Promise<number>;
    preparePayment(
      reference: string,
      owner: string | { guestKey: string },
      expected: { provider: "paytr" | "iyzico"; mode: "test" | "live" },
    ): Promise<PaymentAttempt & { created: boolean }>;
    readyPayment(id: string, token: string, url: string): Promise<void>;
    initializationFailed(id: string, ambiguous: boolean): Promise<void>;
    settlePayment(
      id: string,
      result: {
        paid: boolean;
        amount: number;
        currency: string;
        paymentId: string;
        review: boolean;
      },
    ): Promise<PaymentAttempt["state"]>;
    paymentLedger(): Promise<Record<string, unknown>[]>;
  };
  identity: {
    getRole(): Promise<StaffRole>;
    getCustomer(): Promise<CustomerIdentity | null>;
    getStaffActor(): Promise<string>;
    loginStaff(email: string, password: string): Promise<void>;
    logoutStaff(): Promise<void>;
    authenticateCustomer(
      email: string,
      password: string,
      signup: boolean,
      redirectUrl: string,
    ): Promise<{ ok: true; verify?: boolean; demo?: boolean }>;
    logoutCustomer(): Promise<void>;
    customerOrders(customerId: string): Promise<CustomerOrder[]>;
  };
  orders: {
    guestOrders(guestKey: string): Promise<CustomerOrder[]>;
    listOrders(): Promise<ManagedOrder[]>;
    shareTracking(id: string, input: ShipmentInput): Promise<ManagedOrder>;
    createOrder(
      input: OrderInput,
      customer: OrderOwner,
    ): Promise<{ reference: string; demo: boolean; total: number }>;
    updateOrderStatus(id: string, status: string): Promise<void>;
  };
  media: {
    storePublicMedia(
      name: string,
      bytes: Buffer,
      mime: string,
      kind: "image" | "video",
    ): Promise<string>;
    readLocalVideo(name: string): Promise<Buffer<ArrayBuffer>>;
  };
}

export type AdapterLoaders = {
  [K in keyof Repositories]: () => Promise<Repositories[K]>;
};

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
