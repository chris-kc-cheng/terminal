import { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Slider, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Grid, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getPeers } from "../../api";

const DEFAULT_TICKERS = "PRCOX,GQEFX,STSEX,NUESX,VTCLX";
const COLORS = ["#1976d2", "#388e3c", "#f57c00", "#7b1fa2", "#d32f2f", "#00838f"];

export default function Peers() {
  const [input, setInput] = useState(DEFAULT_TICKERS);
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [benchmark, setBenchmark] = useState("^GSPC");
  const [rfr, setRfr] = useState(0.03);
  const [period, setPeriod] = useState("3Y");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  useEffect(() => {
    setLoading(true); setError(null);
    getPeers({ tickers, benchmark, rfr, period })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [tickers, benchmark, rfr, period]);

  const vamiSpec = data ? (() => {
    const values = data.vami.flatMap((r) =>
      data.funds.map((f) => ({ date: r.date, value: r[f] ?? null, fund: f }))
    ).filter((d) => d.value != null);
    return {
      title: { text: "Growth of $1 (VAMI)", anchor: "middle", fontSize: 13 },
      height: 300,
      data: { values },
      mark: { type: "line", strokeWidth: 2 },
      encoding: {
        x: { field: "date", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 9, title: null } },
        y: { field: "value", type: "quantitative", axis: { format: "$.2f", title: null } },
        color: {
          field: "fund", type: "nominal",
          scale: { domain: data.funds, range: COLORS.slice(0, data.funds.length) },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: "date", title: "Date" },
          { field: "fund", title: "Fund" },
          { field: "value", title: "Value", format: "$.2f" },
        ],
      },
      params: [{ name: "grid", select: "interval", bind: "scales" }],
    };
  })() : null;

  const scatterSpec = data ? (() => {
    const values = data.scatter.map((s) => ({ vol: s.vol, ret: s.ret, name: s.name }));
    return {
      title: { text: "Return vs. Volatility", anchor: "middle", fontSize: 13 },
      height: 280,
      data: { values },
      layer: [
        {
          mark: { type: "point", size: 100, filled: true },
          encoding: {
            x: { field: "vol", type: "quantitative", axis: { format: ".1%", title: "Ann. Volatility" } },
            y: { field: "ret", type: "quantitative", axis: { format: ".1%", title: "Ann. Return" } },
            color: {
              field: "name", type: "nominal",
              scale: { domain: data.funds, range: COLORS.slice(0, data.funds.length) },
              legend: null,
            },
            tooltip: [
              { field: "name", title: "Fund" },
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
              field: "name", type: "nominal",
              scale: { domain: data.funds, range: COLORS.slice(0, data.funds.length) },
            },
          },
        },
      ],
    };
  })() : null;

  const sidebar = (
    <>
      <TextField
        size="small" label="Fund Tickers (comma-separated)" value={input} multiline
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        fullWidth sx={{ mb: 1 }}
      />
      <Button variant="contained" size="small" fullWidth sx={{ mb: 2 }} onClick={() => setTickers(input)}>Apply</Button>
      <TextField size="small" label="Benchmark" value={benchmark} onChange={(e) => setBenchmark(e.target.value)} fullWidth sx={{ mb: 2 }} />
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Period</InputLabel>
        <Select value={period} label="Period" onChange={(e) => setPeriod(e.target.value)}>
          {["1Y", "3Y", "5Y", "10Y"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </Select>
      </FormControl>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Risk-Free Rate</Typography>
          <Typography variant="body2" fontWeight={600}>{(rfr * 100).toFixed(1)}%</Typography>
        </Box>
        <Slider value={rfr} onChange={(_, v) => setRfr(v)} min={0} max={0.1} step={0.005} size="small" />
      </Box>
    </>
  );

  return (
    <PageLayout title="Peer Group Analysis" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 3 }}>
            <VegaChart spec={vamiSpec} />
          </Paper>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <VegaChart spec={scatterSpec} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      {["Fund", "Ann. Return", "Ann. Vol", "Sharpe", "Max DD"].map((h) => (
                        <TableCell key={h} align={h === "Fund" ? "left" : "right"}><strong>{h}</strong></TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.summary.map((row) => (
                      <TableRow key={row.fund} hover>
                        <TableCell>{row.fund}</TableCell>
                        <TableCell align="right" sx={{ color: row.ann_return > 0 ? "success.main" : "error.main" }}>{row.ann_return != null ? `${(row.ann_return * 100).toFixed(2)}%` : "—"}</TableCell>
                        <TableCell align="right">{row.ann_vol != null ? `${(row.ann_vol * 100).toFixed(2)}%` : "—"}</TableCell>
                        <TableCell align="right">{row.sharpe?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell align="right" sx={{ color: "error.main" }}>{row.max_drawdown != null ? `${(row.max_drawdown * 100).toFixed(2)}%` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </>
      )}
    </PageLayout>
  );
}
