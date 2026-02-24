import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getEquity } from "../../api";

const REGIONS = ["Americas", "Asia", "EMEA"];
const PCT = (v) => v == null ? "—" : `${(v * 100).toFixed(2)}%`;
const COLOR = (v) => v == null ? "text.primary" : v > 0 ? "success.main" : v < 0 ? "error.main" : "text.primary";

function RegionTable({ rows }) {
  return (
    <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, mb: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            {["Index", "Last", "MTD", "QTD", "YTD"].map((h) => (
              <TableCell key={h} align={h === "Index" ? "left" : "right"}><strong>{h}</strong></TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.ticker} hover>
              <TableCell>{r.name}</TableCell>
              <TableCell align="right">{r.last?.toLocaleString()}</TableCell>
              <TableCell align="right"><Chip label={PCT(r.mtd)} size="small" sx={{ bgcolor: "transparent", color: COLOR(r.mtd), fontWeight: 600 }} /></TableCell>
              <TableCell align="right"><Chip label={PCT(r.qtd)} size="small" sx={{ bgcolor: "transparent", color: COLOR(r.qtd), fontWeight: 600 }} /></TableCell>
              <TableCell align="right"><Chip label={PCT(r.ytd)} size="small" sx={{ bgcolor: "transparent", color: COLOR(r.ytd), fontWeight: 600 }} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BarOption(rows) {
  return {
    tooltip: { trigger: "axis" },
    legend: { data: ["MTD", "QTD", "YTD"], bottom: 0 },
    xAxis: { type: "category", data: rows.map((r) => r.name), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${(v * 100).toFixed(0)}%` } },
    series: [
      { name: "MTD", type: "bar", data: rows.map((r) => r.mtd), itemStyle: { color: "#1976d2" } },
      { name: "QTD", type: "bar", data: rows.map((r) => r.qtd), itemStyle: { color: "#388e3c" } },
      { name: "YTD", type: "bar", data: rows.map((r) => r.ytd), itemStyle: { color: "#f57c00" } },
    ],
    grid: { containLabel: true, bottom: 50 },
    animation: false,
  };
}

export default function Equity() {
  const [currency, setCurrency] = useState("Local");
  const [lookback, setLookback] = useState(20);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setLoading(true); setError(null);
    getEquity({ currency, lookback })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [currency, lookback]);

  const regionRows = data ? REGIONS.map((r) => ({ region: r, rows: data.filter((d) => d.region === r) })) : [];

  const sidebar = (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Currency</InputLabel>
        <Select value={currency} label="Currency" onChange={(e) => setCurrency(e.target.value)}>
          {["Local", "USD", "EUR", "CAD"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </Select>
      </FormControl>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Lookback (days)</Typography>
          <Typography variant="body2" fontWeight={600}>{lookback}</Typography>
        </Box>
        <Slider value={lookback} onChange={(_, v) => setLookback(v)} min={5} max={252} step={1} size="small" />
      </Box>
    </>
  );

  return (
    <PageLayout title="Equity Dashboard" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
            {REGIONS.map((r) => <Tab key={r} label={r} />)}
          </Tabs>
          {regionRows[tab] && (
            <>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2, mb: 2 }}>
                <ReactECharts option={BarOption(regionRows[tab].rows)} style={{ height: 280 }} />
              </Paper>
              <RegionTable rows={regionRows[tab].rows} />
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
