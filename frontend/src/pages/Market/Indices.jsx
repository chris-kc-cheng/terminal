import { useState, useEffect } from "react";
import {
  Box, Typography, Tabs, Tab, Alert, CircularProgress, Grid, Card, CardContent, Chip,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getEconomic } from "../../api";

function StatCard({ title, series }) {
  if (!series || series.length === 0) return null;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const delta = prev ? last.value - prev.value : 0;
  const isPos = delta > 0;
  return (
    <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
        <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
          {last.value != null ? `${(last.value * 100).toFixed(1)}%` : "—"}
        </Typography>
        <Chip
          label={`${isPos ? "+" : ""}${(delta * 100).toFixed(2)}pp MoM`}
          size="small"
          color={isPos ? "error" : "success"}
          variant="outlined"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          As of {last.date}
        </Typography>
      </CardContent>
    </Card>
  );
}

function lineOption(title, series1, series2, label1, label2) {
  const mkSeries = (data, name, color) => ({
    name,
    type: "line",
    data: data.map((d) => [d.date, d.value != null ? (d.value * 100).toFixed(2) : null]),
    lineStyle: { color, width: 2 },
    symbol: "none",
    connectNulls: true,
  });
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis", formatter: (p) => p.map((s) => `${s.seriesName}: ${s.value[1]}%`).join("<br/>") },
    legend: { bottom: 0, data: [label1, label2] },
    xAxis: { type: "time" },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${v}%` } },
    series: [mkSeries(series1, label1, "#1976d2"), mkSeries(series2, label2, "#d32f2f")],
    grid: { containLabel: true, top: 50, bottom: 40 },
    animation: false,
  };
}

export default function Indices() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    getEconomic()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout title="Economic Indicators">
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
            <Tab label="CPI (YoY)" />
            <Tab label="Unemployment Rate" />
          </Tabs>
          {tab === 0 && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}><StatCard title="Canada CPI (YoY)" series={data.ca_cpi} /></Grid>
                <Grid item xs={12} sm={6}><StatCard title="US CPI (YoY)" series={data.us_cpi} /></Grid>
              </Grid>
              <Box sx={{ height: 380 }}>
                <ReactECharts option={lineOption("CPI Year-over-Year", data.ca_cpi, data.us_cpi, "Canada", "United States")} style={{ height: "100%" }} />
              </Box>
            </>
          )}
          {tab === 1 && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}><StatCard title="Canada Unemployment" series={data.ca_unemployment} /></Grid>
                <Grid item xs={12} sm={6}><StatCard title="US Unemployment" series={data.us_unemployment} /></Grid>
              </Grid>
              <Box sx={{ height: 380 }}>
                <ReactECharts option={lineOption("Unemployment Rate", data.ca_unemployment, data.us_unemployment, "Canada", "United States")} style={{ height: "100%" }} />
              </Box>
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
