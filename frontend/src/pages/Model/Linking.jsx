import { useState, useEffect } from "react";
import {
  Box, Typography, ToggleButtonGroup, ToggleButton, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tabs, Tab, Chip,
} from "@mui/material";
import PageLayout from "../../components/PageLayout";
import { getLinking } from "../../api";

function DataTable({ data }) {
  if (!data) return null;
  const fmt = (v) => v == null ? "—" : `${(v * 100).toFixed(2)}%`;
  return (
    <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell><strong>Period</strong></TableCell>
            {data.columns.map((c) => <TableCell key={c} align="right"><strong>{c}</strong></TableCell>)}
            <TableCell align="right"><strong>Total</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.index.map((period, i) => {
            const row = data.data[i];
            const total = row.reduce((s, v) => s + (v ?? 0), 0);
            return (
              <TableRow key={period} hover>
                <TableCell>{period}</TableCell>
                {row.map((v, j) => (
                  <TableCell key={j} align="right"
                    sx={{ color: v > 0 ? "success.main" : v < 0 ? "error.main" : "text.primary" }}>
                    {fmt(v)}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700, color: total > 0 ? "success.main" : total < 0 ? "error.main" : "text.primary" }}>
                  {fmt(total)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const METHODS = [
  { key: "unadjusted", label: "Unadjusted" },
  { key: "carino", label: "Carino" },
  { key: "frongello", label: "Frongello" },
  { key: "frongello_reversed", label: "Frongello (Reversed)" },
  { key: "frongello_modified", label: "Frongello (Modified)" },
];

export default function Linking() {
  const [sample, setSample] = useState("1");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setLoading(true); setError(null);
    getLinking({ sample })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load data"))
      .finally(() => setLoading(false));
  }, [sample]);

  const sidebar = (
    <>
      <Typography variant="body2" gutterBottom fontWeight={600}>Dataset</Typography>
      <ToggleButtonGroup value={sample} exclusive onChange={(_, v) => v && setSample(v)} fullWidth size="small">
        <ToggleButton value="1">Sample 1</ToggleButton>
        <ToggleButton value="2">Sample 2</ToggleButton>
      </ToggleButtonGroup>
    </>
  );

  return (
    <PageLayout title="Multi-Period Linking" sidebar={sidebar}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compares five methods for linking multi-period attribution effects: Unadjusted, Carino, and three Frongello variants.
      </Typography>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Box sx={{ display: "flex", gap: 3, mb: 3, flexWrap: "wrap" }}>
            {[{ label: "Portfolio Returns", d: data.portfolio }, { label: "Benchmark Returns", d: data.benchmark }].map(({ label, d }) => (
              <Box key={label} sx={{ flex: 1, minWidth: 280 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
                <DataTable data={d} />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Active Returns by Linking Method</Typography>
            <Chip label="Portfolio − Benchmark" size="small" variant="outlined" />
          </Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
            {METHODS.map((m) => <Tab key={m.key} label={m.label} />)}
          </Tabs>
          <DataTable data={data[METHODS[tab].key]} />
        </>
      )}
    </PageLayout>
  );
}
