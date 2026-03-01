import { VegaLite } from "react-vega";

const BASE = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  width: "container",
  autosize: { type: "fit", contains: "padding" },
};

export default function VegaChart({ spec }) {
  return (
    <div style={{ width: "100%" }}>
      <VegaLite spec={{ ...BASE, ...spec }} actions={false} />
    </div>
  );
}
