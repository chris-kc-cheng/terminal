import { useState, useEffect } from "react";
import {
  Box, Alert, CircularProgress, Tabs, Tab, Paper,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getFixedIncome } from "../../api";

const TENORS_US = ["1M", "2M", "3M", "4M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
const TENORS_CA = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

function curveOption(title, records, tenors, colorLatest, colorPrior) {
  if (!records || records.length < 2) return {};
  const latest = records[records.length - 1];
  const prior = records[records.length - 2];
  const mkSeries = (rec, label, color) => ({
    name: label,
    type: "line",
    data: tenors.map((t) => rec[t] ?? null),
    lineStyle: { color, width: 2 },
    symbol: "circle",
    symbolSize: 4,
    smooth: true,
  });
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    xAxis: { type: "category", data: tenors, name: "Maturity" },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${v?.toFixed ? v.toFixed(2) : v}%` } },
    series: [mkSeries(latest, latest.date || "Latest", colorLatest), mkSeries(prior, prior.date || "Prior", colorPrior)],
    grid: { containLabel: true, top: 50, bottom: 50 },
    animation: false,
  };
}

function historicalOption(title, records, tenor, color) {
  if (!records || records.length === 0) return {};
  const points = records.filter((r) => r[tenor] != null).map((r) => [r.date, r[tenor]]);
  return {
    title: { text: `${title} — ${tenor} Historical`, left: "center", textStyle: { fontSize: 13 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: points.map((p) => p[0]), axisLabel: { rotate: 30, fontSize: 9 } },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${v?.toFixed(2)}%` } },
    series: [{ type: "line", data: points.map((p) => p[1]), lineStyle: { color, width: 1.5 }, symbol: "none", areaStyle: { color, opacity: 0.1 } }],
    grid: { containLabel: true, top: 40, bottom: 60 },
    animation: false,
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 5 }],
  };
}

export default function FixedIncome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    getFixedIncome()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout title="Fixed Income Dashboard">
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
            <Tab label="US Yield Curve" />
            <Tab label="Canada Yield Curve" />
          </Tabs>
          {tab === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <ReactECharts option={curveOption("US Treasury Yield Curve", data.us_curve, TENORS_US, "#1976d2", "#90caf9")} style={{ height: 320 }} />
              </Paper>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <ReactECharts option={historicalOption("US Treasury", data.us_curve, "10Y", "#1976d2")} style={{ height: 280 }} />
              </Paper>
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <ReactECharts option={curveOption("Canada Government Yield Curve", data.ca_curve, TENORS_CA, "#d32f2f", "#ef9a9a")} style={{ height: 320 }} />
              </Paper>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <ReactECharts option={historicalOption("Canada", data.ca_curve, "10Y", "#d32f2f")} style={{ height: 280 }} />
              </Paper>
            </Box>
          )}
        </>
      )}
    </PageLayout>
  );
}
