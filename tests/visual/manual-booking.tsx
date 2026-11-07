import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Form from '@/components/dashboard/DashboardBookingForm';
import List from '@/components/dashboard/DashboardBookingsList';
import Calendar from '@/components/dashboard/DashboardCalendar';
import { setAccessToken } from '@/lib/auth/token-memory';
declare global { interface Window { __manualFixture: { token: string; businessId: string; visitType: "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER" } } }
const fixture = window.__manualFixture;
setAccessToken(fixture.token);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
function App() {
 const [created, setCreated] = useState('');
 return <QueryClientProvider client={queryClient}>
 <div id="form"><Form businessId={fixture.businessId} visitType={fixture.visitType} onClose={()=>{}} onCreated={setCreated}/></div>
 <output id="created">{created}</output>
 <div id="list"><List businessId={fixture.businessId} activeTab="Upcoming"/></div>
 <div id="calendar"><Calendar businessId={fixture.businessId}/></div>
 </QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
