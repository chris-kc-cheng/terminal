import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Indices() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Market — Indices
          </Typography>
          <Typography color="text.secondary">Major market indices and historical performance visualizations.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
