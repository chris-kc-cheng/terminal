import { useState, useEffect } from "react";
import {
  Box, Typography, Tabs, Tab, Alert, CircularProgress, Grid, Card, CardContent, Chip,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
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

function lineSpec(title, series1, series2, label1, label2) {
  const values = [
    ...series1.filter((d) => d.value != null).map((d) => ({ date: d.date, value: d.value, series: label1 })),
    ...series2.filter((d) => d.value != null).map((d) => ({ date: d.date, value: d.value, series: label2 })),
  ];
  return {
    title: { text: title, anchor: "middle", fontSize: 13 },
    height: 340,
    data: { values },
    mark: { type: "line", strokeWidth: 2 },
    encoding: {
      x: { field: "date", type: "temporal", axis: { title: null } },
      y: { field: "value", type: "quantitative", axis: { format: ".1%", title: null } },
      color: {
        field: "series", type: "nominal",
        scale: { domain: [label1, label2], range: ["#1976d2", "#d32f2f"] },
        legend: { orient: "bottom" },
      },
      tooltip: [
        { field: "date", title: "Date", timeUnit: "yearmonth" },
        { field: "series", title: "Country" },
        { field: "value", title: "Value", format: ".2%" },
      ],
    },
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
              <VegaChart spec={lineSpec("CPI Year-over-Year", data.ca_cpi, data.us_cpi, "Canada", "United States")} />
            </>
          )}
          {tab === 1 && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}><StatCard title="Canada Unemployment" series={data.ca_unemployment} /></Grid>
                <Grid item xs={12} sm={6}><StatCard title="US Unemployment" series={data.us_unemployment} /></Grid>
              </Grid>
              <VegaChart spec={lineSpec("Unemployment Rate", data.ca_unemployment, data.us_unemployment, "Canada", "United States")} />
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
