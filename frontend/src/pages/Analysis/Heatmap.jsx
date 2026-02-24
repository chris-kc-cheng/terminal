import { useState, useEffect } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Paper, Switch, FormControlLabel,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getHeatmap } from "../../api";

export default function Heatmap() {
  const [period, setPeriod] = useState("Annually");
  const [annualize, setAnnualize] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getHeatmap({ period, annualize })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [period, annualize]);

  const option = data ? (() => {
    const vals = data.data.map((d) => d[2]).filter((v) => v != null);
    const absMax = Math.max(...vals.map(Math.abs));
    return {
      title: { text: "Periodic Table of Returns", left: "center" },
      tooltip: {
        formatter: (p) => {
          const asset = data.assets[p.data[0]];
          const per = data.periods[p.data[1]];
          const v = p.data[2];
          return `${asset}<br/>${per}: ${v != null ? (v * 100).toFixed(2) + "%" : "N/A"}`;
        },
      },
      grid: { top: 60, bottom: 20, left: 20, right: 20, containLabel: true },
      xAxis: { type: "category", data: data.assets, axisLabel: { rotate: 30, fontSize: 10 }, splitArea: { show: true } },
      yAxis: { type: "category", data: data.periods, axisLabel: { fontSize: 9 }, splitArea: { show: true } },
      visualMap: {
        min: -absMax, max: absMax, calculable: true,
        orient: "horizontal", left: "center", bottom: -10,
        inRange: { color: ["#d32f2f", "#ffffff", "#388e3c"] },
      },
      series: [{
        type: "heatmap",
        data: data.data,
        label: { show: true, formatter: (p) => p.data[2] != null ? (p.data[2] * 100).toFixed(1) + "%" : "", fontSize: 9 },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      }],
    };
  })() : null;

  const sidebar = (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Period</InputLabel>
        <Select value={period} label="Period" onChange={(e) => setPeriod(e.target.value)}>
          {["Monthly", "Quarterly", "Annually"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControlLabel
        control={<Switch checked={annualize} onChange={(e) => setAnnualize(e.target.checked)} size="small" />}
        label={<Typography variant="body2">Annualize Returns</Typography>}
        sx={{ mb: 1 }}
      />
    </>
  );

  return (
    <PageLayout title="Periodic Table of Returns" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Asset class returns by period. Green = positive, red = negative.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && option && (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
          <ReactECharts option={option} style={{ height: Math.max(400, data.periods.length * 22 + 120) }} />
        </Paper>
      )}
    </PageLayout>
  );
}
