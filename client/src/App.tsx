import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AIChat from "./components/AIChat";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";

const NotFound = lazy(() => import("@/pages/NotFound"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Products = lazy(() => import("./pages/Products"));
const CategoryProducts = lazy(() => import("./pages/CategoryProducts"));
const TripVideos = lazy(() => import("./pages/TripVideos"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const FinancialDashboard = lazy(() => import("./pages/FinancialDashboard"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Koku = lazy(() => import("./pages/Koku"));
const Yamada = lazy(() => import("./pages/Yamada"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const Login = lazy(() => import("./pages/Login"));
const B2B = lazy(() => import("./pages/B2B"));
const Daiko = lazy(() => import("./pages/Daiko"));
const Selection = lazy(() => import("./pages/Selection"));
const AdminManage = lazy(() => import("./pages/AdminManage"));
const About = lazy(() => import("./pages/About"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[#fef9f3]" aria-busy="true" />}
    >
      <Switch>
      <Route path={"/admin-panel/financial"} component={FinancialDashboard} />
      <Route path={"/admin-panel/koku"} component={AdminPanel} />
      <Route path={"/admin-panel/orders"} component={AdminPanel} />
      <Route path={"/admin-panel/products"} component={AdminPanel} />
      <Route path={"/admin-panel/suppliers"} component={AdminPanel} />
      <Route path={"/admin-panel/users"} component={AdminPanel} />
      <Route path={"/admin-panel/announcements"} component={AdminPanel} />
      <Route path={"/admin-panel/settings"} component={AdminPanel} />
      <Route path={"/admin-panel"} component={AdminPanel} />
      <Route path={"/admin/financial"} component={FinancialDashboard} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/"} component={HomePage} />
      <Route path={"/koku"} component={Koku} />
      <Route path={"/yama"} component={Yamada} />
      <Route path={"/guides/:slug"} component={GuideDetail} />
      <Route path={"/guides"} component={Guides} />
      <Route path={"/login"} component={Login} />
      <Route path={"/b2b"} component={B2B} />
      <Route path={"/daiko"} component={Daiko} />
      <Route path={"/selection"} component={Selection} />
      <Route path={"/manage"} component={AdminManage} />
      <Route path={"/about"} component={About} />
      <Route path={"/products/:categoryId"} component={CategoryProducts} />
      <Route path={"/products"} component={Products} />
      <Route path={"/product/:productId"} component={ProductDetail} />
      <Route path={"/videos"} component={TripVideos} />
      <Route path={"/cart"} component={Cart} />
      <Route path={"/checkout"} component={Checkout} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/order-confirmation"} component={OrderConfirmation} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
      </Switch>
    </Suspense>
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
