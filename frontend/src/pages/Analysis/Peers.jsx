import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Peers() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Analysis — Peer Group
          </Typography>
          <Typography color="text.secondary">Peer group comparisons and benchmarking tools.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
