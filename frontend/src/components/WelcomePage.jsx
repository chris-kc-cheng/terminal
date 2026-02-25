import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Avatar,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useState } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import Equity from "../pages/Market/Equity";
import FixedIncome from "../pages/Market/FixedIncome";
import Currency from "../pages/Market/Currency";
import Indices from "../pages/Market/Indices";
import Heatmap from "../pages/Analysis/Heatmap";
import Performance from "../pages/Analysis/Performance";
import Portfolio from "../pages/Analysis/Portfolio";
import Factors from "../pages/Analysis/Factors";
import Peers from "../pages/Analysis/Peers";
import Options from "../pages/Model/Options";
import ALM from "../pages/Model/ALM";
import Linking from "../pages/Model/Linking";

// Matches terminal.py from ftk-streamlit exactly (5 + 4 + 3 pages)
const NAV = {
  Market: [
    { key: "Equity",      label: "Equity",               path: "/market/equity" },
    { key: "FixedIncome", label: "Fixed Income",          path: "/market/fixed-income" },
    { key: "Currency",    label: "Currency",              path: "/market/currency" },
    { key: "Indices",     label: "Economic Indicators",   path: "/market/indices" },
    { key: "Heatmap",     label: "Heat Map",              path: "/market/heatmap" },
  ],
  Analysis: [
    { key: "Performance", label: "Performance & Risk",    path: "/analysis/performance" },
    { key: "Portfolio",   label: "Portfolio Optimization",path: "/analysis/portfolio" },
    { key: "Factors",     label: "Factor Exposure",       path: "/analysis/factors" },
    { key: "Peers",       label: "Peer Group",            path: "/analysis/peers" },
  ],
  Model: [
    { key: "Options",     label: "Options",               path: "/model/options" },
    { key: "ALM",         label: "Yield Curve",           path: "/model/alm" },
    { key: "Linking",     label: "Multi-Period Linking",  path: "/model/linking" },
  ],
};

// Flat list for reverse path lookup
const ALL_PAGES = Object.entries(NAV).flatMap(([section, items]) =>
  items.map((item) => ({ ...item, section }))
);

const SECTION_FOR_PATH = {
  "/market":   "Market",
  "/analysis": "Analysis",
  "/model":    "Model",
};

function currentSection(pathname) {
  for (const [prefix, sec] of Object.entries(SECTION_FOR_PATH)) {
    if (pathname.startsWith(prefix)) return sec;
  }
  return "Market";
}

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width:900px)");

  const selectedSection = currentSection(location.pathname);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 3 }}>
            Terminal
          </Typography>

          {["Market", "Analysis", "Model"].map((sec) => (
            <Button
              key={sec}
              color={selectedSection === sec ? "secondary" : "inherit"}
              onClick={() => {
                navigate(NAV[sec][0].path);
                if (!isDesktop) setDrawerOpen(true);
              }}
              sx={{ color: "white", textTransform: "none", fontWeight: 700 }}
            >
              {sec}
            </Button>
          ))}

          <Box sx={{ flexGrow: 1 }} />

          <IconButton
            color="inherit"
            onClick={toggleTheme}
            sx={{ mr: 2 }}
            title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {mode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
          </IconButton>

          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: "primary.light", width: 36, height: 36, fontSize: 16 }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <MenuItem onClick={() => { setMenuAnchor(null); setProfileOpen(true); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); logout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>

          <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Profile</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, gap: 2 }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 64, height: 64, fontSize: 28 }}>
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ width: "100%" }}>
                  {[
                    { label: "Username", value: user?.username },
                    { label: "Email",    value: user?.email },
                    { label: "Role",     value: user?.role },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{value ?? "—"}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setProfileOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Toolbar>
      </AppBar>

      {/* Sidebar drawer */}
      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop ? true : drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: "border-box", mt: "64px" },
        }}
      >
        <Box sx={{ mt: 2 }}>
          <List>
            {NAV[selectedSection].map((item) => (
              <ListItemButton
                key={item.key}
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  if (!isDesktop) setDrawerOpen(false);
                }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Page content area */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: "64px" }}>
        <Container maxWidth="lg" sx={{ mt: 2 }}>
          <Routes>
            <Route path="/market/equity"          element={<Equity />} />
            <Route path="/market/fixed-income"    element={<FixedIncome />} />
            <Route path="/market/currency"        element={<Currency />} />
            <Route path="/market/indices"         element={<Indices />} />
            <Route path="/market/heatmap"         element={<Heatmap />} />
            <Route path="/analysis/performance"   element={<Performance />} />
            <Route path="/analysis/portfolio"     element={<Portfolio />} />
            <Route path="/analysis/factors"       element={<Factors />} />
            <Route path="/analysis/peers"         element={<Peers />} />
            <Route path="/model/options"          element={<Options />} />
            <Route path="/model/alm"              element={<ALM />} />
            <Route path="/model/linking"          element={<Linking />} />
            <Route path="*"                       element={<Navigate to="/market/equity" replace />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}
