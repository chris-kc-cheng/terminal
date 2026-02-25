import { useState, useEffect } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl,
  ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, ListItemText,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import PageLayout from "../../components/PageLayout";
import { getHeatmap } from "../../api";

const tbSx = { fontSize: 10, px: 0.5 };

function SideLabel({ children }) {
  return (
    <Typography variant="caption" color="text.secondary"
      sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function Heatmap() {
  const [period, setPeriod]           = useState("Annually");
  const [annualize, setAnnualize]     = useState(false);
  const [groupBy, setGroupBy]         = useState("Period");
  const [selectedAssets, setSelectedAssets] = useState(null); // null = uninitialized (show all)

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    getHeatmap({ period, annualize })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [period, annualize]);

  // Initialise selectedAssets on first data load
  useEffect(() => {
    if (data?.assets && selectedAssets === null) setSelectedAssets(data.assets);
  }, [data]);

  // Visible assets and their remapped indices for the chart
  const visibleAssets = data ? (selectedAssets ?? data.assets) : [];
  const assetIndexMap = new Map(
    data ? visibleAssets.map((a, i) => [data.assets.indexOf(a), i]) : []
  );

  // ── Chart option ────────────────────────────────────────────────────────
  const chartOption = data && visibleAssets.length > 0 ? (() => {
    // Filter to selected assets, remap asset indices
    const filtered = (data.data || [])
      .filter(([a]) => assetIndexMap.has(a))
      .map(([a, p, v]) => [assetIndexMap.get(a), p, v]);

    // Swap axes for "Group by Security"
    const chartData  = groupBy === "Security" ? filtered.map(([a, p, v]) => [p, a, v]) : filtered;
    const xAxisData  = groupBy === "Security" ? data.periods : visibleAssets;
    const yAxisData  = groupBy === "Security" ? visibleAssets : data.periods;

    const vals   = chartData.map((d) => d[2]).filter((v) => v != null);
    const absMax = vals.length ? Math.max(...vals.map(Math.abs)) : 1;

    return {
      title: { text: "Periodic Table of Returns", left: "center", textStyle: { fontSize: 13 } },
      tooltip: {
        formatter: (params) => {
          const [xi, yi, v] = params.data;
          const asset = groupBy === "Security" ? yAxisData[yi] : xAxisData[xi];
          const per   = groupBy === "Security" ? xAxisData[xi] : yAxisData[yi];
          return `${asset}<br/>${per}: ${v != null ? (v * 100).toFixed(2) + "%" : "N/A"}`;
        },
      },
      grid: { top: 60, bottom: 20, left: 20, right: 20, containLabel: true },
      xAxis: {
        type: "category", data: xAxisData,
        axisLabel: { rotate: 30, fontSize: groupBy === "Security" ? 8 : 10 },
        splitArea: { show: true },
      },
      yAxis: {
        type: "category", data: yAxisData,
        axisLabel: { fontSize: 9 },
        splitArea: { show: true },
      },
      visualMap: {
        min: -absMax, max: absMax, calculable: true,
        orient: "horizontal", left: "center", bottom: -10,
        inRange: { color: ["#d32f2f", "#ffffff", "#388e3c"] },
      },
      series: [{
        type: "heatmap", data: chartData,
        label: {
          show: true,
          formatter: (p) => p.data[2] != null ? (p.data[2] * 100).toFixed(1) + "%" : "",
          fontSize: 9,
        },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      }],
    };
  })() : null;

  const numRows   = groupBy === "Security" ? visibleAssets.length : (data?.periods.length ?? 0);
  const chartH    = Math.max(300, numRows * 22 + 120);

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebar = (
    <>
      <SideLabel>Period</SideLabel>
      <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small" fullWidth sx={{ mb: 2 }}>
        {["Monthly", "Quarterly", "Annually"].map((p) => (
          <ToggleButton key={p} value={p} sx={{ ...tbSx, fontSize: 9 }}>{p}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <SideLabel>Annualize</SideLabel>
      <ToggleButtonGroup value={annualize} exclusive onChange={(_, v) => v !== null && setAnnualize(v)} size="small" fullWidth sx={{ mb: 2 }}>
        <ToggleButton value={false} sx={tbSx}>Raw</ToggleButton>
        <ToggleButton value={true} disabled={period === "Annually"} sx={tbSx}>Annualized</ToggleButton>
      </ToggleButtonGroup>

      <SideLabel>Group By</SideLabel>
      <ToggleButtonGroup value={groupBy} exclusive onChange={(_, v) => v && setGroupBy(v)} size="small" fullWidth sx={{ mb: 2 }}>
        <ToggleButton value="Period" sx={tbSx}>Period</ToggleButton>
        <ToggleButton value="Security" sx={tbSx}>Security</ToggleButton>
      </ToggleButtonGroup>

      {data && (
        <>
          <SideLabel>Show Assets</SideLabel>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <Select
              multiple
              value={selectedAssets ?? data.assets}
              onChange={(e) => setSelectedAssets(e.target.value)}
              renderValue={(sel) =>
                sel.length === data.assets.length ? "All assets" : `${sel.length} of ${data.assets.length}`
              }
            >
              {data.assets.map((a) => (
                <MenuItem key={a} value={a} dense>
                  <Checkbox checked={(selectedAssets ?? data.assets).includes(a)} size="small" />
                  <ListItemText primary={a} primaryTypographyProps={{ fontSize: 12 }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}
    </>
  );

  // ── Raw returns table ────────────────────────────────────────────────────
  const matrix = data ? (() => {
    const m = {};
    data.data.forEach(([a, p, v]) => {
      const name = data.assets[a];
      if (!(selectedAssets ?? data.assets).includes(name)) return;
      if (!m[name]) m[name] = {};
      m[name][data.periods[p]] = v;
    });
    return m;
  })() : null;

  const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
  const retColor = (v) =>
    v == null ? "text.disabled" : v >= 0 ? "success.main" : "error.main";

  return (
    <PageLayout title="Periodic Table of Returns" sidebar={sidebar}>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {data && chartOption && (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
          <ReactECharts option={chartOption} style={{ height: chartH }} />
        </Paper>
      )}

      {data && matrix && (
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            Raw Returns by Security
          </Typography>
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 110, position: "sticky", left: 0, zIndex: 3, bgcolor: "background.paper" }}>
                    Security
                  </TableCell>
                  {data.periods.map((p) => (
                    <TableCell key={p} align="right" sx={{ fontWeight: 600, fontSize: 9, whiteSpace: "nowrap", minWidth: 64 }}>
                      {p}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, minWidth: 64, bgcolor: "primary.main", color: "white", position: "sticky", right: 0, zIndex: 3 }}>
                    YTD
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleAssets.map((asset) => (
                  <TableRow key={asset} hover>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600, position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>
                      {asset}
                    </TableCell>
                    {data.periods.map((p) => {
                      const v = matrix[asset]?.[p];
                      return (
                        <TableCell key={p} align="right" sx={{ fontSize: 10, color: retColor(v) }}>
                          {fmtPct(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right" sx={{
                      fontSize: 11, fontWeight: 700,
                      color: retColor(data.ytd?.[asset]),
                      bgcolor: "action.hover",
                      position: "sticky", right: 0, zIndex: 1,
                    }}>
                      {fmtPct(data.ytd?.[asset])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </PageLayout>
  );
}
