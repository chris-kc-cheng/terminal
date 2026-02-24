import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Options() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Model — Option Strategies
          </Typography>
          <Typography color="text.secondary">Option payoff calculators and strategy visualizations.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
