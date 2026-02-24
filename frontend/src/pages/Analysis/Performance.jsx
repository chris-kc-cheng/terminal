import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Performance() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Performance & Risk
          </Typography>
          <Typography color="text.secondary">Performance attribution, risk metrics and rolling statistics.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
