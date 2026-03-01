import { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Select, MenuItem, FormControl,
  Alert, CircularProgress, Paper, Grid, Slider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails,
  ToggleButtonGroup, ToggleButton, Checkbox, ListItemText,
  Tabs, Tab,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getPerformance } from "../../api";

const ALL_MEASURES = [
  "Return", "Volatility", "VaR", "CVaR", "Drawdown",
  "Sharpe", "Tracking Error", "Beta", "Autocorrelation", "Risk Reward",
];

const RATIO_MEASURES = new Set(["Beta", "Autocorrelation", "Sharpe", "Risk Reward"]);

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

function buildYearMatrix(returnDict) {
  const matrix = {};
  Object.entries(returnDict || {}).forEach(([dateStr, v]) => {
    const d = new Date(dateStr);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    if (!matrix[yr]) matrix[yr] = Array(12).fill(null);
    matrix[yr][mo] = v;
  });
  const result = {};
  Object.entries(matrix).forEach(([yr, months]) => {
    const ytd = months.reduce((acc, v) => (v != null ? acc * (1 + v) : acc), 1) - 1;
    result[yr] = { months, ytd };
  });
  return result;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function RawReturnTable({ label, returnDict }) {
  const matrix = buildYearMatrix(returnDict);
  const years = Object.keys(matrix).sort((a, b) => b - a);
  const fmtCell = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
  const cellColor = (v) => v == null ? "text.disabled" : v >= 0 ? "success.main" : "error.main";
  return (
    <TableContainer sx={{ maxHeight: 340 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 55, position: "sticky", left: 0, zIndex: 3, bgcolor: "background.paper" }}>Year</TableCell>
            {MONTH_LABELS.map((m) => (
              <TableCell key={m} align="right" sx={{ fontWeight: 600, fontSize: 10, minWidth: 46 }}>{m}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, minWidth: 55, bgcolor: "primary.main", color: "white", position: "sticky", right: 0, zIndex: 3 }}>
              YTD
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {years.map((yr) => {
            const { months, ytd: rowYtd } = matrix[yr];
            return (
              <TableRow key={yr} hover>
                <TableCell sx={{ fontSize: 11, fontWeight: 600, position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>{yr}</TableCell>
                {months.map((v, i) => (
                  <TableCell key={i} align="right" sx={{ fontSize: 10, color: cellColor(v) }}>{fmtCell(v)}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, color: cellColor(rowYtd), bgcolor: "action.hover", position: "sticky", right: 0, zIndex: 1 }}>
                  {fmtCell(rowYtd)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Performance() {
  const [fund, setFund]               = useState("FCNTX");
  const [benchmark, setBenchmark]     = useState("^GSPC");
  const [rfrTicker, setRfrTicker]     = useState("^IRX");
  const [period, setPeriod]           = useState("10Y");
  const [chartWindow, setChartWindow] = useState("Cumulative");
  const [windowSize, setWindowSize]   = useState(36);
  const [market, setMarket]           = useState("All");
  const [ci, setCi]                   = useState(0.95);
  const [annualize, setAnnualize]     = useState(false);
  const [measures, setMeasures]       = useState(["Return", "Volatility"]);
  const [inputs, setInputs] = useState({ fund: "FCNTX", benchmark: "^GSPC", rfrTicker: "^IRX" });
  const [groupBy, setGroupBy]         = useState("Measure");
  const [showFund, setShowFund]       = useState(true);
  const [showBm, setShowBm]           = useState(true);
  const [binSize, setBinSize]         = useState(0.01);
  const [decimals, setDecimals]       = useState(2);
  const [rawTab, setRawTab]           = useState(0);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getPerformance({
      fund, benchmark, rfr_ticker: rfrTicker, period,
      window: chartWindow, window_size: windowSize, market, ci,
      annualize, measures: measures.join(","),
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [fund, benchmark, rfrTicker, period, chartWindow, windowSize, market, ci, annualize, measures]);

  function makeChartSpec(title, fundSeries, bmSeries) {
    const dates = data?.dates || [];
    const isRatio = RATIO_MEASURES.has(title);
    const yFmt = isRatio ? ".2f" : ".1%";
    const values = [];
    if (showFund && fundSeries) {
      dates.forEach((d, i) => { if (fundSeries[i] != null) values.push({ date: d, value: fundSeries[i], series: data.fund }); });
    }
    if (showBm && bmSeries) {
      dates.forEach((d, i) => { if (bmSeries[i] != null) values.push({ date: d, value: bmSeries[i], series: data.benchmark }); });
    }
    const domain = [showFund && data.fund, showBm && data.benchmark].filter(Boolean);
    const range  = [showFund && "#1976d2", showBm && "#d32f2f"].filter(Boolean);
    return {
      title: { text: title, anchor: "middle", fontSize: 12 },
      height: 210,
      data: { values },
      mark: { type: "line", strokeWidth: 2 },
      encoding: {
        x: { field: "date", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 8, title: null } },
        y: { field: "value", type: "quantitative", axis: { format: yFmt, labelFontSize: 9, title: null } },
        color: {
          field: "series", type: "nominal",
          scale: { domain, range },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: "date", title: "Date" },
          { field: "series", title: "Series" },
          { field: "value", title: "Value", format: yFmt },
        ],
      },
    };
  }

  function makeSecChartSpec(label, key) {
    const cm = data.chart_measures;
    const values = [];
    Object.entries(cm).forEach(([meas, vals]) => {
      (vals[key] || []).forEach((v, i) => {
        if (v != null) values.push({ date: data.dates[i], value: v, measure: meas });
      });
    });
    return {
      title: { text: label, anchor: "middle", fontSize: 12 },
      height: 210,
      data: { values },
      mark: { type: "line", strokeWidth: 2 },
      encoding: {
        x: { field: "date", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 8, title: null } },
        y: { field: "value", type: "quantitative", axis: { labelFontSize: 9, title: null } },
        color: { field: "measure", type: "nominal", legend: { orient: "bottom" } },
        tooltip: [
          { field: "date", title: "Date" },
          { field: "measure", title: "Measure" },
          { field: "value", title: "Value", format: ".4f" },
        ],
      },
    };
  }

  const histSpec = data ? (() => {
    const fundRets = showFund ? (data.fund_returns || []) : [];
    const bmRets   = showBm   ? (data.bm_returns   || []) : [];
    const allVals  = [...fundRets, ...bmRets].filter((v) => v != null);
    if (!allVals.length) return null;
    const lo = Math.floor(Math.min(...allVals) / binSize) * binSize;
    const hi = Math.ceil(Math.max(...allVals) / binSize) * binSize;
    const bins = [];
    for (let b = lo; b <= hi + binSize * 0.001; b += binSize) bins.push(parseFloat(b.toFixed(6)));
    const bucket = (v) => Math.min(Math.max(Math.floor((v - lo) / binSize), 0), bins.length - 1);
    const fC = new Array(bins.length).fill(0);
    const bC = new Array(bins.length).fill(0);
    fundRets.forEach((v) => { if (v != null) fC[bucket(v)]++; });
    bmRets.forEach((v)   => { if (v != null) bC[bucket(v)]++; });
    const histValues = [];
    bins.forEach((b, i) => {
      const label = `${(b * 100).toFixed(1)}%`;
      if (showFund && fC[i] > 0) histValues.push({ bin: label, count: fC[i], series: data.fund, idx: i });
      if (showBm   && bC[i] > 0) histValues.push({ bin: label, count: bC[i], series: data.benchmark, idx: i });
    });
    const domain = [showFund && data.fund, showBm && data.benchmark].filter(Boolean);
    const range  = [showFund && "#1976d2", showBm && "#d32f2f"].filter(Boolean);
    return {
      title: { text: "Return Distribution", anchor: "middle", fontSize: 13 },
      height: 200,
      data: { values: histValues },
      mark: { type: "bar", opacity: 0.75 },
      encoding: {
        x: { field: "bin", type: "ordinal", sort: { field: "idx" }, axis: { labelAngle: -30, labelFontSize: 8, title: null } },
        xOffset: { field: "series", type: "nominal" },
        y: { field: "count", type: "quantitative", axis: { title: "Count" } },
        color: {
          field: "series", type: "nominal",
          scale: { domain, range },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: "bin", title: "Return" },
          { field: "series", title: "Series" },
          { field: "count", title: "Count" },
        ],
      },
    };
  })() : null;

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
        {["1Y","3Y","5Y","10Y","All"].map((p) => <ToggleButton key={p} value={p} sx={tbSx}>{p}</ToggleButton>)}
      </ToggleButtonGroup>

      <SideLabel>Line Chart</SideLabel>
      <ToggleButtonGroup value={annualize} exclusive onChange={(_, v) => v !== null && setAnnualize(v)} size="small" fullWidth sx={{ mb: 1 }}>
        <ToggleButton value={false} sx={tbSx}>Raw</ToggleButton>
        <ToggleButton value={true}  sx={tbSx}>Annualized</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup value={chartWindow} exclusive onChange={(_, v) => v && setChartWindow(v)} size="small" fullWidth sx={{ mb: 1 }}>
        {["Cumulative","Trailing","Rolling"].map((w) => (
          <ToggleButton key={w} value={w} sx={{ fontSize: 9, px: 0.5 }}>{w}</ToggleButton>
        ))}
      </ToggleButtonGroup>
      {chartWindow === "Rolling" && (
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2">Window Size (Months)</Typography>
            <Typography variant="body2" fontWeight={600}>{windowSize}</Typography>
          </Box>
          <Slider value={windowSize} onChange={(_, v) => setWindowSize(v)} min={6} max={120} step={6} size="small" />
        </Box>
      )}
      <SideLabel>Group By</SideLabel>
      <ToggleButtonGroup value={groupBy} exclusive onChange={(_, v) => v && setGroupBy(v)} size="small" fullWidth sx={{ mb: 2 }}>
        <ToggleButton value="Measure"  sx={tbSx}>Measure</ToggleButton>
        <ToggleButton value="Security" sx={tbSx}>Security</ToggleButton>
      </ToggleButtonGroup>

      <SideLabel>Page Setting</SideLabel>
      <ToggleButtonGroup value={market} exclusive onChange={(_, v) => v && setMarket(v)} size="small" fullWidth sx={{ mb: 1 }}>
        {["All","Up","Down"].map((m) => <ToggleButton key={m} value={m} sx={tbSx}>{m}</ToggleButton>)}
      </ToggleButtonGroup>

      <Box sx={{ display: "flex", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
          <Checkbox checked={showFund} onChange={(e) => setShowFund(e.target.checked)} size="small" sx={{ p: 0.5 }} />
          <Typography variant="body2">Fund</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Checkbox checked={showBm} onChange={(e) => setShowBm(e.target.checked)} size="small" sx={{ p: 0.5 }} />
          <Typography variant="body2">Benchmark</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Confidence Interval</Typography>
          <Typography variant="body2" fontWeight={600}>{(ci * 100).toFixed(1)}%</Typography>
        </Box>
        <Slider value={ci} onChangeCommitted={(_, v) => setCi(v)} min={0.9} max={0.995} step={0.005} size="small" />
      </Box>

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Bin Size</Typography>
          <Typography variant="body2" fontWeight={600}>{(binSize * 100).toFixed(1)}%</Typography>
        </Box>
        <Slider value={binSize} onChange={(_, v) => setBinSize(v)} min={0.005} max={0.10} step={0.005} size="small" />
      </Box>

      <SideLabel>Decimal Places</SideLabel>
      <ToggleButtonGroup value={decimals} exclusive onChange={(_, v) => v !== null && setDecimals(v)} size="small" fullWidth sx={{ mb: 1 }}>
        {[0,1,2,3,4].map((d) => <ToggleButton key={d} value={d} sx={tbSx}>{d}</ToggleButton>)}
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
          <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 70 }}>Measure</Typography>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <Select
                multiple
                value={measures}
                onChange={(e) => setMeasures(e.target.value.length ? e.target.value : ["Return"])}
                renderValue={(sel) => sel.join(", ")}
              >
                {ALL_MEASURES.map((m) => (
                  <MenuItem key={m} value={m} dense>
                    <Checkbox checked={measures.includes(m)} size="small" />
                    <ListItemText primary={m} primaryTypographyProps={{ fontSize: 13 }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {groupBy === "Measure" ? (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {data.chart_measures && Object.entries(data.chart_measures).map(([meas, { fund: fv, benchmark: bv }]) => (
                <Grid item xs={12} md={measures.length === 1 ? 12 : 6} key={meas}>
                  <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                    <VegaChart spec={makeChartSpec(meas, fv, bv)} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {[[data.fund, "fund"], [data.benchmark, "benchmark"]].map(([label, key]) => (
                <Grid item xs={12} md={6} key={label}>
                  <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                    <VegaChart spec={makeSecChartSpec(label, key)} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {histSpec && (
            <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 2 }}>
              <VegaChart spec={histSpec} />
            </Paper>
          )}

          <Grid container spacing={1} sx={{ mb: 3 }}>
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

          {data.raw_returns && (
            <Accordion defaultExpanded elevation={2} sx={{ borderRadius: "8px !important" }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={700}>Raw Returns</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Tabs value={rawTab} onChange={(_, v) => setRawTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
                  <Tab label={data.fund}      sx={{ fontSize: 12 }} />
                  <Tab label={data.benchmark} sx={{ fontSize: 12 }} />
                </Tabs>
                {rawTab === 0 && <RawReturnTable label={data.fund}      returnDict={data.raw_returns?.fund} />}
                {rawTab === 1 && <RawReturnTable label={data.benchmark} returnDict={data.raw_returns?.benchmark} />}
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}
    </PageLayout>
  );
}
