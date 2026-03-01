import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Paper,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getCurrency } from "../../api";

export default function Currency() {
  const [lookback, setLookback] = useState(30);
  const [show, setShow] = useState("Change");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getCurrency({ lookback, show })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [lookback, show]);

  const spec = data ? (() => {
    const matrix = show === "Change" ? data.matrix_change : data.matrix_quote;
    const labels = data.labels;
    const values = [];
    let minVal = Infinity, maxVal = -Infinity;
    matrix.forEach((row, i) => row.forEach((val, j) => {
      if (val != null) {
        const label = show === "Change" ? val.toFixed(1) + "%" : val.toFixed(2);
        values.push({ x: labels[j], y: labels[i], value: val, label });
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }));
    const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
    const colorScale = show === "Change"
      ? { domain: [-absMax, 0, absMax], range: ["#d32f2f", "#ffffff", "#388e3c"] }
      : { domain: [minVal, maxVal], range: ["#e3f2fd", "#1976d2"] };

    return {
      title: {
        text: show === "Change" ? `FX Change (last ${lookback} trading days, %)` : "FX Quote Matrix",
        anchor: "middle",
      },
      height: 480,
      data: { values },
      layer: [
        {
          mark: "rect",
          encoding: {
            x: { field: "x", type: "ordinal", sort: labels, axis: { title: null } },
            y: { field: "y", type: "ordinal", sort: labels, axis: { title: null } },
            color: {
              field: "value", type: "quantitative",
              scale: colorScale,
              legend: null,
            },
            tooltip: [
              { field: "y", title: "Domestic" },
              { field: "x", title: "Foreign" },
              { field: "label", title: "Value" },
            ],
          },
        },
        {
          mark: { type: "text", fontSize: 10 },
          encoding: {
            x: { field: "x", type: "ordinal", sort: labels },
            y: { field: "y", type: "ordinal", sort: labels },
            text: { field: "label", type: "nominal" },
            color: { value: "#333333" },
          },
        },
      ],
    };
  })() : null;

  const sidebar = (
    <>
      <Typography variant="body2" fontWeight={600} gutterBottom>Display</Typography>
      <ToggleButtonGroup value={show} exclusive onChange={(_, v) => v && setShow(v)} fullWidth size="small" sx={{ mb: 3 }}>
        <ToggleButton value="Change">% Change</ToggleButton>
        <ToggleButton value="Quote">Quote</ToggleButton>
      </ToggleButtonGroup>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Lookback (days)</Typography>
          <Typography variant="body2" fontWeight={600}>{lookback}</Typography>
        </Box>
        <Slider value={lookback} onChange={(_, v) => setLookback(v)} min={1} max={252} step={1} size="small" />
      </Box>
    </>
  );

  return (
    <PageLayout title="Foreign Exchange" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cross-currency rate matrix. Rows = domestic, columns = foreign. Green = foreign appreciation.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && spec && (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
          <VegaChart spec={spec} />
        </Paper>
      )}
    </PageLayout>
  );
}
