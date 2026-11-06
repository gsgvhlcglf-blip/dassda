import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ModelGenerationsEditor } from "../src/components/model-generations-editor";
import { ProductCompatibilityEditor } from "../src/components/product-compatibility-editor";
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
export { applyProductCompatibility } from "../src/lib/product-compatibility";

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
