import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function YieldCurve() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Market — Yield Curve
          </Typography>
          <Typography color="text.secondary">Yield curve construction and plotting tools.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
