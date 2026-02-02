import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import TVPage from "@/pages/tv";
import MobilePage from "@/pages/mobile";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ErrorBoundary fallbackClassName="dark bg-black">
          <TVPage />
        </ErrorBoundary>
      </Route>
      <Route path="/tv">
        <ErrorBoundary fallbackClassName="dark bg-black">
          <TVPage />
        </ErrorBoundary>
      </Route>
      <Route path="/mobile">
        <ErrorBoundary>
          <MobilePage />
        </ErrorBoundary>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
