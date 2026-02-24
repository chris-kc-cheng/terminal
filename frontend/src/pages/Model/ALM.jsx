import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function ALM() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Model — Asset Liability Management
          </Typography>
          <Typography color="text.secondary">CIR model scenarios and ALM analyses.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
