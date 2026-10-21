/*
  Sections, roles and what each role can do.
  This decides what the interface shows. The database enforces the same rules with
  Row Level Security, so hiding something here is never the only protection.

  Sections marked locked aren't switched on yet. They stay in the menu, greyed out,
  until the practice is ready to keep that information in the dashboard.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const SECTIONS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home', group: 'Overview', state: 'open' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', group: 'Overview', state: 'open' },
    { key: 'tasks', label: 'Tasks', icon: 'tasks', group: 'Overview', state: 'open' },
    { key: 'clients', label: 'Client records', icon: 'users', group: 'Clients', state: 'locked' },
    { key: 'referrals', label: 'Enquiries and referrals', icon: 'inbox', group: 'Clients', state: 'locked' },
    { key: 'notes', label: 'Clinical notes', icon: 'note', group: 'Clinical', state: 'locked' },
    { key: 'assessments', label: 'Assessments', icon: 'clipboard', group: 'Clinical', state: 'locked' },
    { key: 'goals', label: 'Goals and progress', icon: 'target', group: 'Clinical', state: 'locked' },
    { key: 'reports', label: 'Clinical reports', icon: 'report', group: 'Clinical', state: 'locked' },
    { key: 'documents', label: 'Documents and consent', icon: 'folder', group: 'Records', state: 'locked' },
    { key: 'agreements', label: 'Service agreements', icon: 'signature', group: 'Records', state: 'locked' },
    { key: 'templates', label: 'Templates', icon: 'clipboard', group: 'Records', state: 'open' },
    { key: 'funding', label: 'Funding and services', icon: 'wallet', group: 'Billing', state: 'locked' },
    { key: 'invoices', label: 'Invoices', icon: 'receipt', group: 'Billing', state: 'locked' },
    { key: 'incidents', label: 'Incidents and complaints', icon: 'alert', group: 'Practice', state: 'locked' },
    { key: 'staff', label: 'Team and access', icon: 'shield', group: 'Practice', state: 'open' },
    { key: 'statistics', label: 'Reports and downloads', icon: 'chart', group: 'Practice', state: 'open' },
    { key: 'history', label: 'Change history', icon: 'history', group: 'Practice', state: 'open' },
    { key: 'settings', label: 'Settings', icon: 'settings', group: 'Practice', state: 'open' },
    { key: 'feedback', label: 'Feedback and issues', icon: 'message', group: 'Practice', state: 'open' },
    { key: 'privacy', label: 'Privacy requests', icon: 'lock', group: 'Practice', state: 'open' }
  ];

  const ALL = SECTIONS.map((s) => s.key);

  const ROLES = {
    administrator: {
      label: 'Administrator',
      summary: 'Everything, including approving accounts, roles, settings, fees, reports and downloads.',
      sections: ALL
    },
    therapist: {
      label: 'Occupational therapist',
      summary: 'The calendar, tasks, templates and the team list. Settings and fees can be viewed but not changed.',
      sections: ['dashboard', 'clients', 'referrals', 'calendar', 'notes', 'assessments', 'goals', 'reports', 'documents', 'agreements', 'templates', 'funding', 'tasks', 'staff', 'settings', 'feedback', 'privacy']
    },
    reception: {
      label: 'Reception',
      summary: 'The calendar, tasks, templates and the team list. Settings and fees can be viewed but not changed.',
      sections: ['dashboard', 'clients', 'referrals', 'calendar', 'documents', 'agreements', 'templates', 'funding', 'invoices', 'tasks', 'staff', 'settings', 'feedback', 'privacy']
    },
    support: {
      label: 'Support staff',
      summary: 'Their own calendar entries and tasks, templates and the team list.',
      sections: ['dashboard', 'clients', 'calendar', 'notes', 'goals', 'templates', 'tasks', 'staff', 'feedback', 'privacy']
    },
    developer: {
      label: 'Developer',
      summary: 'Feedback, reported issues and error reports, for fixing problems. No practice records.',
      sections: ['dashboard', 'staff', 'feedback']
    }
  };

  /* Actions within sections */
  const CAPABILITIES = {
    manageStaff: ['administrator'],
    settings: ['administrator'],
    fees: ['administrator'],
    everyCalendar: ['administrator'],
    deleteAnyTask: ['administrator'],
    manageTemplates: ['administrator'],
    manageChecks: ['administrator'],
    reviewFeedback: ['administrator', 'developer'],
    viewErrors: ['administrator', 'developer'],
    managePrivacy: ['administrator']
  };

  const CAPABILITY_LABELS = {
    manageStaff: 'Approve accounts and change roles',
    settings: 'Change practice settings',
    fees: 'Change fees',
    everyCalendar: "Manage everyone's calendar entries",
    deleteAnyTask: "Delete other people's tasks",
    manageTemplates: 'Add, update and approve templates',
    manageChecks: "Record staff checks and registrations",
    reviewFeedback: 'Review feedback and reported issues',
    viewErrors: 'See error reports',
    managePrivacy: 'Work privacy requests'
  };

  let user = null;

  const section = (key) => SECTIONS.find((s) => s.key === key) || null;

  AWY.access = {
    SECTIONS: SECTIONS,
    ROLES: ROLES,
    CAPABILITIES: CAPABILITIES,
    CAPABILITY_LABELS: CAPABILITY_LABELS,
    setUser(profile) {
      user = profile;
    },
    user() {
      return user;
    },
    role() {
      return user ? user.role : null;
    },
    section: section,
    isLocked(key) {
      const s = section(key);
      return !!s && s.state === 'locked';
    },
    /* Part of the role, whether or not the section is switched on yet */
    inRole(key, role) {
      const r = ROLES[role || (user && user.role)];
      return !!r && r.sections.includes(key);
    },
    canSee(key, role) {
      return AWY.access.inRole(key, role) && !AWY.access.isLocked(key);
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
