import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Portfolio() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Portfolio Optimization
          </Typography>
          <Typography color="text.secondary">Portfolio optimization and allocation comparisons.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
