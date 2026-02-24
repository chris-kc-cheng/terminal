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
  Chip,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useMediaQuery,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
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
import YieldCurve from "../pages/Market/YieldCurve";
import AnalysisOverview from "../pages/Analysis/AnalysisOverview";
import Performance from "../pages/Analysis/Performance";
import FactorAnalysis from "../pages/Analysis/FactorAnalysis";
import Portfolio from "../pages/Analysis/Portfolio";
import Heatmap from "../pages/Analysis/Heatmap";
import Factors from "../pages/Analysis/Factors";
import Peers from "../pages/Analysis/Peers";
import ModelOverview from "../pages/Model/ModelOverview";
import RiskModel from "../pages/Model/RiskModel";
import ALM from "../pages/Model/ALM";
import Options from "../pages/Model/Options";
import Linking from "../pages/Model/Linking";

const NAV = {
  Market: [
    { key: "Equity", label: "Equity" },
    { key: "FixedIncome", label: "Fixed Income" },
    { key: "Currency", label: "Currency" },
    { key: "Indices", label: "Indices" },
    { key: "YieldCurve", label: "Yield Curve" },
  ],
  Analysis: [
    { key: "Overview", label: "Overview" },
    { key: "Performance", label: "Performance" },
    { key: "FactorAnalysis", label: "Factor Analysis" },
    { key: "Portfolio", label: "Portfolio" },
    { key: "Heatmap", label: "Heatmap" },
    { key: "Factors", label: "Factors" },
    { key: "Peers", label: "Peers" },
  ],
  Model: [
    { key: "Overview", label: "Overview" },
    { key: "RiskModel", label: "Risk Model" },
    { key: "ALM", label: "ALM" },
    { key: "Options", label: "Options" },
    { key: "Linking", label: "Linking" },
  ],
};

const PAGES = {
  Equity: <Equity />,
  FixedIncome: <FixedIncome />,
  Currency: <Currency />,
  Indices: <Indices />,
  YieldCurve: <YieldCurve />,
  Overview: null, // resolved per section below
  Performance: <Performance />,
  FactorAnalysis: <FactorAnalysis />,
  Portfolio: <Portfolio />,
  Heatmap: <Heatmap />,
  Factors: <Factors />,
  Peers: <Peers />,
  RiskModel: <RiskModel />,
  ALM: <ALM />,
  Options: <Options />,
  Linking: <Linking />,
};

function resolvePage(section, sub) {
  if (sub === "Overview") {
    return section === "Analysis" ? <AnalysisOverview /> : <ModelOverview />;
  }
  return PAGES[sub] ?? null;
}

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const [greeting, setGreeting] = useState(null);
  const [loadingGreeting, setLoadingGreeting] = useState(false);
  const [selectedSection, setSelectedSection] = useState("Market");
  const [selectedSub, setSelectedSub] = useState("Equity");
  const [drawerOpen, setDrawerOpen] = useState(false);
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

          <Chip
            avatar={
              <Avatar sx={{ bgcolor: "primary.light" }}>{user?.username?.[0]?.toUpperCase()}</Avatar>
            }
            label={user?.username}
            variant="outlined"
            sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", mr: 2 }}
          />
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={logout}
            variant="outlined"
            sx={{ borderColor: "rgba(255,255,255,0.5)" }}
          >
            Logout
          </Button>
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
