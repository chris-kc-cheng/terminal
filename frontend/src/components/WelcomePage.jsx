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
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import ApiIcon from "@mui/icons-material/Api";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { getGreeting } from "../api";

export default function WelcomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const [greeting, setGreeting] = useState(null);
  const [loadingGreeting, setLoadingGreeting] = useState(false);

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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Top navigation bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            MyApp
          </Typography>
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
              <Avatar sx={{ bgcolor: "primary.light" }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
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

      {/* Main content */}
      <Container maxWidth="md" sx={{ mt: 6 }}>
        {/* Welcome hero */}
        <Card elevation={3} sx={{ borderRadius: 3, mb: 4 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <WavingHandIcon sx={{ fontSize: 56, color: "warning.main", mb: 1 }} />
            <Typography variant="h3" fontWeight={800} gutterBottom>
              Welcome back, {user?.username}!
            </Typography>
            <Typography variant="h6" color="text.secondary">
              You are successfully authenticated.
            </Typography>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
              <Chip label={`Role: ${user?.role || "user"}`} color="primary" />
              <Chip label={`Email: ${user?.email || "N/A"}`} variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        {/* Demo API call card */}
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
  );
}
