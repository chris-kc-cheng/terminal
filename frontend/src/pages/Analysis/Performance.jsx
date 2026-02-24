import { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Paper, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getPerformance } from "../../api";

const PCT = (v) => v == null ? "—" : `${(v * 100).toFixed(2)}%`;
const NUM = (v) => v == null ? "—" : v.toFixed(4);

function MetricsTable({ title, metrics }) {
  const entries = metrics ? Object.entries(metrics) : [];
  return (
    <Accordion defaultExpanded elevation={2} sx={{ borderRadius: "8px !important", mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {entries.map(([k, v]) => (
                <TableRow key={k} hover>
                  <TableCell sx={{ color: "text.secondary" }}>{k}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {typeof v === "number" && Math.abs(v) < 10 ? PCT(v) : NUM(v)}
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

export default function Performance() {
  const [fund, setFund] = useState("SPY");
  const [benchmark, setBenchmark] = useState("^GSPC");
  const [rfrTicker, setRfrTicker] = useState("^IRX");
  const [period, setPeriod] = useState("3Y");
  const [inputs, setInputs] = useState({ fund: "SPY", benchmark: "^GSPC", rfrTicker: "^IRX" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getPerformance({ fund, benchmark, rfr_ticker: rfrTicker, period })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [fund, benchmark, rfrTicker, period]);

  const vamiOption = data ? {
    title: { text: "Cumulative Performance", left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, data: [data.fund, data.benchmark] },
    xAxis: { type: "category", data: data.dates, axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: { type: "value", name: "Value ($)", axisLabel: { formatter: (v) => `$${v.toFixed(2)}` } },
    series: [
      { name: data.fund, type: "line", data: data.fund_vami, lineStyle: { color: "#1976d2", width: 2 }, symbol: "none", areaStyle: { color: "#1976d2", opacity: 0.05 } },
      { name: data.benchmark, type: "line", data: data.bm_vami, lineStyle: { color: "#d32f2f", width: 2, type: "dashed" }, symbol: "none" },
    ],
    grid: { containLabel: true, top: 50, bottom: 50 },
    animation: false,
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 5 }],
  } : null;

  const sidebar = (
    <>
      <TextField size="small" label="Fund Ticker" value={inputs.fund} onChange={(e) => setInputs((p) => ({ ...p, fund: e.target.value.toUpperCase() }))} fullWidth sx={{ mb: 1.5 }} />
      <TextField size="small" label="Benchmark" value={inputs.benchmark} onChange={(e) => setInputs((p) => ({ ...p, benchmark: e.target.value.toUpperCase() }))} fullWidth sx={{ mb: 1.5 }} />
      <TextField size="small" label="Risk-Free Rate Ticker" value={inputs.rfrTicker} onChange={(e) => setInputs((p) => ({ ...p, rfrTicker: e.target.value.toUpperCase() }))} fullWidth sx={{ mb: 1.5 }} />
      <Button variant="contained" fullWidth size="small" sx={{ mb: 2 }}
        onClick={() => { setFund(inputs.fund); setBenchmark(inputs.benchmark); setRfrTicker(inputs.rfrTicker); }}>
        Apply
      </Button>
      <FormControl fullWidth size="small">
        <InputLabel>Period</InputLabel>
        <Select value={period} label="Period" onChange={(e) => setPeriod(e.target.value)}>
          {["1Y", "3Y", "5Y", "10Y", "All"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </Select>
      </FormControl>
      {data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {data.observations} observations
        </Typography>
      )}
    </>
  );

  return (
    <PageLayout title="Performance & Risk Analysis" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 3 }}>
            <ReactECharts option={vamiOption} style={{ height: 340 }} />
          </Paper>
          <Grid container spacing={1}>
            {Object.entries(data.metrics).map(([section, values]) => (
              <Grid item xs={12} md={6} key={section}>
                <MetricsTable title={section} metrics={values} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PageLayout>
  );
}
