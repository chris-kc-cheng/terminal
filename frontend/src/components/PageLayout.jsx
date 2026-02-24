/**
 * PageLayout — wraps each page with a collapsible right settings drawer.
 *
 * Usage:
 *   <PageLayout title="My Page" sidebar={<MyControls />}>
 *     <MyCharts />
 *   </PageLayout>
 */
import { useState } from "react";
import {
  Box, Typography, IconButton, Drawer, Divider, Tooltip, useMediaQuery,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const SIDEBAR_WIDTH = 280;

export default function PageLayout({ title, sidebar, children }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ display: "flex", position: "relative", minHeight: "100%" }}>
      {/* Main content */}
      <Box sx={{ flexGrow: 1, mr: sidebar && open && isDesktop ? `${SIDEBAR_WIDTH}px` : 0, transition: "margin 0.2s" }}>
        {/* Page header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          {sidebar && (
            <Tooltip title={open ? "Hide settings" : "Show settings"}>
              <IconButton onClick={() => setOpen((o) => !o)} size="small">
                <TuneIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {children}
      </Box>

      {/* Right sidebar */}
      {sidebar && (
        <Drawer
          anchor="right"
          variant={isDesktop ? "persistent" : "temporary"}
          open={open}
          onClose={() => setOpen(false)}
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
              top: "64px",
              height: "calc(100% - 64px)",
              borderLeft: "1px solid",
              borderColor: "divider",
              p: 2,
              overflowY: "auto",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
              Parameters
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <ChevronRightIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {sidebar}
        </Drawer>
      )}
    </Box>
  );
}
