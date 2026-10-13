/*
  Simulated access levels for the demo.
  This only changes what the interface shows. In the live system, access must be
  enforced by the authentication service, database policies and server side checks.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const SECTIONS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home', group: 'Overview' },
    { key: 'clients', label: 'Client records', icon: 'users', group: 'Clients' },
    { key: 'referrals', label: 'Referrals and intake', icon: 'inbox', group: 'Clients' },
    { key: 'calendar', label: 'Appointments', icon: 'calendar', group: 'Clients' },
    { key: 'notes', label: 'Clinical notes', icon: 'note', group: 'Clinical' },
    { key: 'assessments', label: 'Assessments', icon: 'clipboard', group: 'Clinical' },
    { key: 'goals', label: 'Goals and progress', icon: 'target', group: 'Clinical' },
    { key: 'reports', label: 'Clinical reports', icon: 'report', group: 'Clinical' },
    { key: 'documents', label: 'Documents and consent', icon: 'folder', group: 'Records' },
    { key: 'agreements', label: 'Service agreements', icon: 'signature', group: 'Records' },
    { key: 'funding', label: 'Funding and services', icon: 'wallet', group: 'Billing' },
    { key: 'invoices', label: 'Invoices', icon: 'receipt', group: 'Billing' },
    { key: 'tasks', label: 'Tasks', icon: 'tasks', group: 'Practice' },
    { key: 'incidents', label: 'Incidents and complaints', icon: 'alert', group: 'Practice' },
    { key: 'staff', label: 'Staff and access', icon: 'shield', group: 'Practice' },
    { key: 'statistics', label: 'Business reports', icon: 'chart', group: 'Practice' },
    { key: 'settings', label: 'Settings', icon: 'settings', group: 'Practice' }
  ];

  const ALL = SECTIONS.map((s) => s.key);

  const ROLES = {
    owner: {
      label: 'Practice owner',
      summary: 'Everything, including incidents, staff access and settings.',
      sections: ALL
    },
    therapist: {
      label: 'Occupational therapist',
      summary: 'Clients, appointments and all clinical records. No billing, incidents or settings.',
      sections: ['dashboard', 'clients', 'referrals', 'calendar', 'notes', 'assessments', 'goals', 'reports', 'documents', 'agreements', 'funding', 'tasks', 'staff']
    },
    admin: {
      label: 'Practice administrator',
      summary: 'Referrals, bookings, agreements, billing, incidents and settings. No clinical notes or assessments.',
      sections: ['dashboard', 'clients', 'referrals', 'calendar', 'reports', 'documents', 'agreements', 'funding', 'invoices', 'tasks', 'incidents', 'staff', 'statistics', 'settings']
    },
    support: {
      label: 'Authorised support staff',
      summary: 'Their own appointments, session notes, client goals and tasks.',
      sections: ['dashboard', 'clients', 'calendar', 'notes', 'goals', 'tasks', 'staff']
    }
  };

  /* Actions within sections */
  const CAPABILITIES = {
    clinical: ['owner', 'therapist', 'support'],
    assess: ['owner', 'therapist'],
    reviewReports: ['owner'],
    billing: ['owner', 'admin'],
    manageReferrals: ['owner', 'therapist', 'admin'],
    editClients: ['owner', 'therapist', 'admin'],
    deleteClients: ['owner'],
    deleteRecords: ['owner', 'admin'],
    manageStaff: ['owner'],
    settings: ['owner', 'admin'],
    agreements: ['owner', 'therapist', 'admin']
  };

  const CAPABILITY_LABELS = {
    clinical: 'Read and write clinical notes',
    assess: 'Record assessments and write reports',
    reviewReports: 'Mark reports as reviewed',
    billing: 'Invoices and payments',
    manageReferrals: 'Accept referrals and add clients',
    deleteClients: 'Delete client records',
    manageStaff: 'Change staff access',
    settings: 'Change practice settings'
  };

  let user = null;

  AWY.access = {
    SECTIONS: SECTIONS,
    ROLES: ROLES,
    CAPABILITIES: CAPABILITIES,
    CAPABILITY_LABELS: CAPABILITY_LABELS,
    setUser(staff) {
      user = staff;
    },
    user() {
      return user;
    },
    role() {
      return user ? user.role : null;
    },
    canSee(section, role) {
      const r = ROLES[role || (user && user.role)];
      return !!r && r.sections.includes(section);
    },
    can(capability, role) {
      const r = role || (user && user.role);
      return (CAPABILITIES[capability] || []).includes(r);
    },
    roleLabel(role) {
      return ROLES[role] ? ROLES[role].label : role;
    }
  };
})();
