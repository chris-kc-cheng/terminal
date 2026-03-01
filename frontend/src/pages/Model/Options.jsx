import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Grid, Paper, Card, CardContent,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getOptions, getOptionStrategies } from "../../api";

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

function MetricCard({ label, value, color }) {
  return (
    <Card elevation={2} sx={{ borderRadius: 2, textAlign: "center" }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color || "text.primary"}>
          {value == null ? "—" : value.toFixed(4)}
        </Typography>
      </CardContent>
    </Card>
  );
}

const GREEK_COLORS = { Price: "#1976d2", Delta: "#388e3c", Gamma: "#f57c00", Theta: "#d32f2f", Vega: "#7b1fa2" };

function greekSpec(title, spots, values, color) {
  const data = spots.map((s, i) => ({ spot: s, value: values[i] }));
  return {
    title: { text: title, anchor: "middle", fontSize: 12 },
    height: 200,
    data: { values: data },
    layer: [
      {
        mark: { type: "area", color, opacity: 0.08, strokeWidth: 0 },
        encoding: {
          x: { field: "spot", type: "quantitative", axis: { title: "Spot Price" } },
          y: { field: "value", type: "quantitative", axis: { format: ".2f", title: null } },
        },
      },
      {
        mark: { type: "line", color, strokeWidth: 2 },
        encoding: {
          x: { field: "spot", type: "quantitative" },
          y: { field: "value", type: "quantitative" },
          tooltip: [
            { field: "spot", title: "Spot", format: ".0f" },
            { field: "value", title: title, format: ".4f" },
          ],
        },
      },
    ],
  };
}

export default function Options() {
  const [strategies, setStrategies] = useState(["Long Call"]);
  const [params, setParams] = useState({ strategy: "Long Call", vol: 0.2, time: 0.25, rate: 0.05, dvd: 0.0, entry: 50.0 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const set = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  useEffect(() => {
    getOptionStrategies().then((r) => setStrategies(r.data.strategies)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    getOptions(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  const sidebar = (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Strategy</InputLabel>
        <Select value={params.strategy} label="Strategy" onChange={(e) => set("strategy")(e.target.value)}>
          {strategies.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      </FormControl>
      <SliderParam label="Volatility (σ)" value={params.vol} onChange={set("vol")} min={0.01} max={1.0} step={0.01} format={pct} />
      <SliderParam label="Time to Expiry (yr)" value={params.time} onChange={set("time")} min={0.01} max={2.0} step={0.01} format={(v) => `${v.toFixed(2)}y`} />
      <SliderParam label="Risk-Free Rate" value={params.rate} onChange={set("rate")} min={0.0} max={0.2} step={0.005} format={pct} />
      <SliderParam label="Dividend Yield" value={params.dvd} onChange={set("dvd")} min={0.0} max={0.1} step={0.005} format={pct} />
      <SliderParam label="Entry Spot Price" value={params.entry + 50} onChange={(v) => set("entry")(v - 50)} min={50} max={150} step={1} format={(v) => v.toFixed(0)} />
    </>
  );

  return (
    <PageLayout title={`Options — ${params.strategy}`} sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={4}><MetricCard label="Premium Paid" value={data.premium_paid} /></Grid>
            <Grid item xs={4}><MetricCard label="Max Gain" value={data.max_gain} color="success.main" /></Grid>
            <Grid item xs={4}><MetricCard label="Max Loss" value={data.max_loss} color="error.main" /></Grid>
          </Grid>
          <Grid container spacing={2}>
            {["price", "delta", "gamma", "theta", "vega"].map((greek) => {
              const title = greek.charAt(0).toUpperCase() + greek.slice(1);
              return (
                <Grid item xs={12} md={6} key={greek}>
                  <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                    <VegaChart spec={greekSpec(title, data.spots, data[greek], GREEK_COLORS[title])} />
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </PageLayout>
  );
}
