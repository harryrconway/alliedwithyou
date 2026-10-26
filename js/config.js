/*
  Public settings for the website and the staff dashboard.
  Only publishable keys belong here. They're safe in website code because the
  database's Row Level Security decides what each signed in person can see.
  The live domain uses production. Anywhere else (this Mac, tests) uses the test project.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const host = window.location.hostname;
  const live = host === 'alliedwithyou.com.au' || host === 'www.alliedwithyou.com.au';

  const projects = {
    production: { url: 'https://trqnpgawtuglrujifvcz.supabase.co', key: 'sb_publishable_zLT-rS4F-tvmvahbXHvKUw_VqaVcKbO' },
    staging: { url: 'https://nndtedqltzavzxfegdka.supabase.co', key: 'sb_publishable_nnzfmVS6T1nrR9zO1wdViQ_CyqsuRY9' }
  };
  const project = live ? projects.production : projects.staging;

  AWY.config = {
    environment: live ? 'production' : 'staging',
    version: '1.0.0',
    supabaseUrl: project.url,
    supabaseKey: project.key,
    enquiryUrl: project.url + '/functions/v1/enquiry',
    emailDomain: 'alliedwithyou.com.au',
    practiceEmail: 'hello@alliedwithyou.com.au',
    reservedEmails: ['admin@alliedwithyou.com.au', 'jake@alliedwithyou.com.au', 'chelsie@alliedwithyou.com.au'],
    idleMinutes: 30
  };
})();
