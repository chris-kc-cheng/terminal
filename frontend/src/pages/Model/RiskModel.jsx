import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function RiskModel() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Model — Risk Model
          </Typography>
          <Typography color="text.secondary">Risk model outputs and backtests will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
