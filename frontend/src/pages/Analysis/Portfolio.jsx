import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, Alert, CircularProgress, Grid, Paper,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
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

  const weightsSpec = data ? (() => {
    const values = data.assets.flatMap((a) =>
      strategies.map((s) => ({ asset: a, strategy: s, value: data.weights[s][a] ?? 0 }))
    );
    return {
      title: { text: "Portfolio Weights", anchor: "middle", fontSize: 13 },
      height: 300,
      data: { values },
      mark: { type: "bar" },
      encoding: {
        x: { field: "asset", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 9, title: null } },
        xOffset: { field: "strategy", type: "nominal" },
        y: { field: "value", type: "quantitative", axis: { format: ".0%", title: null } },
        color: {
          field: "strategy", type: "nominal",
          scale: { domain: strategies, range: STRAT_COLORS.slice(0, strategies.length) },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: "asset", title: "Asset" },
          { field: "strategy", title: "Strategy" },
          { field: "value", title: "Weight", format: ".2%" },
        ],
      },
    };
  })() : null;

  const riskSpec = data ? (() => {
    const values = data.assets.flatMap((a) =>
      strategies.map((s) => ({ asset: a, strategy: s, value: data.risk_contribution[s]?.[a] ?? 0 }))
    );
    return {
      title: { text: "Risk Contribution", anchor: "middle", fontSize: 13 },
      height: 300,
      data: { values },
      mark: { type: "bar" },
      encoding: {
        x: { field: "asset", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 9, title: null } },
        xOffset: { field: "strategy", type: "nominal" },
        y: { field: "value", type: "quantitative", axis: { format: ".0%", title: null } },
        color: {
          field: "strategy", type: "nominal",
          scale: { domain: strategies, range: STRAT_COLORS.slice(0, strategies.length) },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: "asset", title: "Asset" },
          { field: "strategy", title: "Strategy" },
          { field: "value", title: "Risk Contribution", format: ".2%" },
        ],
      },
    };
  })() : null;

  const scatterSpec = data ? (() => {
    const assetVals = data.assets.map((a) => ({
      vol: data.asset_vols[a], ret: data.asset_returns[a], name: a, group: "Asset",
    }));
    const stratVals = strategies.map((s) => ({
      vol: data.strategy_rr[s]?.vol, ret: data.strategy_rr[s]?.ret, name: s, group: "Strategy",
    }));
    const values = [...assetVals, ...stratVals];
    return {
      title: { text: "Risk-Return", anchor: "middle", fontSize: 13 },
      height: 320,
      data: { values },
      layer: [
        {
          mark: { type: "point", filled: true },
          encoding: {
            x: { field: "vol", type: "quantitative", axis: { format: ".1%", title: "Volatility" } },
            y: { field: "ret", type: "quantitative", axis: { format: ".1%", title: "Return" } },
            size: {
              field: "group", type: "nominal",
              scale: { domain: ["Asset", "Strategy"], range: [64, 196] },
              legend: null,
            },
            color: {
              condition: { test: "datum.group === 'Strategy'", field: "name", type: "nominal",
                scale: { domain: strategies, range: STRAT_COLORS.slice(0, strategies.length) } },
              value: "#90a4ae",
            },
            tooltip: [
              { field: "name", title: "Name" },
              { field: "vol", title: "Volatility", format: ".2%" },
              { field: "ret", title: "Return", format: ".2%" },
            ],
          },
        },
        {
          mark: { type: "text", dy: -10, fontSize: 9 },
          encoding: {
            x: { field: "vol", type: "quantitative" },
            y: { field: "ret", type: "quantitative" },
            text: { field: "name", type: "nominal" },
            color: {
              condition: { test: "datum.group === 'Strategy'", field: "name", type: "nominal",
                scale: { domain: strategies, range: STRAT_COLORS.slice(0, strategies.length) } },
              value: "#546e7a",
            },
          },
        },
      ],
    };
  })() : null;

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
              <VegaChart spec={weightsSpec} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <VegaChart spec={riskSpec} />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
              <VegaChart spec={scatterSpec} />
            </Paper>
          </Grid>
        </Grid>
      )}
    </PageLayout>
  );
}
