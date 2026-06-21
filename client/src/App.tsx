import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ProductDetail from "./pages/ProductDetail";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Products from "./pages/Products";
import CategoryProducts from "./pages/CategoryProducts";
import TripVideos from "./pages/TripVideos";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Profile from "./pages/Profile";
import AIChat from "./components/AIChat";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import AdminDashboard from "./pages/AdminDashboard";
import FinancialDashboard from "./pages/FinancialDashboard";
import AdminPanel from "./pages/AdminPanel";
import About from "./pages/About";
import B2B from "./pages/B2B";
import Guides from "./pages/Guides";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/admin-panel/financial"} component={FinancialDashboard} />
      <Route path={"/admin-panel/orders"} component={AdminPanel} />
      <Route path={"/admin-panel/products"} component={AdminPanel} />
      <Route path={"/admin-panel/suppliers"} component={AdminPanel} />
      <Route path={"/admin-panel/users"} component={AdminPanel} />
      <Route path={"/admin-panel/announcements"} component={AdminPanel} />
      <Route path={"/admin-panel/settings"} component={AdminPanel} />
      <Route path={"/admin-panel"} component={AdminPanel} />
      <Route path={"/admin/financial"} component={FinancialDashboard} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/"} component={Home} />
      <Route path={"/products/:categoryId"} component={CategoryProducts} />
      <Route path={"/products"} component={Products} />
      <Route path={"/product/:productId"} component={ProductDetail} />
      <Route path={"/videos"} component={TripVideos} />
      <Route path={"/cart"} component={Cart} />
      <Route path={"/checkout"} component={Checkout} />
      <Route path={"/order-confirmation"} component={OrderConfirmation} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/about"} component={About} />
      <Route path={"/b2b"} component={B2B} />
      <Route path={"/guides"} component={Guides} />
      <Route path={"/login"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <NetworkStatusBanner />
          <Router />
          <AIChat />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
