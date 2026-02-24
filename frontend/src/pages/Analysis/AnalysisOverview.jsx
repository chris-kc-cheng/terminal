import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function AnalysisOverview() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Overview
          </Typography>
          <Typography color="text.secondary">Analysis dashboards and factor analysis components will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
