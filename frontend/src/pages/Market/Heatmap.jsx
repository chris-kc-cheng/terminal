import { useState, useEffect } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl,
  ToggleButtonGroup, ToggleButton, Alert, CircularProgress, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, ListItemText,
} from "@mui/material";
import VegaChart from "../../components/VegaChart";
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
  const [selectedAssets, setSelectedAssets] = useState(null);

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

  useEffect(() => {
    if (data?.assets && selectedAssets === null) setSelectedAssets(data.assets);
  }, [data]);

  const visibleAssets = data ? (selectedAssets ?? data.assets) : [];
  const assetIndexMap = new Map(
    data ? visibleAssets.map((a, i) => [data.assets.indexOf(a), i]) : []
  );

  const chartSpec = data && visibleAssets.length > 0 ? (() => {
    const filtered = (data.data || [])
      .filter(([a]) => assetIndexMap.has(a));

    const values = filtered.map(([a, p, v]) => {
      const asset = visibleAssets[assetIndexMap.get(a)];
      const per = data.periods[p];
      const label = v != null ? (v * 100).toFixed(1) + "%" : "";
      return groupBy === "Security"
        ? { x: per, y: asset, value: v, label }
        : { x: asset, y: per, value: v, label };
    });

    const xSort = groupBy === "Security" ? data.periods : visibleAssets;
    const ySort = groupBy === "Security" ? visibleAssets : data.periods;

    const vals = values.map((d) => d.value).filter((v) => v != null);
    const absMax = vals.length ? Math.max(...vals.map(Math.abs)) : 1;
    const numRows = ySort.length;
    const height = Math.max(280, numRows * 22 + 100);

    return {
      title: { text: "Periodic Table of Returns", anchor: "middle", fontSize: 13 },
      height,
      data: { values },
      layer: [
        {
          mark: "rect",
          encoding: {
            x: { field: "x", type: "ordinal", sort: xSort, axis: { labelAngle: groupBy === "Security" ? -30 : 0, labelFontSize: groupBy === "Security" ? 8 : 10, title: null } },
            y: { field: "y", type: "ordinal", sort: ySort, axis: { labelFontSize: 9, title: null } },
            color: {
              field: "value", type: "quantitative",
              scale: { domain: [-absMax, 0, absMax], range: ["#d32f2f", "#ffffff", "#388e3c"] },
              legend: null,
            },
            tooltip: [
              { field: "y", title: groupBy === "Security" ? "Asset" : "Period" },
              { field: "x", title: groupBy === "Security" ? "Period" : "Asset" },
              { field: "label", title: "Return" },
            ],
          },
        },
        {
          mark: { type: "text", fontSize: 9 },
          encoding: {
            x: { field: "x", type: "ordinal", sort: xSort },
            y: { field: "y", type: "ordinal", sort: ySort },
            text: { field: "label", type: "nominal" },
            color: { value: "#333333" },
          },
        },
      ],
    };
  })() : null;

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

      {data && chartSpec && (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
          <VegaChart spec={chartSpec} />
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
