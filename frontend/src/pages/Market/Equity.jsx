import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Equity() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Market — Equity
          </Typography>
          <Typography color="text.secondary">Equity markets overview and charts will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
