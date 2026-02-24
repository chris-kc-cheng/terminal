import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Currency() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Market — Foreign Exchange
          </Typography>
          <Typography color="text.secondary">FX rates, heatmaps and cross-currency comparisons.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
