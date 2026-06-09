import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Overview from '@/pages/Overview';
import NationalMap from '@/pages/NationalMap';
import StateAnalysis from '@/pages/StateAnalysis';
import CountyProfiles from '@/pages/CountyProfiles';
import CountyDetail from '@/pages/CountyDetail';
import ResearchCohort from '@/pages/ResearchCohort';
import RiskRankings from '@/pages/RiskRankings';
import ResourceMapping from '@/pages/ResourceMapping';
import OperationalData from '@/pages/OperationalData';
import ResearchBriefs from '@/pages/ResearchBriefs';
import DataSources from '@/pages/DataSources';
import AppSettings from '@/pages/AppSettings';
import TelehealthAccess from '@/pages/TelehealthAccess';
import WorkforceCapacity from '@/pages/WorkforceCapacity';
import HospitalDischargeRisk from '@/pages/HospitalDischargeRisk';
import BenefitsAccess from '@/pages/BenefitsAccess';
import CountyNeedsProfilePage from '@/pages/CountyNeedsProfilePage';
import MemberDashboard from '@/pages/MemberDashboard';
import MemberHelpCenter from '@/pages/MemberHelpCenter';
import MemberBenefits from '@/pages/MemberBenefits';
import MemberSupport from '@/pages/MemberSupport';
import MemberProfile from '@/pages/MemberProfile';
import MemberCoverageGap from '@/pages/MemberCoverageGap';
import BenefitsNavigator from '@/pages/BenefitsNavigator';
import ARBenefitsWorkflow from '@/pages/ARBenefitsWorkflow';
import RuralAccessExplorer from '@/pages/RuralAccessExplorer';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading Rural Access Intelligence...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/national-map" element={<NationalMap />} />
          <Route path="/state-analysis" element={<StateAnalysis />} />
          <Route path="/county-profiles" element={<CountyProfiles />} />
          <Route path="/county-profiles/:id" element={<CountyDetail />} />
          <Route path="/research-cohort" element={<ResearchCohort />} />
          <Route path="/risk-rankings" element={<RiskRankings />} />
          <Route path="/resource-mapping" element={<ResourceMapping />} />
          <Route path="/operational-data" element={<OperationalData />} />
          <Route path="/research-briefs" element={<ResearchBriefs />} />
          <Route path="/data-sources" element={<DataSources />} />
          <Route path="/settings" element={<AppSettings />} />
          <Route path="/telehealth-access" element={<TelehealthAccess />} />
          <Route path="/workforce-capacity" element={<WorkforceCapacity />} />
          <Route path="/hospital-discharge-risk" element={<HospitalDischargeRisk />} />
          <Route path="/benefits-access" element={<BenefitsAccess />} />
          <Route path="/county-profiles/:id/needs-profile" element={<CountyNeedsProfilePage />} />
          <Route path="/member-dashboard" element={<MemberDashboard />} />
          <Route path="/member-help-center" element={<MemberHelpCenter />} />
          <Route path="/member-benefits" element={<MemberBenefits />} />
          <Route path="/member-support" element={<MemberSupport />} />
          <Route path="/member-profile" element={<MemberProfile />} />
          <Route path="/member-coverage-gap" element={<MemberCoverageGap />} />
          <Route path="/benefits-navigator" element={<BenefitsNavigator />} />
          <Route path="/ar-benefits" element={<ARBenefitsWorkflow />} />
          <Route path="/rural-access-explorer" element={<RuralAccessExplorer />} />
          <Route path="/RuralAccessExplorer" element={<RuralAccessExplorer />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;