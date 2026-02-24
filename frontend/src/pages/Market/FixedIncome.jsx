import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

export default function FixedIncome() {
  return (
    <Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Market — Fixed Income
          </Typography>
          <Typography color="text.secondary">Fixed income markets, yield curves and analytics will appear here.</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
