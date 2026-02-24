import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Grid, Paper, Card, CardContent,
  Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getFactors, getFactorDatasets } from "../../api";

function MetricCard({ label, value, format }) {
  const fmt = format || ((v) => v == null ? "—" : v.toFixed(4));
  return (
    <Card elevation={2} sx={{ borderRadius: 2, textAlign: "center" }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700}>{fmt(value)}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Factors() {
  const [datasets, setDatasets] = useState([]);
  const [ticker, setTicker] = useState("SPY");
  const [inputTicker, setInputTicker] = useState("SPY");
  const [dataset, setDataset] = useState("F-F_Research_Data_Factors");
  const [mom, setMom] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getFactorDatasets().then((r) => setDatasets(r.data.datasets || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    getFactors({ ticker, dataset, mom })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [ticker, dataset, mom]);

  const chartOption = data ? {
    title: { text: `${data.ticker} vs. Factor Model`, left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, data: [data.ticker, "Factor Model"] },
    xAxis: { type: "category", data: data.dates, axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: { type: "value", name: "Price (rebased)", axisLabel: { formatter: (v) => v?.toFixed(1) } },
    series: [
      { name: data.ticker, type: "line", data: data.portfolio_price, lineStyle: { color: "#1976d2", width: 2 }, symbol: "none" },
      { name: "Factor Model", type: "line", data: data.explained_price, lineStyle: { color: "#d32f2f", width: 2, type: "dashed" }, symbol: "none" },
    ],
    grid: { containLabel: true, top: 50, bottom: 50 },
    animation: false,
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 5 }],
  } : null;

  const sidebar = (
    <>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField size="small" label="Ticker" value={inputTicker} onChange={(e) => setInputTicker(e.target.value.toUpperCase())} fullWidth />
        <Button variant="contained" size="small" onClick={() => setTicker(inputTicker)} sx={{ minWidth: 60 }}>Go</Button>
      </Box>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Factor Model</InputLabel>
        <Select value={dataset} label="Factor Model" onChange={(e) => setDataset(e.target.value)}>
          {datasets.slice(0, 10).map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControlLabel
        control={<Switch checked={mom} onChange={(e) => setMom(e.target.checked)} size="small" />}
        label={<Typography variant="body2">Include Momentum</Typography>}
      />
    </>
  );

  return (
    <PageLayout title="Fama-French Factor Exposure" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}><MetricCard label="Ann. Return" value={data.ann_return} format={(v) => v == null ? "—" : `${(v * 100).toFixed(2)}%`} /></Grid>
            <Grid item xs={6} sm={3}><MetricCard label="Factor Return" value={data.factor_return} format={(v) => v == null ? "—" : `${(v * 100).toFixed(2)}%`} /></Grid>
            <Grid item xs={6} sm={3}><MetricCard label="R²" value={data.rsq} /></Grid>
            <Grid item xs={6} sm={3}><MetricCard label="Adj. R²" value={data.rsq_adj} /></Grid>
          </Grid>
          <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell><strong>Factor</strong></TableCell>
                  <TableCell align="right"><strong>Beta</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(data.betas).map(([factor, beta]) => (
                  <TableRow key={factor} hover>
                    <TableCell>{factor}</TableCell>
                    <TableCell align="right" sx={{ color: beta > 0 ? "success.main" : "error.main", fontWeight: 600 }}>
                      {beta?.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
            <ReactECharts option={chartOption} style={{ height: 360 }} />
          </Paper>
        </>
      )}
    </PageLayout>
  );
}
