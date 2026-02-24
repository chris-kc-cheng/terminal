import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Heatmap() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Heatmap
          </Typography>
          <Typography color="text.secondary">Periodic-table style heatmaps and conditional formatting for returns.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
