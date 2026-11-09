import { BestsellersSettings } from "../src/components/bestsellers-settings";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ModelGenerationsEditor } from "../src/components/model-generations-editor";
import { ProductCompatibilityEditor } from "../src/components/product-compatibility-editor";
import { RequestDashboard } from "../src/components/request-dashboard";
import { SiteTextsEditor } from "../src/components/site-texts-editor";
import type { VisualDesign } from "../src/lib/visual";
import { requestDemo } from "./request-demo";
import { OrderDashboard } from "../src/components/order-dashboard";
import { orderDemo } from "./order-demo";
import {
  compatibilityInputs,
  type CompatibilityInput,
} from "../src/lib/product-compatibility";
import {
  generationInputs,
  type GenerationInput,
} from "../src/lib/model-generations";
import type { Catalog } from "../src/lib/types";
export { applyModelGenerations } from "../src/lib/model-generations";
export {
  generationRangeLabel,
  resolveOngoingYears,
} from "../src/lib/model-generations";
export { applyProductCompatibility } from "../src/lib/product-compatibility";
export { salePrice, productVariants } from "../src/lib/product-commerce";
export {
  motorcycleRanges,
  resolveMotorcycleRange,
} from "../src/lib/motorcycle-selection";

export function mountTextManager(
  host: HTMLElement,
  design: VisualDesign,
  onSave: (key: string, value: string | null) => VisualDesign,
) {
  const root = createRoot(host);
  function Editor() {
    const [value, setValue] = useState(design);
    return (
      <SiteTextsEditor
        design={value}
        onSave={(key, text) => setValue(onSave(key, text))}
      />
    );
  }
  root.render(<Editor />);
  return { unmount: () => root.unmount() };
}

export function mountOrders(host: HTMLElement, catalog: Catalog) {
  const root = createRoot(host),
    transport = orderDemo(catalog);
  root.render(<OrderDashboard transport={transport} />);
  return { unmount: () => root.unmount() };
}
export function mountCRM(host: HTMLElement, catalog: Catalog) {
  const root = createRoot(host),
    transport = requestDemo(catalog);
  root.render(<RequestDashboard transport={transport} />);
  return { unmount: () => root.unmount() };
}

export function mountEditor(
  host: HTMLElement,
  catalog: Catalog,
  modelId: string,
) {
  let current = generationInputs(catalog, modelId);
  const root = createRoot(host);
  function Editor() {
    const [value, setValue] = useState(current);
    return (
      <ModelGenerationsEditor
        value={value}
        onChange={(rows: GenerationInput[]) => {
          current = rows;
          setValue(rows);
        }}
      />
    );
  }
  root.render(<Editor />);
  return { read: () => current, unmount: () => root.unmount() };
}

export function mountProductEditor(
  host: HTMLElement,
  catalog: Catalog,
  productId: string,
) {
  let current = compatibilityInputs(catalog, productId);
  const root = createRoot(host);
  function Editor() {
    const [value, setValue] = useState(current);
    return (
      <ProductCompatibilityEditor
        catalog={catalog}
        value={value}
        onChange={(rows: CompatibilityInput[]) => {
          current = rows;
          setValue(rows);
        }}
      />
    );
  }
  root.render(<Editor />);
  return { read: () => current, unmount: () => root.unmount() };
}

export { readBestsellers, withBestsellers } from "../src/lib/bestsellers";
export function mountBestsellers(
  host: HTMLElement,
  catalog: Catalog,
  onSave: (
    value: import("../src/lib/bestsellers").BestsellersConfig,
  ) => Promise<void>,
) {
  const root = createRoot(host);
  root.render(<BestsellersSettings catalog={catalog} onSave={onSave} />);
  return { unmount: () => root.unmount() };
}

export { defaultBlogImage } from "../src/lib/blog-media";
