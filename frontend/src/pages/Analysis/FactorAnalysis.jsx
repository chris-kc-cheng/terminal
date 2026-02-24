import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function FactorAnalysis() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Factor Analysis
          </Typography>
          <Typography color="text.secondary">Factor analysis outputs and statistics will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
