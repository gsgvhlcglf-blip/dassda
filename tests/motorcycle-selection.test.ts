import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../src/lib/seed";
import {
  applyModelGenerations,
  currentModelYear,
  resolveOngoingYears,
} from "../src/lib/model-generations";
import {
  motorcycleRanges,
  resolveMotorcycleRange,
  motorcycleRangeFitment,
  yearRangeText,
} from "../src/lib/motorcycle-selection";

function fixture() {
  const c = structuredClone(seed),
    model = "yamaha-mt-25";
  c.compatibility = c.compatibility.filter((row) => row.model_id !== model);
  return applyModelGenerations(c, model, [
    { id: "first", name: "1. nesil", start_year: 2014, end_year: 2017 },
    { id: "second", name: "2. nesil", start_year: 2018, end_year: 2021 },
    {
      id: "current",
      name: "3. nesil",
      start_year: 2022,
      end_year: currentModelYear(),
      ongoing: true,
    },
  ]);
}
test("a generation is one selectable range; ongoing URLs remain stable next year and exact legacy links remain exact", () => {
  const c = fixture(),
    original = structuredClone(c);
  assert.deepEqual(
    motorcycleRanges(c, "yamaha-mt-25").map((range) => [
      range.token,
      range.label,
    ]),
    [
      ["2022-gunumuz", "2022–Günümüz"],
      ["2018-2021", "2018–2021"],
      ["2014-2017", "2014–2017"],
    ],
  );
  assert.deepEqual(
    resolveMotorcycleRange(c, "yamaha-mt-25", "2016")?.years,
    [2016],
  );
  assert.equal(resolveMotorcycleRange(c, "yamaha-mt-25", "2014-2018"), null);
  assert.equal(resolveMotorcycleRange(c, "yamaha-mt-25", "2035"), null);
  const future = resolveOngoingYears(c, currentModelYear() + 1);
  assert.equal(
    motorcycleRanges(future, "yamaha-mt-25")[0].token,
    "2022-gunumuz",
  );
  assert(
    motorcycleRanges(future, "yamaha-mt-25")[0].years.includes(
      currentModelYear() + 1,
    ),
  );
  assert.deepEqual(c, original);
});
test("range matching unions only declared product/model/year/generation fitments and preserves partial-year labels", () => {
  const c = fixture(),
    model_id = "yamaha-mt-25";
  c.compatibility = [
    {
      id: "all",
      model_id,
      product_id: "p1",
      generation_id: "first",
      year_from: 2014,
      year_to: 2017,
    },
    {
      id: "partial",
      model_id,
      product_id: "p2",
      generation_id: "first",
      year_from: 2016,
      year_to: 2017,
    },
    {
      id: "wrong-generation",
      model_id,
      product_id: "p3",
      generation_id: "second",
      year_from: 2014,
      year_to: 2017,
    },
    {
      id: "wrong-model",
      model_id: "bmw-s1000rr",
      product_id: "p3",
      generation_id: null,
      year_from: 2014,
      year_to: 2017,
    },
  ];
  const first = resolveMotorcycleRange(c, model_id, "2014-2017")!;
  const matches = motorcycleRangeFitment(c, model_id, first);
  assert.deepEqual([...matches.keys()], ["p1", "p2"]);
  assert.deepEqual(matches.get("p1"), [2014, 2015, 2016, 2017]);
  assert.equal(yearRangeText(matches.get("p2")!), "2016–2017");
  assert.equal(
    motorcycleRangeFitment(
      c,
      model_id,
      resolveMotorcycleRange(c, model_id, "2018-2021")!,
    ).size,
    0,
  );
  c.models.find((model) => model.id === model_id)!.published = false;
  assert.equal(motorcycleRangeFitment(c, model_id, first).size, 0);
});
test("legacy ungrouped years retain real gaps instead of inventing intervening years", () => {
  const c = fixture();
  c.generations = c.generations.filter(
    (row) => row.model_id !== "yamaha-mt-25",
  );
  c.model_years = c.model_years.filter(
    (row) => row.model_id !== "yamaha-mt-25",
  );
  c.model_years.push(
    ...[2014, 2015, 2017].map((year) => ({
      id: "legacy-" + year,
      model_id: "yamaha-mt-25",
      generation_id: "",
      year,
    })),
  );
  assert.deepEqual(
    motorcycleRanges(c, "yamaha-mt-25").map((range) => range.label),
    ["2017", "2014–2015"],
  );
  assert.equal(yearRangeText([2017, 2014, 2015, 2014]), "2014–2015, 2017");
});
