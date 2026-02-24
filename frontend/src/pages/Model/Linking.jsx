import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function Linking() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Model — Multi-Period Linking
          </Typography>
          <Typography color="text.secondary">Tools for multi-period linking of indices and series.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
