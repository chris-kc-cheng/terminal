import { useState, useEffect } from "react";
import {
  Box, Typography, Slider, ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Paper,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getCurrency } from "../../api";

export default function Currency() {
  const [lookback, setLookback] = useState(30);
  const [show, setShow] = useState("Change");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getCurrency({ lookback, show })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [lookback, show]);

  const option = data ? (() => {
    const matrix = show === "Change" ? data.matrix_change : data.matrix_quote;
    const labels = data.labels;
    const echartsData = [];
    let minVal = Infinity, maxVal = -Infinity;
    matrix.forEach((row, i) => row.forEach((val, j) => {
      if (val != null) {
        echartsData.push([j, i, val]);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }));
    const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
    return {
      title: {
        text: show === "Change" ? `FX Change (last ${lookback} trading days, %)` : "FX Quote Matrix",
        left: "center",
      },
      tooltip: {
        formatter: (p) => {
          const [col, row, val] = p.data;
          return `${labels[row]}/${labels[col]}: ${val != null ? (show === "Change" ? val.toFixed(2) + "%" : val.toFixed(4)) : "—"}`;
        },
      },
      grid: { top: 60, bottom: 60, left: 60, right: 20 },
      xAxis: { type: "category", data: labels, splitArea: { show: true } },
      yAxis: { type: "category", data: labels, splitArea: { show: true } },
      visualMap: {
        min: show === "Change" ? -absMax : minVal,
        max: show === "Change" ? absMax : maxVal,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 10,
        inRange: { color: show === "Change" ? ["#d32f2f", "#ffffff", "#388e3c"] : ["#e3f2fd", "#1976d2"] },
      },
      series: [{
        name: "FX",
        type: "heatmap",
        data: echartsData,
        label: {
          show: true,
          formatter: (p) => {
            const v = p.data[2];
            return v == null ? "" : show === "Change" ? v.toFixed(1) + "%" : v.toFixed(2);
          },
          fontSize: 10,
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } },
      }],
    };
  })() : null;

  const sidebar = (
    <>
      <Typography variant="body2" fontWeight={600} gutterBottom>Display</Typography>
      <ToggleButtonGroup value={show} exclusive onChange={(_, v) => v && setShow(v)} fullWidth size="small" sx={{ mb: 3 }}>
        <ToggleButton value="Change">% Change</ToggleButton>
        <ToggleButton value="Quote">Quote</ToggleButton>
      </ToggleButtonGroup>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2">Lookback (days)</Typography>
          <Typography variant="body2" fontWeight={600}>{lookback}</Typography>
        </Box>
        <Slider value={lookback} onChange={(_, v) => setLookback(v)} min={1} max={252} step={1} size="small" />
      </Box>
    </>
  );

  return (
    <PageLayout title="Foreign Exchange" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cross-currency rate matrix. Rows = domestic, columns = foreign. Green = foreign appreciation.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && option && (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
          <ReactECharts option={option} style={{ height: 520 }} />
        </Paper>
      )}
    </PageLayout>
  );
}
