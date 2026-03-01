import { useState, useEffect } from "react";
import {
  Box, Alert, CircularProgress, Tabs, Tab, Paper,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
import PageLayout from "../../components/PageLayout";
import { getFixedIncome } from "../../api";

const TENORS_US = ["1M", "2M", "3M", "4M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
const TENORS_CA = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

function curveSpec(title, records, tenors, colorLatest, colorPrior) {
  if (!records || records.length < 2) return null;
  const latest = records[records.length - 1];
  const prior = records[records.length - 2];
  const latestLabel = latest.date || "Latest";
  const priorLabel = prior.date || "Prior";
  const values = [
    ...tenors.map((t) => ({ tenor: t, value: latest[t] ?? null, series: latestLabel })),
    ...tenors.map((t) => ({ tenor: t, value: prior[t] ?? null, series: priorLabel })),
  ].filter((d) => d.value != null);
  return {
    title: { text: title, anchor: "middle", fontSize: 13 },
    height: 280,
    data: { values },
    mark: { type: "line", point: { filled: true, size: 50 } },
    encoding: {
      x: { field: "tenor", type: "ordinal", sort: tenors, axis: { title: "Maturity" } },
      y: { field: "value", type: "quantitative", axis: { format: ".2f", title: "Yield (%)" } },
      color: {
        field: "series", type: "nominal",
        scale: { domain: [latestLabel, priorLabel], range: [colorLatest, colorPrior] },
        legend: { orient: "bottom" },
      },
      tooltip: [
        { field: "tenor", title: "Maturity" },
        { field: "series", title: "Date" },
        { field: "value", title: "Yield (%)", format: ".2f" },
      ],
    },
  };
}

function historicalSpec(title, records, tenor, color) {
  if (!records || records.length === 0) return null;
  const values = records.filter((r) => r[tenor] != null).map((r) => ({ date: r.date, value: r[tenor] }));
  return {
    title: { text: `${title} — ${tenor} Historical`, anchor: "middle", fontSize: 13 },
    height: 240,
    data: { values },
    layer: [
      {
        mark: { type: "area", color, opacity: 0.1, strokeWidth: 0 },
        encoding: {
          x: { field: "date", type: "ordinal", axis: { labelAngle: -30, labelFontSize: 9, title: null } },
          y: { field: "value", type: "quantitative", axis: { format: ".2f", title: "Yield (%)" } },
        },
      },
      {
        mark: { type: "line", color, strokeWidth: 1.5 },
        encoding: {
          x: { field: "date", type: "ordinal" },
          y: { field: "value", type: "quantitative" },
          tooltip: [
            { field: "date", title: "Date" },
            { field: "value", title: "Yield (%)", format: ".2f" },
          ],
        },
      },
    ],
    params: [{ name: "grid", select: "interval", bind: "scales" }],
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
                <VegaChart spec={curveSpec("US Treasury Yield Curve", data.us_curve, TENORS_US, "#1976d2", "#90caf9")} />
              </Paper>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <VegaChart spec={historicalSpec("US Treasury", data.us_curve, "10Y", "#1976d2")} />
              </Paper>
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <VegaChart spec={curveSpec("Canada Government Yield Curve", data.ca_curve, TENORS_CA, "#d32f2f", "#ef9a9a")} />
              </Paper>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
                <VegaChart spec={historicalSpec("Canada", data.ca_curve, "10Y", "#d32f2f")} />
              </Paper>
            </Box>
          )}
        </>
      )}
    </PageLayout>
  );
}
