import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Slider, Grid, Alert, CircularProgress, Paper } from "@mui/material";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getALM } from "../../api";

function SliderParam({ label, value, onChange, min, max, step, format }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{format ? format(value) : value}</Typography>
      </Box>
      <Slider value={value} onChange={(_, v) => onChange(v)} min={min} max={max} step={step} size="small" />
    </Box>
  );
}

function buildPathSpec(title, paths, pathColor, meanColor, yFormat) {
  if (!paths || paths.length === 0) return null;
  const pathValues = paths.flatMap((path, i) =>
    path.map((v, step) => ({ step, value: v, path: `p${i}` }))
  );
  const meanValues = paths[0].map((_, i) => {
    const sum = paths.reduce((acc, p) => acc + (p[i] ?? 0), 0);
    return { step: i, value: +(sum / paths.length).toFixed(6) };
  });
  return {
    title: { text: title, anchor: "middle", fontSize: 13 },
    height: 380,
    layer: [
      {
        data: { values: pathValues },
        mark: { type: "line", strokeWidth: 0.8, opacity: 0.25 },
        encoding: {
          x: { field: "step", type: "quantitative", axis: { labels: false, title: null, ticks: false } },
          y: { field: "value", type: "quantitative", axis: { format: yFormat, title: null } },
          detail: { field: "path", type: "nominal" },
          color: { value: pathColor },
        },
      },
      {
        data: { values: meanValues },
        mark: { type: "line", strokeWidth: 2.5 },
        encoding: {
          x: { field: "step", type: "quantitative" },
          y: { field: "value", type: "quantitative" },
          color: { value: meanColor },
          tooltip: [
            { field: "step", title: "Step" },
            { field: "value", title: "Mean" },
          ],
        },
      },
    ],
    resolve: { scale: { color: "independent" } },
  };
}

export default function ALM() {
  const [params, setParams] = useState({ scenarios: 20, years: 10, steps_per_year: 12, a: 0.5, b: 0.05, sigma: 0.02, init: 0.05 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const set = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));
  const pct = (v) => `${(v * 100).toFixed(2)}%`;

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await getALM(params); setData(res.data); }
    catch (e) { setError(e.response?.data?.detail || "Failed to load data"); }
    finally { setLoading(false); }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sidebar = (
    <>
      <SliderParam label="Scenarios" value={params.scenarios} onChange={set("scenarios")} min={1} max={100} step={1} />
      <SliderParam label="Years" value={params.years} onChange={set("years")} min={1} max={30} step={1} />
      <SliderParam label="Steps / Year" value={params.steps_per_year} onChange={set("steps_per_year")} min={1} max={52} step={1} />
      <SliderParam label={`Mean Reversion (a) = ${params.a.toFixed(2)}`} value={params.a} onChange={set("a")} min={0.01} max={5} step={0.01} format={(v) => v.toFixed(2)} />
      <SliderParam label="Long-run Mean (b)" value={params.b} onChange={set("b")} min={0.001} max={0.20} step={0.001} format={pct} />
      <SliderParam label="Volatility (σ)" value={params.sigma} onChange={set("sigma")} min={0.001} max={0.20} step={0.001} format={pct} />
      <SliderParam label="Initial Rate" value={params.init} onChange={set("init")} min={0.001} max={0.20} step={0.001} format={pct} />
    </>
  );

  return (
    <PageLayout title="Asset Liability Management — Cox-Ingersoll-Ross Model" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simulates short-rate paths: dr = a(b−r)dt + σ√r dW. Bold line = mean path.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <VegaChart spec={buildPathSpec("Interest Rate Paths", data.rates, "#1976d2", "#d32f2f", ".1%")} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <VegaChart spec={buildPathSpec("Zero-Coupon Bond Prices", data.bonds, "#388e3c", "#f57c00", ".3f")} />
            </Paper>
          </Grid>
        </Grid>
      )}
    </PageLayout>
  );
}
