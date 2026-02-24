import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function ModelOverview() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Model — Overview
          </Typography>
          <Typography color="text.secondary">Modeling tools, scenario generation and calibration will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
