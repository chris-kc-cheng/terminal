import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, Alert, CircularProgress, Grid, Paper,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getPortfolio } from "../../api";

const STRAT_COLORS = ["#1976d2", "#388e3c", "#f57c00", "#7b1fa2", "#d32f2f"];

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

export default function Portfolio() {
  const [params, setParams] = useState({ rfr: 0.03, min_bound: 0.0, max_bound: 1.0 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const set = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  useEffect(() => {
    setLoading(true); setError(null);
    getPortfolio(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  const strategies = data ? Object.keys(data.weights) : [];

  const weightsOption = data ? {
    title: { text: "Portfolio Weights", left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, data: strategies },
    xAxis: { type: "category", data: data.assets, axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: { type: "value", axisLabel: { formatter: pct } },
    series: strategies.map((s, i) => ({
      name: s, type: "bar",
      data: data.assets.map((a) => data.weights[s][a] ?? 0),
      itemStyle: { color: STRAT_COLORS[i % STRAT_COLORS.length] },
    })),
    grid: { containLabel: true, top: 40, bottom: 60 },
    animation: false,
  } : null;

  const riskOption = data ? {
    title: { text: "Risk Contribution", left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, data: strategies },
    xAxis: { type: "category", data: data.assets, axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: { type: "value", axisLabel: { formatter: pct } },
    series: strategies.map((s, i) => ({
      name: s, type: "bar",
      data: data.assets.map((a) => data.risk_contribution[s]?.[a] ?? 0),
      itemStyle: { color: STRAT_COLORS[i % STRAT_COLORS.length] },
    })),
    grid: { containLabel: true, top: 40, bottom: 60 },
    animation: false,
  } : null;

  const scatterOption = data ? {
    title: { text: "Risk-Return", left: "center", textStyle: { fontSize: 13 } },
    tooltip: { formatter: (p) => `${p.data[2]}<br/>Vol: ${pct(p.data[0])}<br/>Ret: ${pct(p.data[1])}` },
    xAxis: { type: "value", name: "Volatility", axisLabel: { formatter: pct } },
    yAxis: { type: "value", name: "Return", axisLabel: { formatter: pct } },
    series: [
      {
        name: "Assets",
        type: "scatter",
        data: data.assets.map((a) => [data.asset_vols[a], data.asset_returns[a], a]),
        label: { show: true, formatter: (p) => p.data[2], position: "top", fontSize: 9 },
        symbolSize: 8,
        itemStyle: { color: "#90a4ae" },
      },
      {
        name: "Strategies",
        type: "scatter",
        data: strategies.map((s, i) => [data.strategy_rr[s]?.vol, data.strategy_rr[s]?.ret, s]),
        label: { show: true, formatter: (p) => p.data[2], position: "top", fontSize: 9 },
        symbolSize: 14,
        itemStyle: { color: (p) => STRAT_COLORS[strategies.indexOf(p.data[2]) % STRAT_COLORS.length] },
      },
    ],
    grid: { containLabel: true },
    animation: false,
  } : null;

  const sidebar = (
    <>
      <SliderParam label="Risk-Free Rate" value={params.rfr} onChange={set("rfr")} min={0} max={0.15} step={0.005} format={pct} />
      <SliderParam label="Min Weight Bound" value={params.min_bound} onChange={set("min_bound")} min={-0.5} max={0} step={0.05} format={pct} />
      <SliderParam label="Max Weight Bound" value={params.max_bound} onChange={set("max_bound")} min={0.5} max={2.0} step={0.05} format={pct} />
    </>
  );

  return (
    <PageLayout title="Portfolio Optimization" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compares portfolio construction strategies: Equal Weight, Inverse Vol, Min Volatility, Risk Parity, and Max Sharpe.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <ReactECharts option={weightsOption} style={{ height: 340 }} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <ReactECharts option={riskOption} style={{ height: 340 }} />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <ReactECharts option={scatterOption} style={{ height: 340 }} />
            </Paper>
          </Grid>
        </Grid>
      )}
    </PageLayout>
  );
}
