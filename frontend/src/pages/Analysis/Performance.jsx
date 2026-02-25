import { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Paper, Grid, Slider,
  Table, TableBody, TableCell, TableContainer, TableRow,
  Accordion, AccordionSummary, AccordionDetails,
  ToggleButtonGroup, ToggleButton, Checkbox, FormControlLabel,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getPerformance } from "../../api";

// Format a value according to its declared type
function fmtVal(value, fmt, decimals) {
  if (value == null) return "—";
  switch (fmt) {
    case "pct":     return `${(value * 100).toFixed(decimals)}%`;
    case "decimal": return value.toFixed(decimals);
    case "int":     return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "dollar":  return `$${value.toFixed(2)}`;
    default:        return value.toFixed(decimals);
  }
}

function MetricsTable({ title, metrics, decimals }) {
  return (
    <Accordion defaultExpanded elevation={2} sx={{ borderRadius: "8px !important", mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {(metrics || []).map(({ name, value, fmt }) => (
                <TableRow key={name} hover>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{name}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12 }}>
                    {fmtVal(value, fmt, decimals)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
}

function SideLabel({ children }) {
  return (
    <Typography variant="caption" color="text.secondary"
      sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function Performance() {
  // Committed state (triggers API fetch)
  const [fund, setFund]               = useState("FCNTX");
  const [benchmark, setBenchmark]     = useState("^GSPC");
  const [rfrTicker, setRfrTicker]     = useState("^IRX");
  const [period, setPeriod]           = useState("10Y");
  const [chartWindow, setChartWindow] = useState("Cumulative");
  const [windowSize, setWindowSize]   = useState(36);
  const [market, setMarket]           = useState("All");
  const [ci, setCi]                   = useState(0.95);

  // Inputs (staged, committed on Search)
  const [inputs, setInputs] = useState({ fund: "FCNTX", benchmark: "^GSPC", rfrTicker: "^IRX" });

  // Frontend-only display controls (no refetch)
  const [showFund, setShowFund]           = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [binSize, setBinSize]             = useState(0.01);
  const [decimals, setDecimals]           = useState(2);

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getPerformance({
      fund, benchmark, rfr_ticker: rfrTicker, period,
      window: chartWindow, window_size: windowSize, market, ci,
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [fund, benchmark, rfrTicker, period, chartWindow, windowSize, market, ci]);

  // ── Chart option ───────────────────────────────────────────────────────────
  const isCumulative = chartWindow === "Cumulative";
  const chartTitle = isCumulative
    ? "Cumulative Performance (VAMI)"
    : chartWindow === "Rolling" ? `Rolling ${windowSize}-Month Return`
    : "Trailing Return";

  const chartOption = data ? {
    title: { text: chartTitle, left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, data: [showFund && data.fund, showBenchmark && data.benchmark].filter(Boolean) },
    xAxis: { type: "category", data: data.dates, axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: {
      type: "value",
      name: isCumulative ? "Value ($)" : "Return",
      axisLabel: {
        formatter: isCumulative
          ? (v) => `$${v.toFixed(2)}`
          : (v) => `${(v * 100).toFixed(1)}%`,
      },
    },
    series: [
      showFund && {
        name: data.fund, type: "line", data: data.fund_chart,
        lineStyle: { color: "#1976d2", width: 2 }, symbol: "none",
        areaStyle: isCumulative ? { color: "#1976d2", opacity: 0.05 } : undefined,
      },
      showBenchmark && {
        name: data.benchmark, type: "line", data: data.bm_chart,
        lineStyle: { color: "#d32f2f", width: 2, type: "dashed" }, symbol: "none",
      },
    ].filter(Boolean),
    grid: { containLabel: true, top: 50, bottom: 50 },
    animation: false,
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 5 }],
  } : null;

  // ── Histogram option ───────────────────────────────────────────────────────
  const histOption = data ? (() => {
    const fundRets = showFund      ? (data.fund_returns || []) : [];
    const bmRets   = showBenchmark ? (data.bm_returns   || []) : [];
    const allVals  = [...fundRets, ...bmRets].filter((v) => v != null);
    if (!allVals.length) return null;

    const lo = Math.floor(Math.min(...allVals) / binSize) * binSize;
    const hi = Math.ceil(Math.max(...allVals)  / binSize) * binSize;
    const bins = [];
    for (let b = lo; b <= hi + binSize * 0.001; b += binSize) bins.push(parseFloat(b.toFixed(6)));

    const bucket = (v) => Math.min(Math.max(Math.floor((v - lo) / binSize), 0), bins.length - 1);
    const fCounts = new Array(bins.length).fill(0);
    const bCounts = new Array(bins.length).fill(0);
    fundRets.forEach((v) => { if (v != null) fCounts[bucket(v)]++; });
    bmRets.forEach((v)   => { if (v != null) bCounts[bucket(v)]++; });

    return {
      title: { text: "Return Distribution", left: "center", textStyle: { fontSize: 13 } },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, data: [showFund && data.fund, showBenchmark && data.benchmark].filter(Boolean) },
      xAxis: { type: "category", data: bins.map((b) => `${(b * 100).toFixed(1)}%`), axisLabel: { rotate: 30, fontSize: 8 } },
      yAxis: { type: "value", name: "Count" },
      series: [
        showFund      && { name: data.fund,      type: "bar", data: fCounts, itemStyle: { color: "#1976d2", opacity: 0.75 } },
        showBenchmark && { name: data.benchmark, type: "bar", data: bCounts, itemStyle: { color: "#d32f2f", opacity: 0.75 } },
      ].filter(Boolean),
      grid: { containLabel: true, top: 50, bottom: 50 },
      animation: false,
    };
  })() : null;

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const tbSx = { fontSize: 10, px: 0.5 };

  const sidebar = (
    <>
      <TextField size="small" label="Fund / Stock" value={inputs.fund}
        onChange={(e) => setInputs((p) => ({ ...p, fund: e.target.value.toUpperCase() }))}
        fullWidth sx={{ mb: 1 }} />
      <TextField size="small" label="Benchmark" value={inputs.benchmark}
        onChange={(e) => setInputs((p) => ({ ...p, benchmark: e.target.value.toUpperCase() }))}
        fullWidth sx={{ mb: 1 }} />
      <TextField size="small" label="Risk-Free Rate" value={inputs.rfrTicker}
        onChange={(e) => setInputs((p) => ({ ...p, rfrTicker: e.target.value.toUpperCase() }))}
        fullWidth sx={{ mb: 1 }} />
      <Button variant="contained" fullWidth size="small" sx={{ mb: 2 }}
        onClick={() => { setFund(inputs.fund); setBenchmark(inputs.benchmark); setRfrTicker(inputs.rfrTicker); }}>
        Search
      </Button>

      <SideLabel>Time Horizon</SideLabel>
      <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small" fullWidth sx={{ mb: 2 }}>
        {["1Y", "3Y", "5Y", "10Y", "All"].map((p) => <ToggleButton key={p} value={p} sx={tbSx}>{p}</ToggleButton>)}
      </ToggleButtonGroup>

      <SideLabel>Window</SideLabel>
      <ToggleButtonGroup value={chartWindow} exclusive onChange={(_, v) => v && setChartWindow(v)} size="small" fullWidth sx={{ mb: 1 }}>
        {["Cumulative", "Trailing", "Rolling"].map((w) => (
          <ToggleButton key={w} value={w} sx={{ fontSize: 9, px: 0.5 }}>{w}</ToggleButton>
        ))}
      </ToggleButtonGroup>
      {chartWindow === "Rolling" && (
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2">Window Size (Months)</Typography>
            <Typography variant="body2" fontWeight={600}>{windowSize}</Typography>
          </Box>
          <Slider value={windowSize} onChange={(_, v) => setWindowSize(v)} min={6} max={120} step={6} size="small" />
        </Box>
      )}

      <SideLabel>Market</SideLabel>
      <ToggleButtonGroup value={market} exclusive onChange={(_, v) => v && setMarket(v)} size="small" fullWidth sx={{ mb: 2 }}>
        {["All", "Up", "Down"].map((m) => <ToggleButton key={m} value={m} sx={tbSx}>{m}</ToggleButton>)}
      </ToggleButtonGroup>

      <SideLabel>Show</SideLabel>
      <Box sx={{ display: "flex", mb: 1.5 }}>
        <FormControlLabel
          control={<Checkbox checked={showFund} onChange={(e) => setShowFund(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Fund</Typography>} sx={{ mr: 1 }} />
        <FormControlLabel
          control={<Checkbox checked={showBenchmark} onChange={(e) => setShowBenchmark(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Benchmark</Typography>} />
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Confidence Interval</Typography>
          <Typography variant="body2" fontWeight={600}>{(ci * 100).toFixed(1)}%</Typography>
        </Box>
        <Slider value={ci} onChange={(_, v) => setCi(v)} onChangeCommitted={(_, v) => setCi(v)}
          min={0.9} max={0.995} step={0.005} size="small" />
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Bin Size</Typography>
          <Typography variant="body2" fontWeight={600}>{(binSize * 100).toFixed(1)}%</Typography>
        </Box>
        <Slider value={binSize} onChange={(_, v) => setBinSize(v)} min={0.005} max={0.10} step={0.005} size="small" />
      </Box>

      <SideLabel>Decimal Places</SideLabel>
      <ToggleButtonGroup value={decimals} exclusive onChange={(_, v) => v !== null && setDecimals(v)} size="small" fullWidth sx={{ mb: 1 }}>
        {[0, 1, 2, 3, 4].map((d) => <ToggleButton key={d} value={d} sx={tbSx}>{d}</ToggleButton>)}
      </ToggleButtonGroup>

      {data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {data.observations} observations
        </Typography>
      )}
    </>
  );

  const sections = data?.metrics || {};

  return (
    <PageLayout title="Performance & Risk Analysis" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 2 }}>
            <ReactECharts option={chartOption} style={{ height: 320 }} />
          </Paper>
          {histOption && (
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 3 }}>
              <ReactECharts option={histOption} style={{ height: 220 }} />
            </Paper>
          )}
          {/* 3-column table layout matching reference: Perf | Risk+VaR | Regression+Efficiency */}
          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              <MetricsTable title="Performance"   metrics={sections["Performance"]}   decimals={decimals} />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricsTable title="Risk"          metrics={sections["Risk"]}          decimals={decimals} />
              <MetricsTable title="Value at Risk" metrics={sections["Value at Risk"]} decimals={decimals} />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricsTable title="Regression"    metrics={sections["Regression"]}    decimals={decimals} />
              <MetricsTable title="Efficiency"    metrics={sections["Efficiency"]}    decimals={decimals} />
            </Grid>
          </Grid>
        </>
      )}
    </PageLayout>
  );
}
