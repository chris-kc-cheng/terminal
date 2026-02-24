import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Card,
  CardContent,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
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
import ApiIcon from "@mui/icons-material/Api";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { getGreeting } from "../api";
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
    { key: "Equity", label: "Equity" },
    { key: "FixedIncome", label: "Fixed Income" },
    { key: "Currency", label: "Currency" },
    { key: "Indices", label: "Economic Indicators" },
    { key: "Heatmap", label: "Heat Map" },
  ],
  Analysis: [
    { key: "Performance", label: "Performance & Risk" },
    { key: "Portfolio", label: "Portfolio Optimization" },
    { key: "Factors", label: "Factor Exposure" },
    { key: "Peers", label: "Peer Group" },
  ],
  Model: [
    { key: "Options", label: "Options" },
    { key: "ALM", label: "Yield Curve" },
    { key: "Linking", label: "Multi-Period Linking" },
  ],
};

const PAGES = {
  Equity: <Equity />,
  FixedIncome: <FixedIncome />,
  Currency: <Currency />,
  Indices: <Indices />,
  Heatmap: <Heatmap />,
  Performance: <Performance />,
  Portfolio: <Portfolio />,
  Factors: <Factors />,
  Peers: <Peers />,
  Options: <Options />,
  ALM: <ALM />,
  Linking: <Linking />,
};

function resolvePage(section, sub) {
  return PAGES[sub] ?? null;
}

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const [greeting, setGreeting] = useState(null);
  const [loadingGreeting, setLoadingGreeting] = useState(false);
  const [selectedSection, setSelectedSection] = useState("Market");
  const [selectedSub, setSelectedSub] = useState(NAV["Market"][0].key);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width:900px)");

  const fetchGreeting = async () => {
    setLoadingGreeting(true);
    try {
      const res = await getGreeting();
      setGreeting(res.data.message);
    } catch {
      setGreeting("Failed to fetch greeting from API.");
    } finally {
      setLoadingGreeting(false);
    }
  };

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
                setSelectedSection(sec);
                setSelectedSub(NAV[sec][0].key);
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
                    { label: "Email", value: user?.email },
                    { label: "Role", value: user?.role },
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
                selected={selectedSub === item.key}
                onClick={() => {
                  setSelectedSub(item.key);
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
          {resolvePage(selectedSection, selectedSub)}

          <Divider sx={{ my: 3 }} />

          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <ApiIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Protected API Demo
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Click below to call a protected FastAPI endpoint using your JWT token.
              </Typography>

              <Button
                variant="contained"
                onClick={fetchGreeting}
                disabled={loadingGreeting}
                startIcon={loadingGreeting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {loadingGreeting ? "Fetching..." : "Call /api/greeting"}
              </Button>

              {greeting && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <strong>API Response:</strong> {greeting}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
