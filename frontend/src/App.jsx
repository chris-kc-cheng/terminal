import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from "@mui/material";
import { AuthProvider, useAuth } from "./AuthContext";
import { ThemeProvider as CustomThemeProvider, useTheme } from "./ThemeContext";
import LoginModal from "./components/LoginModal";
import WelcomePage from "./components/WelcomePage";

function AppContent() {
  const { user, loading } = useAuth();
  const { mode } = useTheme();

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: "#1976d2" },
      background: { 
        default: mode === "light" ? "#f5f7fa" : "#121212",
        paper: mode === "light" ? "#ffffff" : "#1e1e1e",
      },
    },
    shape: { borderRadius: 8 },
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LoginModal open={!user} />
      {user && <WelcomePage />}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <CustomThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </CustomThemeProvider>
  );
}
