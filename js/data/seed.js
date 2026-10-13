/*
  Fictional sample data for the demo.

  Every person, phone number, email address and clinical detail here is made up.
  Phone numbers come from the ranges the ACMA reserves for fiction, and email
  addresses use example domains. Dates are worked out relative to the day the
  data is created, so the calendar always has recent and upcoming appointments.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  function build(today) {
    const D = AWY.date;
    const day = (n) => D.addDays(today, n);
    /* Moves weekend dates onto a weekday, forwards for future dates and backwards for past ones */
    const workday = (n) => {
      let x = day(n);
      const w = D.weekday(x);
      if (w === 0) x = D.addDays(x, n >= 0 ? 1 : -2);
      if (w === 6) x = D.addDays(x, n >= 0 ? 2 : -1);
      return x;
    };
    const stamp = (date, time) => new Date(date + 'T' + (time || '09:00') + ':00').toISOString();
    const year = Number(today.slice(0, 4));
    const fyStart = Number(today.slice(5, 7)) >= 7 ? year + '-07-01' : year - 1 + '-07-01';
    const prevFyStart = D.addMonths(fyStart, -12);
    const prevFyEnd = D.addDays(fyStart, -1);
    const dob = (age, mmdd) => year - age + '-' + mmdd;

    const t = {
      staff: [], clients: [], contacts: [], referrals: [], consents: [], agreements: [], appointments: [],
      notes: [], assessments: [], goals: [], progress: [], reports: [], documents: [], fundingPlans: [],
      supportItems: [], supportLogs: [], invoices: [], invoiceLines: [], tasks: [], incidents: [], auditEvents: [], settings: []
    };

    /* Staff */
    t.staff.push(
      { id: 'st_hannah', name: 'Hannah Clarke', role: 'owner', title: 'Occupational therapist and practice owner', email: 'hannah@alliedwithyou.example', phone: '0491 570 156', registration: 'OCC0000000101', active: true },
      { id: 'st_priya', name: 'Priya Raman', role: 'therapist', title: 'Occupational therapist', email: 'priya@alliedwithyou.example', phone: '0491 570 157', registration: 'OCC0000000102', active: true },
      { id: 'st_tom', name: 'Tom Gallagher', role: 'admin', title: 'Practice administrator', email: 'tom@alliedwithyou.example', phone: '0491 570 158', registration: '', active: true },
      { id: 'st_mia', name: 'Mia Fraser', role: 'support', title: 'Allied health assistant', email: 'mia@alliedwithyou.example', phone: '0491 570 159', registration: '', active: true }
    );

    /* Price items. Each version has effective dates so older records keep the rate that applied at the time. */
    const NDIS_CODE = '15_056_0128_1_3';
    const priceItem = (key, name, funding, code, unit, current, previous, notes) => {
      t.supportItems.push({ id: 'si_' + key + '_prev', key, name, funding, code, unit, rate: previous, effectiveFrom: prevFyStart, effectiveTo: prevFyEnd, notes, sample: true });
      t.supportItems.push({ id: 'si_' + key, key, name, funding, code, unit, rate: current, effectiveFrom: fyStart, effectiveTo: '', notes, sample: true });
    };
    priceItem('private_initial', 'Initial assessment, up to two hours', 'private', '', 'session', 380, 360, 'Sample rate. Includes a short written summary.');
    priceItem('private_therapy', 'Therapy session', 'private', '', 'hour', 190, 180, 'Sample rate. Charged per hour, pro rata.');
    priceItem('private_short', 'Short review, around 30 minutes', 'private', '', 'session', 100, 95, 'Sample rate.');
    priceItem('private_report', 'Report writing', 'private', '', 'hour', 190, 180, 'Sample rate. An estimate is given before writing begins.');
    priceItem('private_travel', 'Travel beyond the first 20 minutes', 'private', '', 'hour', 95, 90, 'Sample rate.');
    priceItem('ndis_ot', 'Occupational therapy: assessment, recommendation, therapy or training', 'ndis', NDIS_CODE, 'hour', 193.99, 188.99, 'Sample price limit. Check against the current NDIS Pricing Arrangements and Price Limits.');
    priceItem('ndis_travel', 'Provider travel for occupational therapy', 'ndis', NDIS_CODE, 'hour', 193.99, 188.99, 'Sample. Travel rules and limits depend on the participant\'s location.');
    priceItem('ndis_report', 'Non face to face: report writing', 'ndis', NDIS_CODE, 'hour', 193.99, 188.99, 'Sample. Must be agreed with the participant in advance.');
    priceItem('ndis_cancel', 'Short notice cancellation', 'ndis', NDIS_CODE, 'hour', 193.99, 188.99, 'Sample. Only where the service agreement allows it.');
    priceItem('sah_ot', 'Allied health: occupational therapy (Support at Home)', 'sah', '', 'hour', 190, 180, 'Sample rate agreed with Support at Home providers.');
    priceItem('medicare_ot', 'Medicare rebate reference for occupational therapy', 'medicare', '10958', 'session', 61.2, 60.35, 'Sample. Rebate paid to the client by Medicare, shown for reference only.');

    /* Settings */
    t.settings.push({
      id: 'practice',
      business: Object.assign({}, AWY.business),
      acceptedFunding: ['private', 'healthfund', 'medicare', 'sah', 'ndis_self', 'ndis_plan'],
      services: ['assessments', 'independence', 'home', 'technology', 'therapy', 'reports'],
      durations: { initial: 120, therapy: 60, homevisit: 90, assessment: 120, equipment: 60, review: 30 },
      dayStart: '08:00',
      dayEnd: '17:30',
      travelBuffer: 15,
      invoiceTerms: 14,
      automations: { referralTask: true, consentTask: true, supportLogs: true, noteTask: true, closeNoteTask: true, agreementTask: true },
      agreementTemplates: {
        private: {
          conditions: 'Fees are charged as listed in the current fee schedule. Invoices are sent after each appointment and are due within 14 days. GST does not apply to occupational therapy services.',
          cancellation: 'Please give at least 24 hours notice to cancel or change an appointment. Late cancellations may be charged at the rate shown in the fee schedule.'
        },
        ndis: {
          conditions: 'Supports are charged in line with the NDIS Pricing Arrangements and Price Limits current at the time of service. Provider travel and non face to face time, such as report writing, are charged where agreed. Invoices are sent to the plan manager or participant as listed in this agreement.',
          cancellation: 'Short notice cancellations are charged in line with the NDIS Pricing Arrangements and Price Limits. A cancellation is short notice when less than two clear business days notice is given.'
        },
        sah: {
          conditions: 'Services are invoiced to the Support at Home provider at the agreed rate. The provider manages any contribution arrangements with the client.',
          cancellation: 'Please give at least 24 hours notice to cancel or change an appointment.'
        }
      }
    });

    /* Fictional organisations used across the records */
    const ORG = {
      clearpath: 'ClearPath Plan Management (demo)',
      tweedplans: 'Tweed Coast Plan Partners (demo)',
      riverbend: 'Riverbend Home Care (demo)',
      seaview: 'Seaview Community Care (demo)',
      northernlight: 'Northern Light Support Coordination (demo)',
      ballinagp: 'Ballina Family Practice (demo)',
      helensvalegp: 'Helensvale Medical Centre (demo)'
    };

    /*
      Client definitions. Each one carries its own related records so the
      relationships between them stay consistent.
      Appointment rows: [dayOffset, start, type, minutes, location, travelMins, note, extra]
    */
    const clients = [
      {
        id: 'cl_margaret', firstName: 'Margaret', lastName: 'Hill', preferredName: 'Marg', dob: dob(81, '03-14'),
        phone: '0491 570 313', email: 'marg.hill@example.com', address: 'Villa 6, 18 Kirkwood Road', suburb: 'Tweed Heads South', state: 'NSW', postcode: '2486',
        status: 'active', therapistId: 'st_hannah', fundingType: 'sah', startDate: day(-74), referralSource: 'Riverbend Home Care care partner',
        alerts: 'Small friendly dog. Knock loudly, Marg is hard of hearing on her left side.',
        background: 'Referred after a fall in the bathroom three months ago. No fracture, but Marg has lost confidence showering and has stopped going to the shops on her own.',
        livingSituation: 'Lives alone in a single level villa. Daughter Karen lives ten minutes away and visits most days. Receives cleaning once a fortnight through her Support at Home package.',
        health: 'Osteoarthritis in both knees. Mild macular degeneration. Takes blood pressure medication.',
        communication: 'Speak clearly and face her. Prefers written summaries she can read later.',
        contacts: [
          { name: 'Karen Stone', kind: 'family', relationship: 'Daughter', phone: '0491 570 737', email: 'karen.stone@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Deb Hollis', kind: 'provider', relationship: 'Care partner', organisation: ORG.riverbend, phone: '02 5550 1184', email: 'deb.hollis@example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-74), givenBy: 'Margaret Hill', method: 'written' },
          { type: 'share_coordinator', date: day(-74), givenBy: 'Margaret Hill', method: 'written', limitations: 'Share with her Riverbend care partner only.' },
          { type: 'photos', date: day(-60), givenBy: 'Margaret Hill', method: 'verbal', limitations: 'Photos of the bathroom and entry only, for the modification report.' }
        ],
        agreement: { template: 'sah', start: -76, end: 289, status: 'signed', signed: -74, services: ['home', 'technology', 'independence'] },
        plan: { name: 'Support at Home budget', fundingType: 'sah', start: -200, end: 165, budget: 2400, managedBy: ORG.riverbend, reference: 'SAH 40217' },
        goals: [
          { description: 'Shower on my own without worrying about falling', area: 'selfcare', status: 'active', created: -60, review: 10, baseline: 3, target: 8,
            progress: [[-45, 4, 'Shower chair and hand held shower installed. Showering with Karen nearby.'], [-24, 6, 'Grab rails now in. Showering alone on weekdays with her alarm pendant on.'], [-3, 7, 'Reports feeling steady. Still asks Karen to be in the house on hot days.']] },
          { description: 'Get to the shops at Tweed City once a week', area: 'community', status: 'active', created: -60, review: 24, baseline: 2, target: 7,
            progress: [[-31, 3, 'Practised getting on and off the community bus with support.'], [-10, 5, 'Managed the bus trip with Karen following in the car.']] }
        ],
        assessments: [
          { type: 'initial', date: -70, status: 'completed', methods: ['interview', 'observation', 'copm'], findings: 'Marg manages most personal care but avoids showering when alone. COPM priorities were showering (performance 3, satisfaction 2) and shopping (performance 2, satisfaction 3).', functionalNeeds: 'Support and equipment for safe showering. Graded return to community outings.', recommendations: 'Home safety assessment. Trial of shower chair and hand held shower. Community access practice.' },
          { type: 'home', date: -62, status: 'reviewed', methods: ['westmead', 'observation', 'measure'], findings: 'Hob into shower recess 70 mm. No grab rails. Bath mat slides on tiles. Poor lighting in hallway at night. Toilet height 400 mm.', functionalNeeds: 'Safe transfer in and out of the shower and on and off the toilet. Safe path to the toilet overnight.', recommendations: 'Two grab rails in the shower and one beside the toilet. Shower chair with back. Hand held shower on a rail. Remove loose mats. Plug in sensor night lights.' }
        ],
        reports: [
          { type: 'homemod', status: 'delivered', due: -50, delivered: -48, recipient: ORG.riverbend, method: 'portal', title: 'Home modification report', summary: 'Recommendations for minor bathroom and toilet modifications and equipment, funded through the Support at Home package.' }
        ],
        documents: [
          { name: 'Referral from Riverbend Home Care.pdf', type: 'referral', date: -76, size: 184320 },
          { name: 'Westmead Home Safety Assessment form.pdf', type: 'assessment', date: -62, size: 402112 },
          { name: 'Grab rail installation quote.pdf', type: 'correspondence', date: -45, size: 96544 }
        ],
        appointments: [
          [-70, '10:00', 'initial', 120, 'home', 25, { template: 'initial', goals: [], reason: 'Referred by her care partner after a fall in the bathroom.', interventions: 'Interview with Marg and Karen. Observed transfers on and off the toilet, bed and lounge chair. Completed the COPM.', observations: 'Mobilises independently with a single point stick. Uses furniture to steady herself in the bathroom. Sit to stand from the lounge needs two attempts.', progress: 'Priorities agreed: showering safely and getting back to the shops.', plan: 'Home safety assessment next week. Discuss equipment options with Karen.' }],
          [-62, '09:30', 'homevisit', 90, 'home', 25, { goals: [0], reason: 'Home safety assessment.', interventions: 'Completed the Westmead Home Safety Assessment. Measured the bathroom, toilet and entry.', observations: 'See assessment record. Main risks are the shower hob, the lack of rails and loose mats.', progress: 'Marg is keen on rails but worried about cost. Explained Support at Home funding.', plan: 'Write home modification report for Riverbend. Arrange shower chair trial.' }],
          [-45, '13:30', 'equipment', 60, 'home', 25, { goals: [0], reason: 'Shower chair and hand held shower trial.', interventions: 'Trialled two shower chairs. Set the height and practised getting on and off. Fitted hand held shower to the existing rail.', observations: 'Managed the transfer safely with the chair that has arms. Needed reminding to turn off the water before standing.', progress: 'Showering seated with Karen nearby.', plan: 'Order the chair through Riverbend. Review once rails are installed.' }],
          [-31, '10:00', 'therapy', 60, 'community', 25, { goals: [1], reason: 'Community access practice.', interventions: 'Walked to the bus stop together. Practised getting on and off the bus and paying with her card.', observations: 'Steady on the bus step using the rail. Tired on the walk back, rested twice.', progress: 'Bus trip completed with support.', plan: 'Repeat with Karen following in the car. Look at a shopping trolley with a seat.' }],
          [-24, '11:30', 'review', 30, 'home', 25, { goals: [0], reason: 'Review after grab rail installation.', interventions: 'Checked rail placement and practised transfers in and out of the shower.', observations: 'Rails installed at the recommended heights. Transfer smooth and confident.', progress: 'Now showering alone on weekdays.', plan: 'Continue. Check in on the shopping goal next visit.' }],
          [-10, '10:00', 'therapy', 60, 'community', 25, { goals: [1], reason: 'Shopping trip practice.', interventions: 'Bus trip to Tweed City with Karen following. Practised using a trolley with a seat in the supermarket.', observations: 'Managed the trip with one rest. Found the trolley seat helpful in the checkout queue.', progress: 'Rated the outing 5 out of 10, up from 2.', plan: 'One more supported trip, then try on her own with a phone check in.' }],
          [-3, '13:30', 'review', 30, 'home', 25, { goals: [0, 1], reason: 'Progress review.', interventions: 'Reviewed both goals with Marg. Updated COPM ratings.', observations: 'Showering confidently. Some nerves about going out alone.', progress: 'Showering goal close to achieved.', plan: 'Plan a solo shopping trip with a phone check in. Review goals in two weeks.', status: 'draft' }],
          [5, '10:00', 'therapy', 60, 'community', 25, null],
          [19, '10:00', 'review', 30, 'home', 25, null]
        ],
        tasks: [
          { title: 'Check Marg is happy with the night lights Karen bought', due: 6, priority: 'low', assignedTo: 'st_mia' }
        ]
      },

      {
        id: 'cl_jack', firstName: 'Jack', lastName: 'Thompson', dob: dob(34, '08-02'),
        phone: '0491 571 266', email: 'jack.thompson@example.com', address: '3/41 Connor Street', suburb: 'Burleigh Heads', state: 'QLD', postcode: '4220',
        status: 'active', therapistId: 'st_priya', fundingType: 'ndis_plan', ndisNumber: '430000011', startDate: day(-190), referralSource: 'Sam Nguyen, support coordinator',
        alerts: 'Prefers morning appointments. Fatigue builds after lunch.',
        background: 'Acquired brain injury from a motorbike accident just over two years ago. Referred to build independence with cooking, travel and a return to work.',
        livingSituation: 'Lives with his partner Ella in a ground floor unit. Ella works full time.',
        health: 'Acquired brain injury affecting memory, planning and fatigue. Mild left sided weakness.',
        communication: 'Use written steps and his phone calendar. Check understanding by asking him to explain back.',
        contacts: [
          { name: 'Ella Morgan', kind: 'family', relationship: 'Partner', phone: '0491 571 491', email: 'ella.morgan@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Sam Nguyen', kind: 'coordinator', relationship: 'Support coordinator', organisation: ORG.northernlight, phone: '07 5550 2231', email: 'sam.nguyen@example.org', canDiscuss: true },
          { name: 'Accounts team', kind: 'planmanager', relationship: 'Plan manager', organisation: ORG.clearpath, phone: '07 5550 4410', email: 'accounts@clearpath.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-190), givenBy: 'Jack Thompson', method: 'written' },
          { type: 'share_coordinator', date: day(-190), givenBy: 'Jack Thompson', method: 'written', limitations: 'Do not share details from his neuropsychology report.' },
          { type: 'share_planmanager', date: day(-190), givenBy: 'Jack Thompson', method: 'written', limitations: 'Invoices and service dates only.' }
        ],
        agreement: { template: 'ndis', start: -192, end: 60, status: 'signed', signed: -190, services: ['therapy', 'independence', 'reports'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_plan', start: -305, end: 60, budget: 9800, managedBy: ORG.clearpath, reference: 'Plan ending ' + D.addDays(today, 60).slice(0, 4) },
        goals: [
          { description: 'Cook a simple dinner for Ella and me twice a week', area: 'domestic', status: 'active', created: -180, review: 12, baseline: 2, target: 8,
            progress: [[-150, 3, 'Following a picture recipe with prompts.'], [-90, 5, 'Cooked pasta bake with one prompt.'], [-35, 6, 'Planning and shopping for two meals a week using his phone list.'], [-8, 7, 'Cooked twice last week without prompts. Needed help with timing.']] },
          { description: 'Catch the bus to work at the surf shop on my own', area: 'community', status: 'active', created: -180, review: 12, baseline: 1, target: 8,
            progress: [[-120, 3, 'Practised the route with Mia.'], [-60, 6, 'Travelling alone with a phone check in.'], [-15, 8, 'Travelling to work independently three days a week.']] },
          { description: 'Go back to work two days a week', area: 'work', status: 'achieved', created: -180, review: -30, baseline: 0, target: 7,
            progress: [[-100, 4, 'Started one short shift a week.'], [-40, 7, 'Working two shifts a week. Employer happy.']] }
        ],
        assessments: [
          { type: 'initial', date: -186, status: 'completed', methods: ['interview', 'observation', 'copm', 'whodas'], findings: 'Difficulty with planning and sequencing multi step tasks. Fatigue after 90 minutes of activity. WHODAS 2.0 score indicates moderate difficulty in getting around and life activities.', functionalNeeds: 'Prompts and routines for meal preparation. Structured travel training. Graded return to work.', recommendations: 'Weekly therapy for six months with allied health assistant support for travel training.' }
        ],
        reports: [
          { type: 'progress', status: 'draft', due: 18, recipient: 'NDIA, for his plan reassessment', title: 'Progress report for plan reassessment', summary: 'Summary of progress against goals over the current plan, with recommended supports for the next plan.' }
        ],
        documents: [
          { name: 'NDIS plan, approved supports.pdf', type: 'plan', date: -305, size: 512000 },
          { name: 'Referral from Northern Light Support Coordination.pdf', type: 'referral', date: -195, size: 140288 },
          { name: 'Weekly cooking routine for Jack.pdf', type: 'correspondence', date: -60, size: 88064 }
        ],
        appointments: [
          [-38, '09:00', 'therapy', 60, 'home', 20, { goals: [0], reason: 'Meal preparation.', interventions: 'Planned two dinners for the week using his phone list. Cooked a stir fry with a step by step recipe card.', observations: 'Lost his place in the recipe once and recovered by checking the card. Left the stove on after serving.', progress: 'Rated cooking 6 out of 10.', plan: 'Add a "stove off" step to every card. Practise timing two dishes.' }],
          [-31, '09:00', 'therapy', 60, 'community', 10, { goals: [1], reason: 'Travel training review.', interventions: 'Observed his trip to work from the bus stop. Discussed what to do if the bus is late.', observations: 'Confident and on time. Used his phone to check the timetable.', progress: 'Travelling alone three days a week.', plan: 'Fade to occasional checks only.' }],
          [-24, '09:00', 'therapy', 60, 'home', 20, { goals: [0], reason: 'Meal preparation.', interventions: 'Cooked a two part meal. Used phone timers for each part.', observations: 'Managed both timers. Some fatigue towards the end, sat down to finish chopping.', progress: 'Close to target.', plan: 'Continue weekly. Start drafting progress report.' }],
          [-17, '09:00', 'therapy', 60, 'home', 20, { goals: [0], reason: 'Meal preparation.', interventions: 'Jack cooked lasagne with Ella present. Reviewed the week\'s meal plan.', observations: 'No prompts needed. Asked for help reading the oven temperature.', progress: 'Ella reports he cooked twice last week.', plan: 'Next session: problem solving when ingredients are missing.' }],
          [-15, '10:30', 'therapy', 60, 'community', 0, { goals: [1], reason: 'Community session with allied health assistant.', interventions: 'Mia met Jack at the bus interchange and observed the transfer to his work bus.', observations: 'Managed the transfer independently. Chose a seat near the front without prompting.', progress: 'Travel goal met.', plan: 'Report back to Priya. No further travel sessions planned.' }, { staff: 'st_mia' }],
          [-10, '09:00', 'therapy', 60, 'home', 20, null, { cancel: { reason: 'Jack unwell with a cold, cancelled the day before.', late: false } }],
          [-8, '09:00', 'therapy', 60, 'home', 20, { goals: [0, 1], reason: 'Progress review ahead of plan reassessment.', interventions: 'Reviewed goals and updated COPM. Discussed what Jack wants from his next plan.', observations: 'Jack wants to increase work hours and cook more independently.', progress: 'Cooking 7 out of 10. Travel 8 out of 10.', plan: 'Write progress report. Share draft with Jack before it goes to the NDIA.' }],
          [-1, '09:00', 'therapy', 60, 'home', 20, null],
          [6, '09:00', 'therapy', 60, 'home', 20, null],
          [13, '09:00', 'review', 30, 'telehealth', 0, null]
        ],
        tasks: [
          { title: 'Ask Sam for the plan reassessment meeting date', due: -2, priority: 'high', assignedTo: 'st_tom' },
          { title: 'Share draft progress report with Jack and Ella', due: 12, priority: 'normal', assignedTo: 'st_priya' }
        ]
      },

      {
        id: 'cl_aisha', firstName: 'Aisha', lastName: 'Rahman', dob: dob(27, '11-21'),
        phone: '0491 571 804', email: 'aisha.rahman@example.com', address: '12/7 Davenport Street', suburb: 'Southport', state: 'QLD', postcode: '4215',
        status: 'active', therapistId: 'st_priya', fundingType: 'ndis_self', ndisNumber: '430000012', startDate: day(-130), referralSource: 'Self referral',
        alerts: 'Unit is on level two with a lift. Visitor parking at the rear.',
        background: 'Moved into her first rental on her own and wants to set up the bathroom and kitchen so she can manage independently.',
        livingSituation: 'Lives alone in a rental unit. Has support workers three mornings a week. Studying part time at university.',
        health: 'Cerebral palsy (spastic diplegia). Walks with forearm crutches indoors and uses a manual wheelchair for longer distances.',
        communication: 'Prefers email for scheduling and documents.',
        contacts: [
          { name: 'Yasmin Rahman', kind: 'family', relationship: 'Sister', phone: '0491 572 549', email: 'yasmin.rahman@example.com', canDiscuss: false }
        ],
        consents: [
          { type: 'treatment', date: day(-130), givenBy: 'Aisha Rahman', method: 'electronic' },
          { type: 'telehealth', date: day(-130), givenBy: 'Aisha Rahman', method: 'electronic' }
        ],
        agreement: { template: 'ndis', start: -132, end: -2, status: 'signed', signed: -130, services: ['technology', 'independence'], renewal: { status: 'awaiting', sent: -3 } },
        plan: { name: 'NDIS plan', fundingType: 'ndis_self', start: -120, end: 245, budget: 7200, managedBy: 'Self managed', reference: 'Self managed plan' },
        goals: [
          { description: 'Shower safely on my own in my new bathroom', area: 'selfcare', status: 'active', created: -125, review: 20, baseline: 3, target: 8,
            progress: [[-90, 4, 'Using a borrowed stool. Not stable.'], [-20, 5, 'Trialling a tilt in space shower commode.']] },
          { description: 'Prepare my own lunches during the week', area: 'domestic', status: 'active', created: -125, review: 34, baseline: 4, target: 8,
            progress: [[-60, 6, 'Rearranged the kitchen so everyday items are within reach from her wheelchair.']] }
        ],
        assessments: [
          { type: 'at', date: -20, status: 'inprogress', methods: ['interview', 'observation', 'measure'], findings: 'Shower recess is level entry but narrow (820 mm). Standing transfer with crutches is unsafe on wet tiles.', functionalNeeds: 'Seated showering with a stable, mobile commode that fits the recess.', recommendations: 'Trial two commode options. Recommendation report for NDIS Capital funding once the trial is complete.' }
        ],
        reports: [
          { type: 'at', status: 'draft', due: -3, recipient: 'NDIA, for assistive technology funding', title: 'Assistive technology recommendation: shower commode', summary: 'Recommendation and quote for a mobile shower commode following an in home trial.' }
        ],
        documents: [
          { name: 'Shower commode quote from supplier.pdf', type: 'correspondence', date: -12, size: 77824 },
          { name: 'Kitchen layout photos.pdf', type: 'assessment', date: -60, size: 1048576 }
        ],
        appointments: [
          [-60, '13:30', 'therapy', 60, 'home', 15, { goals: [1], reason: 'Kitchen set up.', interventions: 'Moved everyday items to lower cupboards. Trialled a reacher and a kitchen trolley.', observations: 'Can reach the microwave and kettle from her wheelchair. Fridge door is heavy to open from sitting.', progress: 'Making lunch three days a week.', plan: 'Look at a fridge door strap. Shower assessment next.' }],
          [-20, '13:30', 'assessment', 90, 'home', 15, { goals: [0], reason: 'Assistive technology assessment for showering.', interventions: 'Measured the bathroom and observed a dry run of the transfer. Discussed commode options.', observations: 'See assessment record.', progress: 'Agreed to trial two options.', plan: 'Arrange supplier trial. Draft recommendation report.' }],
          [-12, '14:00', 'equipment', 60, 'home', 15, { goals: [0], reason: 'Shower commode trial.', interventions: 'Trialled two tilt in space commodes with the supplier present.', observations: 'The narrower model fits the recess and allows her to self propel. Brakes easy to reach.', progress: 'Aisha prefers the narrower model.', plan: 'Get a formal quote. Finish the report.', status: 'draft' }],
          [3, '13:30', 'therapy', 60, 'telehealth', 0, null],
          [17, '13:30', 'therapy', 60, 'home', 15, null]
        ],
        tasks: [
          { title: 'Finish shower commode recommendation for Aisha', due: -3, priority: 'high', assignedTo: 'st_priya' }
        ]
      },

      {
        id: 'cl_robert', firstName: 'Robert', lastName: 'Ellis', preferredName: 'Bob', dob: dob(74, '06-09'),
        phone: '02 5550 3317', email: 'bob.ellis@example.com', address: '27 Owen Street', suburb: 'Ballina', state: 'NSW', postcode: '2478',
        status: 'active', therapistId: 'st_hannah', fundingType: 'medicare', startDate: day(-58), referralSource: 'Dr Lena Fischer, GP',
        alerts: 'Park on the street, the driveway is steep.',
        background: 'Two falls at night on the way to the toilet in the last six months. GP referral under a chronic condition management plan.',
        livingSituation: 'Lives with his wife Judy in a two storey house. Bedroom and bathroom are upstairs.',
        health: 'Parkinson\'s disease diagnosed four years ago. Freezing episodes when turning. Wears glasses.',
        communication: 'Softly spoken. Allow extra time for answers.',
        contacts: [
          { name: 'Judy Ellis', kind: 'family', relationship: 'Wife', phone: '0491 572 665', email: 'judy.ellis@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Dr Lena Fischer', kind: 'gp', relationship: 'GP', organisation: ORG.ballinagp, phone: '02 5550 7720', email: 'reception@ballinagp.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-58), givenBy: 'Robert Ellis', method: 'written' },
          { type: 'share_gp', date: day(-58), givenBy: 'Robert Ellis', method: 'written' }
        ],
        agreement: { template: 'private', start: -58, end: 307, status: 'signed', signed: -58, services: ['home', 'therapy'] },
        plan: { name: 'Medicare GP chronic condition management plan', fundingType: 'medicare', start: year + '-01-01', end: year + '-12-31', sessionsAllowed: 5, managedBy: 'Medicare', reference: 'Referral from Dr Lena Fischer' },
        goals: [
          { description: 'Get to the toilet at night without falling', area: 'safety', status: 'active', created: -55, review: 4, baseline: 3, target: 8,
            progress: [[-40, 5, 'Sensor lights and bed lever in place.'], [-12, 7, 'No falls in four weeks. Using a urinal bottle on bad nights.']] },
          { description: 'Keep looking after my vegetable garden', area: 'leisure', status: 'active', created: -55, review: 30, baseline: 5, target: 8,
            progress: [[-26, 6, 'Using a garden kneeler with handles and raised planter boxes.']] }
        ],
        assessments: [
          { type: 'falls', date: -55, status: 'completed', methods: ['interview', 'observation', 'fes'], findings: 'High concern about falling (Falls Efficacy Scale). Freezing when turning in the narrow hallway. No night lighting.', functionalNeeds: 'Safer night time toileting and turning strategies.', recommendations: 'Sensor lighting, bed lever, cueing strategies for freezing, review of footwear.' },
          { type: 'home', date: -40, status: 'completed', methods: ['westmead', 'measure'], findings: 'Steep stairs with a rail on one side only. Bathroom upstairs. Loose rugs in hallway.', functionalNeeds: 'Second stair rail. Remove rugs.', recommendations: 'Install a second handrail. Remove hallway rugs. Consider moving the bedroom downstairs in future.' }
        ],
        reports: [
          { type: 'gp', status: 'completed', due: 2, recipient: 'Dr Lena Fischer', title: 'Letter to GP: falls prevention update', summary: 'Update on falls prevention strategies and remaining Medicare sessions.' }
        ],
        documents: [
          { name: 'GP chronic condition management plan referral.pdf', type: 'referral', date: -60, size: 122880 }
        ],
        appointments: [
          [-55, '14:00', 'initial', 120, 'home', 15, { template: 'initial', goals: [0], reason: 'GP referral after two falls at night.', interventions: 'Interview with Bob and Judy. Falls Efficacy Scale. Observed his route from bed to toilet.', observations: 'Freezes when turning into the bathroom doorway. Hallway dark at night.', progress: 'Priority is safe night toileting.', plan: 'Recommend lighting and a bed lever. Teach cueing strategies.' }],
          [-40, '14:00', 'homevisit', 90, 'home', 15, { goals: [0], reason: 'Home safety assessment.', interventions: 'Westmead Home Safety Assessment. Measured stairs and bathroom.', observations: 'Stair rail on one side only. Loose hallway rugs.', progress: 'Judy has already removed one rug.', plan: 'Second stair rail. Review in three weeks.' }],
          [-26, '14:00', 'therapy', 60, 'home', 15, { goals: [0, 1], reason: 'Cueing strategies and garden set up.', interventions: 'Practised stepping to a count when turning. Set up a garden kneeler and raised planter.', observations: 'Counting out loud reduced freezing in the doorway.', progress: 'Bob says he feels safer at night.', plan: 'Check in after the rail is installed.' }],
          [-12, '14:00', 'review', 30, 'home', 15, null],
          [4, '14:00', 'review', 30, 'home', 15, null]
        ],
        tasks: [
          { title: 'Send falls prevention letter to Dr Fischer', due: 2, priority: 'normal', assignedTo: 'st_hannah' }
        ]
      },

      {
        id: 'cl_nina', firstName: 'Nina', lastName: 'Kowalski', dob: dob(58, '01-30'),
        phone: '0491 572 983', email: 'nina.kowalski@example.com', address: '9 Uralba Street', suburb: 'Lismore', state: 'NSW', postcode: '2480',
        status: 'active', therapistId: 'st_hannah', fundingType: 'healthfund', startDate: day(-46), referralSource: 'Self referral after a rheumatologist suggested OT',
        alerts: '',
        background: 'Rheumatoid arthritis flare affecting both hands and wrists. Works from home as a bookkeeper and is struggling with keyboard work and cooking.',
        livingSituation: 'Lives with her husband. Home office in the spare room.',
        health: 'Rheumatoid arthritis, currently in a flare. Morning stiffness for about an hour.',
        communication: 'Happy with telehealth for most sessions.',
        contacts: [],
        consents: [
          { type: 'treatment', date: day(-46), givenBy: 'Nina Kowalski', method: 'electronic' },
          { type: 'telehealth', date: day(-46), givenBy: 'Nina Kowalski', method: 'electronic' }
        ],
        agreement: { template: 'private', start: -46, end: 319, status: 'signed', signed: -46, services: ['therapy', 'technology'] },
        plan: null,
        goals: [
          { description: 'Work at my computer for a full morning without hand pain', area: 'work', status: 'active', created: -44, review: 16, baseline: 3, target: 8,
            progress: [[-30, 5, 'New keyboard and mouse set up. Taking micro breaks.'], [-9, 6, 'Managing three hours with breaks.']] },
          { description: 'Cook dinner without needing my husband to open jars and lift pots', area: 'domestic', status: 'active', created: -44, review: 16, baseline: 4, target: 8,
            progress: [[-16, 6, 'Using a jar opener, lighter pots and sliding rather than lifting.']] }
        ],
        assessments: [],
        reports: [],
        documents: [
          { name: 'Joint protection handout.pdf', type: 'correspondence', date: -30, size: 233472 }
        ],
        appointments: [
          [-44, '11:00', 'initial', 120, 'home', 40, { template: 'initial', goals: [0, 1], reason: 'Self referral for hand pain with work and cooking.', interventions: 'Interview and COPM. Observed her desk set up and a cooking task.', observations: 'Wrists extended on the keyboard. Gripping pot handles tightly with both hands.', progress: 'Goals set for work and cooking.', plan: 'Ergonomic changes and joint protection education.' }],
          [-30, '11:00', 'therapy', 60, 'telehealth', 0, { goals: [0], reason: 'Workstation follow up.', interventions: 'Reviewed new keyboard and vertical mouse by video. Set up a break reminder.', observations: 'Wrist position much more neutral.', progress: 'Pain lower in the afternoons.', plan: 'Cooking strategies next session.' }],
          [-16, '11:00', 'therapy', 60, 'telehealth', 0, { goals: [1], reason: 'Joint protection in the kitchen.', interventions: 'Went through joint protection principles. Recommended a jar opener and lighter cookware.', observations: 'Nina already sliding pots on the bench.', progress: 'Cooking with fewer breaks.', plan: 'Review both goals in two weeks.' }],
          [0, '14:30', 'review', 30, 'telehealth', 0, null],
          [-9, '11:00', 'review', 30, 'telehealth', 0, { goals: [0, 1], reason: 'Progress check.', interventions: 'Reviewed pain diary and work hours.', observations: 'Managing three hours at the computer with breaks.', progress: 'Both goals improving.', plan: 'Continue current strategies. Review in a fortnight.' }],
          [8, '11:00', 'review', 30, 'telehealth', 0, null]
        ],
        tasks: []
      },

      {
        id: 'cl_daniel', firstName: 'Daniel', lastName: 'Whitfield', dob: dob(45, '04-17'),
        phone: '0491 573 770', email: 'daniel.whitfield@example.com', address: '58 Riverview Street', suburb: 'Murwillumbah', state: 'NSW', postcode: '2484',
        status: 'active', therapistId: 'st_hannah', fundingType: 'ndis_plan', ndisNumber: '430000013', startDate: day(-300), referralSource: 'Previous OT provider closed',
        alerts: 'Two dogs, kept in the backyard during visits.',
        background: 'Multiple sclerosis with increasing fatigue and balance changes. Needs a bathroom modification as stepping over the bath to shower is no longer safe.',
        livingSituation: 'Lives with his wife and two teenage children in a single level house.',
        health: 'Relapsing remitting multiple sclerosis. Fatigue worse in the heat.',
        communication: '',
        contacts: [
          { name: 'Lisa Whitfield', kind: 'family', relationship: 'Wife', phone: '0491 573 087', email: 'lisa.whitfield@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Invoices team', kind: 'planmanager', relationship: 'Plan manager', organisation: ORG.tweedplans, phone: '02 5550 6605', email: 'invoices@tweedplans.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-300), givenBy: 'Daniel Whitfield', method: 'written' },
          { type: 'share_planmanager', date: day(-300), givenBy: 'Daniel Whitfield', method: 'written' },
          { type: 'photos', date: day(-35), givenBy: 'Daniel Whitfield', method: 'written', limitations: 'Bathroom only.' }
        ],
        agreement: { template: 'ndis', start: -300, end: 35, status: 'signed', signed: -298, services: ['home', 'therapy', 'reports'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_plan', start: -330, end: 35, budget: 6500, managedBy: ORG.tweedplans, reference: 'Plan ending soon' },
        goals: [
          { description: 'Shower without having to step over the bath', area: 'selfcare', status: 'active', created: -40, review: 30, baseline: 2, target: 9,
            progress: [[-30, 3, 'Using a bath board as a temporary measure.']] },
          { description: 'Save enough energy to keep working three days a week', area: 'work', status: 'active', created: -280, review: 7, baseline: 4, target: 7,
            progress: [[-200, 5, 'Activity diary and pacing plan started.'], [-90, 6, 'Working three days with a rest break at lunch.'], [-20, 6, 'Holding steady. Heat is making it harder.']] }
        ],
        assessments: [
          { type: 'home', date: -35, status: 'completed', methods: ['westmead', 'measure', 'observation'], findings: 'Shower over bath. Bath edge 540 mm high. Unsteady stepping over even with a rail.', functionalNeeds: 'Level entry shower so he can shower seated without stepping over the bath.', recommendations: 'Remove the bath and install a level entry shower with a fold down seat and rails. Interim bath board.' }
        ],
        reports: [
          { type: 'homemod', status: 'review', due: 5, recipient: 'NDIA, for home modification funding', title: 'Home modification report: bathroom', summary: 'Recommendation to replace the shower over bath with a level entry shower, with interim equipment.' }
        ],
        documents: [
          { name: 'NDIS plan, approved supports.pdf', type: 'plan', date: -330, size: 480256 },
          { name: 'Bathroom photos and measurements.pdf', type: 'assessment', date: -35, size: 2306867 },
          { name: 'Builder quote for bathroom modification.pdf', type: 'correspondence', date: -14, size: 156672 }
        ],
        appointments: [
          [-35, '09:30', 'homevisit', 90, 'home', 30, { goals: [0], reason: 'Bathroom assessment for home modification.', interventions: 'Westmead assessment of the bathroom. Measured the room and observed the bath transfer.', observations: 'Unsteady when stepping over the bath edge. Fatigue after the transfer.', progress: 'Daniel and Lisa agree a level entry shower is needed.', plan: 'Bath board as an interim measure. Get builder quotes. Write report.' }],
          [-30, '09:30', 'equipment', 60, 'home', 30, { goals: [0], reason: 'Bath board set up.', interventions: 'Fitted a bath board and practised the seated transfer.', observations: 'Safe with the board. Lisa supervising for now.', progress: 'Interim solution in place.', plan: 'Report to NDIA once quotes are back.' }],
          [-20, '09:30', 'therapy', 60, 'home', 30, { goals: [1], reason: 'Fatigue management review.', interventions: 'Reviewed activity diary over a hot fortnight. Adjusted pacing plan.', observations: 'More fatigue on hot days. Not using the cooling vest.', progress: 'Work goal steady.', plan: 'Trial cooling strategies. Review in three weeks.' }],
          [-6, '09:30', 'therapy', 60, 'home', 30, null],
          [0, '09:30', 'therapy', 60, 'home', 30, null],
          [7, '09:30', 'review', 30, 'telehealth', 0, null]
        ],
        tasks: [
          { title: 'Send home modification report to Daniel to check before submitting', due: 3, priority: 'high', assignedTo: 'st_hannah' },
          { title: 'Remind Daniel his NDIS plan ends soon', due: 1, priority: 'normal', assignedTo: 'st_tom' }
        ]
      },

      {
        id: 'cl_grace', firstName: 'Grace', lastName: "O'Brien", dob: dob(88, '12-02'),
        phone: '07 5550 8842', email: '', address: '14 Palm Beach Avenue', suburb: 'Palm Beach', state: 'QLD', postcode: '4221',
        status: 'active', therapistId: 'st_priya', fundingType: 'sah', startDate: day(-95), referralSource: 'Michael O\'Brien, son',
        alerts: 'Michael is usually home. Grace may not remember the appointment, call Michael the day before.',
        background: 'Early stage dementia. Michael is worried about Grace using the stove and wants to help her keep making her own breakfast and lunch.',
        livingSituation: 'Lives with her son Michael, who works from home three days a week.',
        health: 'Early stage Alzheimer\'s disease. Good physical health for her age.',
        communication: 'Short sentences, one step at a time. Michael holds enduring power of attorney.',
        contacts: [
          { name: 'Michael O\'Brien', kind: 'representative', relationship: 'Son, enduring power of attorney', phone: '0491 574 118', email: 'michael.obrien@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Care coordinator', kind: 'provider', relationship: 'Support at Home provider', organisation: ORG.seaview, phone: '07 5550 3906', email: 'care@seaview.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-95), givenBy: 'Michael O\'Brien on behalf of Grace', method: 'written' },
          { type: 'share_coordinator', date: day(-95), givenBy: 'Michael O\'Brien on behalf of Grace', method: 'written' }
        ],
        agreement: { template: 'sah', start: -95, end: 270, status: 'signed', signed: -93, services: ['independence', 'technology'] },
        plan: { name: 'Support at Home budget', fundingType: 'sah', start: -180, end: 185, budget: 1800, managedBy: ORG.seaview, reference: 'SAH 51883' },
        goals: [
          { description: 'Make my own breakfast and lunch safely', area: 'domestic', status: 'active', created: -90, review: 15, baseline: 5, target: 8,
            progress: [[-60, 6, 'Kettle with auto off and a microwave routine in place.'], [-14, 7, 'Making breakfast daily with a picture prompt on the fridge.']] },
          { description: 'Stop the stove being left on', area: 'safety', status: 'achieved', created: -90, review: -20, baseline: 2, target: 9,
            progress: [[-40, 9, 'Stove isolation switch and timer installed. No incidents since.']] }
        ],
        assessments: [
          { type: 'home', date: -88, status: 'completed', methods: ['interview', 'observation', 'westmead'], findings: 'Uses the stove for toast and boiling eggs. Has left a hotplate on twice this month. Kitchen otherwise well set up.', functionalNeeds: 'Safer ways to prepare simple meals. Prompts for routines.', recommendations: 'Stove isolation switch with timer. Auto off kettle. Picture based routine cards.' }
        ],
        reports: [
          { type: 'at', status: 'delivered', due: -45, delivered: -47, recipient: ORG.seaview, method: 'email', title: 'Assistive technology recommendation: stove safety', summary: 'Recommendation for a stove isolation switch with timer and an auto off kettle.' }
        ],
        documents: [
          { name: 'Enduring power of attorney, copy.pdf', type: 'other', date: -95, size: 301056 }
        ],
        appointments: [
          [-88, '10:30', 'homevisit', 90, 'home', 20, { goals: [0, 1], reason: 'Kitchen safety assessment.', interventions: 'Observed Grace making toast and tea. Interview with Michael.', observations: 'Forgot the hotplate after taking the toast off. Followed a written list well.', progress: 'Goals set with Grace and Michael.', plan: 'Recommend stove isolation switch and kettle. Make routine cards.' }],
          [-40, '10:30', 'therapy', 60, 'home', 20, { goals: [0, 1], reason: 'Check stove switch and routine cards.', interventions: 'Practised the breakfast routine with the picture cards. Tested the stove timer.', observations: 'Grace used the cards without prompting. Timer worked as expected.', progress: 'Stove goal achieved.', plan: 'Review breakfast and lunch routine in a month.' }],
          [-14, '10:30', 'therapy', 60, 'home', 20, { goals: [0], reason: 'Lunch routine.', interventions: 'Added a lunch card for a sandwich and soup in the microwave.', observations: 'Needed one prompt to stir the soup halfway.', progress: 'Breakfast daily, lunch most days.', plan: 'Update the card with a stir step. Review in a fortnight.' }],
          [0, '13:30', 'review', 30, 'home', 20, null],
          [16, '10:30', 'review', 30, 'home', 20, null]
        ],
        tasks: []
      },

      {
        id: 'cl_lachlan', firstName: 'Lachlan', lastName: 'Reid', dob: dob(22, '09-05'),
        phone: '0491 574 632', email: 'lachlan.reid@example.com', address: '5 Tincogan Street', suburb: 'Mullumbimby', state: 'NSW', postcode: '2482',
        status: 'active', therapistId: 'st_priya', fundingType: 'ndis_self', ndisNumber: '430000014', startDate: day(-110), referralSource: 'Mum, Fiona Reid',
        alerts: 'Prefers a text message before arriving. Quiet voice and no surprises.',
        background: 'Autistic young man starting TAFE. Wants to travel there on his own, manage his money and shop for himself.',
        livingSituation: 'Lives with his mum Fiona. Plans to move into shared housing next year.',
        health: 'Autism and anxiety. No physical health concerns.',
        communication: 'Prefers messages to phone calls. Visual schedules help.',
        contacts: [
          { name: 'Fiona Reid', kind: 'family', relationship: 'Mother', phone: '0491 575 254', email: 'fiona.reid@example.com', isPrimary: true, canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-110), givenBy: 'Lachlan Reid', method: 'written' },
          { type: 'telehealth', date: day(-110), givenBy: 'Lachlan Reid', method: 'written' }
        ],
        agreement: { template: 'ndis', start: -110, end: 255, status: 'signed', signed: -108, services: ['independence', 'therapy'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_self', start: -140, end: 225, budget: 5400, managedBy: 'Self managed', reference: 'Self managed plan' },
        goals: [
          { description: 'Catch the bus to TAFE on my own', area: 'community', status: 'active', created: -105, review: 21, baseline: 2, target: 8,
            progress: [[-70, 4, 'Practised the route with a visual map.'], [-28, 6, 'Travelling with Mia following on a different seat.']] },
          { description: 'Do my own weekly food shop on a budget', area: 'domestic', status: 'planned', created: -30, review: 60, baseline: 2, target: 7, progress: [] }
        ],
        assessments: [
          { type: 'initial', date: -105, status: 'completed', methods: ['interview', 'copm', 'observation'], findings: 'Strong skills with routines once learned. High anxiety with unexpected changes on public transport.', functionalNeeds: 'Graded travel training with a plan for disruptions.', recommendations: 'Weekly travel training, then budgeting and shopping skills.' }
        ],
        reports: [],
        documents: [
          { name: 'Visual bus route map.pdf', type: 'correspondence', date: -70, size: 412672 }
        ],
        appointments: [
          [-28, '14:00', 'therapy', 60, 'community', 10, { goals: [0], reason: 'Travel training with allied health assistant.', interventions: 'Mia travelled on the same bus, sitting separately. Practised what to do if the bus is full.', observations: 'Lachlan used his card and found a seat. Checked his map twice.', progress: 'Travelled with distant support.', plan: 'Next step is travelling alone with a text check in.' }, { staff: 'st_mia' }],
          [-21, '14:00', 'therapy', 60, 'community', 10, null, { cancel: { reason: 'Did not attend. Fiona said he was overwhelmed after a bad day at TAFE.', late: true } }],
          [-14, '14:00', 'therapy', 60, 'telehealth', 0, { goals: [0], reason: 'Planning for disruptions.', interventions: 'Made a "what if" card for a late or cancelled bus.', observations: 'Lachlan came up with two of the plans himself.', progress: 'More confident about changes.', plan: 'Solo trip next week with a text check in.' }],
          [-4, '14:00', 'therapy', 60, 'community', 10, null],
          [10, '14:00', 'therapy', 60, 'community', 10, null]
        ],
        tasks: []
      },

      {
        id: 'cl_helen', firstName: 'Helen', lastName: 'Papadopoulos', dob: dob(69, '07-23'),
        phone: '0491 575 789', email: 'helen.papadopoulos@example.com', address: '33 Robina Parkway', suburb: 'Robina', state: 'QLD', postcode: '4226',
        status: 'active', therapistId: 'st_hannah', fundingType: 'private', startDate: day(-42), referralSource: 'Hospital discharge planner',
        alerts: '',
        background: 'Total hip replacement eight weeks ago. Referred for help getting back to housework and her aqua aerobics class within hip precautions.',
        livingSituation: 'Lives alone in a two bedroom unit with a lift.',
        health: 'Left total hip replacement. Type 2 diabetes.',
        communication: '',
        contacts: [
          { name: 'Nick Papadopoulos', kind: 'family', relationship: 'Son', phone: '0491 576 398', email: 'nick.papadopoulos@example.com', isPrimary: true, canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-42), givenBy: 'Helen Papadopoulos', method: 'written' }
        ],
        agreement: { template: 'private', start: -42, end: 323, status: 'signed', signed: -42, services: ['independence', 'technology'] },
        plan: null,
        goals: [
          { description: 'Do my own washing and change the bed sheets again', area: 'domestic', status: 'achieved', created: -40, review: -5, baseline: 3, target: 8,
            progress: [[-26, 6, 'Using a long handled reacher and a raised laundry basket.'], [-5, 8, 'Managing all washing. Changing sheets with her son\'s help once a fortnight.']] },
          { description: 'Get in and out of the car to go to aqua aerobics', area: 'community', status: 'active', created: -40, review: 9, baseline: 3, target: 8,
            progress: [[-19, 6, 'Using a swivel cushion. Practised the car transfer.']] }
        ],
        assessments: [
          { type: 'initial', date: -40, status: 'completed', methods: ['interview', 'observation'], findings: 'Following hip precautions. Struggling to reach low items and get into her car.', functionalNeeds: 'Equipment and strategies for housework and car transfers.', recommendations: 'Reacher, sock aid, swivel cushion, raised laundry basket.' }
        ],
        reports: [
          { type: 'discharge', status: 'draft', due: 10, recipient: 'Helen and her GP', title: 'Discharge summary', summary: 'Summary of therapy following hip replacement and recommendations going forward.' }
        ],
        documents: [
          { name: 'Hospital discharge summary.pdf', type: 'referral', date: -44, size: 266240 }
        ],
        appointments: [
          [-40, '13:00', 'initial', 120, 'home', 15, { template: 'initial', goals: [0, 1], reason: 'Hospital referral after hip replacement.', interventions: 'Interview. Observed laundry and car transfer. Supplied reacher and sock aid.', observations: 'Breaking hip precautions when reaching into the washing machine.', progress: 'Goals set for housework and getting to aqua.', plan: 'Raised basket and swivel cushion. Practise car transfer.' }],
          [-26, '13:00', 'therapy', 60, 'home', 15, { goals: [0], reason: 'Housework strategies.', interventions: 'Practised laundry and bed making with equipment.', observations: 'Good technique with the reacher.', progress: 'Doing all her own washing.', plan: 'Car transfers next visit.' }],
          [-19, '13:00', 'therapy', 60, 'community', 15, { goals: [1], reason: 'Car transfer practice.', interventions: 'Practised getting into and out of her car using a swivel cushion.', observations: 'Safe and within precautions.', progress: 'Drove to the shops with her son as passenger.', plan: 'Check in after her first aqua class.' }],
          [-5, '13:00', 'review', 30, 'home', 15, { goals: [0, 1], reason: 'Review before discharge.', interventions: 'Reviewed goals. Discussed discharge.', observations: 'Back at aqua aerobics once a week.', progress: 'Housework goal achieved.', plan: 'Write discharge summary. One final check in.' }],
          [9, '13:00', 'review', 30, 'telehealth', 0, null]
        ],
        tasks: []
      },

      {
        id: 'cl_wayne', firstName: 'Wayne', lastName: 'Cooper', dob: dob(63, '02-11'),
        phone: '02 5550 4471', email: 'wayne.cooper@example.com', address: '211 Summerland Way', suburb: 'Casino', state: 'NSW', postcode: '2470',
        status: 'active', therapistId: 'st_hannah', fundingType: 'ndis_plan', ndisNumber: '430000015', startDate: day(-430), referralSource: 'Hospital rehabilitation team',
        alerts: 'Rural property, use the second gate. Shared mobile coverage is patchy.',
        background: 'Stroke eighteen months ago with left sided weakness. Working on dressing, kitchen tasks and getting back to fishing.',
        livingSituation: 'Lives with his wife Sharon on a rural block outside Casino.',
        health: 'Right hemisphere stroke with left hemiplegia. Some left sided neglect. Diabetes.',
        communication: 'Sharon often joins sessions.',
        contacts: [
          { name: 'Sharon Cooper', kind: 'family', relationship: 'Wife', phone: '0491 576 801', email: 'sharon.cooper@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Invoices team', kind: 'planmanager', relationship: 'Plan manager', organisation: ORG.clearpath, phone: '07 5550 4410', email: 'accounts@clearpath.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-430), givenBy: 'Wayne Cooper', method: 'written' },
          { type: 'share_planmanager', date: day(-430), givenBy: 'Wayne Cooper', method: 'written' },
          { type: 'collect', date: day(-430), givenBy: 'Wayne Cooper', method: 'written', limitations: 'From the hospital rehabilitation team only.' }
        ],
        agreement: { template: 'ndis', start: -150, end: 215, status: 'signed', signed: -149, services: ['therapy', 'independence', 'reports'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_plan', start: fyStart, end: D.addDays(D.addMonths(fyStart, 12), -1), budget: 11000, managedBy: ORG.clearpath, reference: 'Current plan' },
        previousPlan: { name: 'NDIS plan (previous)', fundingType: 'ndis_plan', start: prevFyStart, end: prevFyEnd, budget: 12000, managedBy: ORG.clearpath, reference: 'Previous plan' },
        goals: [
          { description: 'Get dressed each morning without Sharon\'s help', area: 'selfcare', status: 'active', created: -140, review: 25, baseline: 3, target: 8,
            progress: [[-110, 4, 'One handed dressing techniques for shirts.'], [-60, 6, 'Dressing independently except for socks and shoes.'], [-18, 7, 'Using elastic laces. Sharon helps with socks only.']] },
          { description: 'Go fishing at the river with my mates', area: 'leisure', status: 'active', created: -140, review: 25, baseline: 1, target: 7,
            progress: [[-50, 3, 'Trialled a rod holder and one handed reel.'], [-18, 5, 'Fished from a chair on the bank with a mate.']] },
          { description: 'Make a cup of tea safely', area: 'domestic', status: 'achieved', created: -400, review: -200, baseline: 2, target: 8,
            progress: [[-300, 6, 'Using a kettle tipper.'], [-220, 8, 'Making tea independently.']] }
        ],
        assessments: [
          { type: 'fca', date: -145, status: 'reviewed', methods: ['interview', 'observation', 'barthel', 'copm', 'whodas'], findings: 'Independent with eating and grooming. Needs help with lower body dressing, bathing and outdoor mobility on uneven ground. Left neglect affects scanning in the kitchen.', functionalNeeds: 'Ongoing therapy for dressing and community participation. Support worker help with bathing three times a week.', recommendations: 'Fortnightly occupational therapy. Support worker hours for personal care. Assistive technology for fishing.' }
        ],
        reports: [
          { type: 'fca', status: 'delivered', due: -138, delivered: -140, recipient: 'NDIA, for plan reassessment', method: 'portal', title: 'Functional capacity report', summary: 'Functional capacity assessment following stroke, with recommended supports for the next plan.' }
        ],
        documents: [
          { name: 'NDIS plan, approved supports.pdf', type: 'plan', date: -150, size: 498688 },
          { name: 'Hospital rehabilitation discharge summary.pdf', type: 'referral', date: -432, size: 356352 }
        ],
        appointments: [
          [D.diffDays(today, D.addDays(fyStart, -25)), '10:00', 'therapy', 60, 'home', 30, { goals: [0], reason: 'Dressing practice.', interventions: 'Practised one handed shirt and trouser techniques.', observations: 'Managed buttons with a button hook.', progress: 'Dressing upper body independently.', plan: 'Lower body dressing next.' }],
          [-50, '10:00', 'equipment', 60, 'home', 30, { goals: [1], reason: 'Fishing equipment trial.', interventions: 'Trialled a rod holder and a one handed reel in the backyard.', observations: 'Cast well from sitting. Needed help baiting the hook.', progress: 'Keen to try at the river.', plan: 'Practise baiting with an adapted tool.' }],
          [-32, '10:00', 'therapy', 60, 'home', 30, { goals: [0], reason: 'Lower body dressing.', interventions: 'Introduced elastic laces and a long handled shoe horn.', observations: 'Managed shoes with the new laces. Socks still hard.', progress: 'Getting closer.', plan: 'Trial a sock aid.' }],
          [-18, '10:00', 'therapy', 60, 'community', 30, { goals: [0, 1], reason: 'Fishing trip and dressing review.', interventions: 'Joined Wayne and a mate at the river. Set up chair and rod holder.', observations: 'Caught a bream. Steady on the bank with his stick and a mate nearby.', progress: 'Rated fishing 5 out of 10.', plan: 'Review in a fortnight.' }],
          [-4, '10:00', 'therapy', 60, 'home', 30, { goals: [0], reason: 'Dressing review.', interventions: 'Trialled a sock aid.', observations: 'Managed the sock aid on the second attempt.', progress: 'Nearly independent with dressing.', plan: 'Keep practising. Review next visit.' }],
          [11, '10:00', 'therapy', 60, 'home', 30, null],
          [25, '10:00', 'review', 30, 'home', 30, null]
        ],
        tasks: []
      },

      {
        id: 'cl_mei', firstName: 'Mei Lin', lastName: 'Zhang', dob: dob(77, '05-28'),
        phone: '07 5550 5214', email: '', address: '8 Discovery Drive', suburb: 'Helensvale', state: 'QLD', postcode: '4212',
        status: 'active', therapistId: 'st_priya', fundingType: 'medicare', startDate: day(-34), referralSource: 'Dr James Okafor, GP',
        alerts: 'Mandarin interpreter booked for every visit.',
        background: 'Two near falls in the shower. GP referral under a chronic condition management plan.',
        livingSituation: 'Lives with her husband in a single level house.',
        health: 'Osteoporosis. Type 2 diabetes. Mild peripheral neuropathy in both feet.',
        communication: 'Speaks Mandarin. Use a telephone or onsite interpreter. Daughter Lily helps with scheduling.',
        contacts: [
          { name: 'Lily Zhang', kind: 'family', relationship: 'Daughter', phone: '0491 577 426', email: 'lily.zhang@example.com', isPrimary: true, canDiscuss: true },
          { name: 'Dr James Okafor', kind: 'gp', relationship: 'GP', organisation: ORG.helensvalegp, phone: '07 5550 9013', email: 'reception@helensvalegp.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-34), givenBy: 'Mei Lin Zhang, with interpreter', method: 'written' },
          { type: 'share_gp', date: day(-34), givenBy: 'Mei Lin Zhang, with interpreter', method: 'written' }
        ],
        agreement: { template: 'private', start: -34, end: 331, status: 'signed', signed: -34, services: ['home', 'technology'] },
        plan: { name: 'Medicare GP chronic condition management plan', fundingType: 'medicare', start: year + '-01-01', end: year + '-12-31', sessionsAllowed: 5, managedBy: 'Medicare', reference: 'Referral from Dr James Okafor' },
        goals: [
          { description: 'Shower without being afraid of slipping', area: 'selfcare', status: 'active', created: -30, review: 20, baseline: 2, target: 8,
            progress: [[-15, 5, 'Shower chair and non slip mat in place.']] }
        ],
        assessments: [
          { type: 'falls', date: -30, status: 'completed', methods: ['interview', 'observation', 'fes'], findings: 'Reduced sensation in both feet. Slippery tiles in the shower. No rails.', functionalNeeds: 'Safe seated showering. Rails.', recommendations: 'Shower chair, non slip mat, two grab rails.' }
        ],
        reports: [
          { type: 'gp', status: 'delivered', due: -20, delivered: -22, recipient: 'Dr James Okafor', method: 'email', title: 'Letter to GP: falls risk assessment', summary: 'Results of falls risk assessment and recommendations.' }
        ],
        documents: [
          { name: 'GP chronic condition management plan referral.pdf', type: 'referral', date: -36, size: 118784 }
        ],
        appointments: [
          [-30, '09:00', 'initial', 120, 'home', 20, { template: 'initial', goals: [0], reason: 'GP referral after near falls in the shower.', interventions: 'Interview with interpreter. Falls Efficacy Scale. Observed shower set up.', observations: 'Tiles slippery when wet. Reduced feeling in both feet.', progress: 'Goal set for safe showering.', plan: 'Shower chair and mat. Recommend rails.' }],
          [-15, '09:00', 'equipment', 60, 'home', 20, { goals: [0], reason: 'Shower equipment set up.', interventions: 'Set up shower chair and non slip mat with interpreter present.', observations: 'Transfer safe and steady.', progress: 'Mei Lin feels more confident.', plan: 'Check rails once installed.' }],
          [1, '09:00', 'review', 30, 'home', 20, null]
        ],
        tasks: [
          { title: 'Book Mandarin interpreter for Mei Lin\'s review', due: 0, priority: 'high', assignedTo: 'st_tom' }
        ]
      },

      {
        id: 'cl_sophie', firstName: 'Sophie', lastName: 'Turner', dob: dob(39, '10-12'),
        phone: '0491 577 644', email: 'sophie.turner@example.com', address: '2 Ross Street', suburb: 'Lennox Head', state: 'NSW', postcode: '2478',
        status: 'onhold', therapistId: 'st_priya', fundingType: 'healthfund', startDate: day(-160), referralSource: 'Self referral',
        alerts: '',
        background: 'Ongoing fatigue after a long COVID illness. Paused therapy while travelling to see family.',
        livingSituation: 'Lives with her partner.',
        health: 'Post viral fatigue.',
        communication: '',
        contacts: [],
        consents: [
          { type: 'treatment', date: day(-160), givenBy: 'Sophie Turner', method: 'electronic' },
          { type: 'telehealth', date: day(-160), givenBy: 'Sophie Turner', method: 'electronic' }
        ],
        agreement: { template: 'private', start: -160, end: -20, status: 'signed', signed: -160, services: ['therapy'] },
        plan: null,
        goals: [
          { description: 'Work two days a week without crashing afterwards', area: 'work', status: 'active', created: -150, review: 30, baseline: 2, target: 7,
            progress: [[-90, 4, 'Using an energy envelope and planned rest.'], [-45, 5, 'Working one and a half days.']] }
        ],
        assessments: [],
        reports: [],
        documents: [],
        appointments: [
          [-45, '15:30', 'therapy', 60, 'telehealth', 0, { goals: [0], reason: 'Pacing review before break.', interventions: 'Reviewed energy diary. Planned a pacing approach for travel.', observations: 'Fewer crashes since starting planned rests.', progress: 'Working one and a half days a week.', plan: 'Pause therapy while overseas. Contact on return.' }]
        ],
        tasks: [
          { title: 'Contact Sophie about restarting therapy', due: 14, priority: 'low', assignedTo: 'st_priya' }
        ]
      },

      {
        id: 'cl_frank', firstName: 'Frank', lastName: 'Delaney', dob: dob(85, '08-30'),
        phone: '07 5550 6620', email: '', address: '4 Currumbin Creek Road', suburb: 'Currumbin', state: 'QLD', postcode: '4223',
        status: 'discharged', therapistId: 'st_hannah', fundingType: 'sah', startDate: day(-150), referralSource: 'Seaview Community Care',
        alerts: '',
        background: 'Equipment and bathroom review after a hospital stay. Goals met and discharged.',
        livingSituation: 'Lives with his wife.',
        health: 'Heart failure. Uses a four wheeled walker outdoors.',
        communication: '',
        contacts: [
          { name: 'Joan Delaney', kind: 'family', relationship: 'Wife', phone: '0491 578 957', email: '', isPrimary: true, canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-150), givenBy: 'Frank Delaney', method: 'written' }
        ],
        agreement: { template: 'sah', start: -150, end: -40, status: 'signed', signed: -149, services: ['technology', 'home'] },
        plan: null,
        goals: [
          { description: 'Get on and off the toilet safely', area: 'selfcare', status: 'achieved', created: -148, review: -60, baseline: 3, target: 8,
            progress: [[-100, 6, 'Toilet frame installed.'], [-65, 8, 'Independent and safe.']] }
        ],
        assessments: [],
        reports: [
          { type: 'discharge', status: 'delivered', due: -55, delivered: -56, recipient: 'Frank, Joan and ' + ORG.seaview, method: 'post', title: 'Discharge summary', summary: 'Summary of equipment provided and recommendations after discharge.' }
        ],
        documents: [],
        appointments: [],
        tasks: []
      },

      {
        id: 'cl_tama', firstName: 'Tama', lastName: 'Ngata', dob: dob(51, '03-03'),
        phone: '0491 578 148', email: 'tama.ngata@example.com', address: '17 Nerang Broadbeach Road', suburb: 'Nerang', state: 'QLD', postcode: '4211',
        status: 'active', therapistId: 'st_priya', fundingType: 'ndis_plan', ndisNumber: '430000016', startDate: day(-12), referralSource: 'Sam Nguyen, support coordinator',
        alerts: 'Ramp at the side door. Ring the bell twice.',
        background: 'Incomplete spinal cord injury at T12 from a work accident a year ago. Wants to manage car transfers and use his kitchen from his wheelchair.',
        livingSituation: 'Lives with his wife and adult daughter in a low set house.',
        health: 'Incomplete T12 spinal cord injury. Uses a manual wheelchair. Neuropathic pain.',
        communication: '',
        contacts: [
          { name: 'Sam Nguyen', kind: 'coordinator', relationship: 'Support coordinator', organisation: ORG.northernlight, phone: '07 5550 2231', email: 'sam.nguyen@example.org', canDiscuss: true },
          { name: 'Moana Ngata', kind: 'family', relationship: 'Wife', phone: '0491 578 888', email: 'moana.ngata@example.com', isPrimary: true, canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-12), givenBy: 'Tama Ngata', method: 'written' },
          { type: 'share_coordinator', date: day(-12), givenBy: 'Tama Ngata', method: 'written' }
        ],
        agreement: { template: 'ndis', start: -12, end: 325, status: 'awaiting', sent: -9, services: ['assessments', 'technology', 'home', 'reports'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_plan', start: -40, end: 325, budget: 12500, managedBy: ORG.clearpath, reference: 'New plan' },
        goals: [
          { description: 'Get in and out of my car on my own', area: 'mobility', status: 'planned', created: -6, review: 60, baseline: 2, target: 8, progress: [] },
          { description: 'Cook from my wheelchair in our kitchen', area: 'domestic', status: 'planned', created: -6, review: 60, baseline: 3, target: 8, progress: [] }
        ],
        assessments: [
          { type: 'initial', date: -6, status: 'completed', methods: ['interview', 'copm', 'observation'], findings: 'Independent with wheelchair skills on flat ground. Car transfer needs help with the wheelchair loading. Benches too high to work at from his chair.', functionalNeeds: 'Car transfer technique and equipment. Kitchen access.', recommendations: 'Functional capacity assessment and home modification assessment of the kitchen.' },
          { type: 'fca', date: 9, status: 'planned', methods: [], findings: '', functionalNeeds: '', recommendations: '' }
        ],
        reports: [
          { type: 'fca', status: 'draft', due: 30, recipient: 'NDIA', title: 'Functional capacity report', summary: 'Functional capacity assessment to support home modification and assistive technology requests.' }
        ],
        documents: [
          { name: 'Referral from Northern Light Support Coordination.pdf', type: 'referral', date: -14, size: 151552 }
        ],
        appointments: [
          [-6, '11:00', 'initial', 120, 'home', 15, { template: 'initial', goals: [0, 1], reason: 'Support coordinator referral after spinal cord injury.', interventions: 'Interview with Tama and Moana. COPM. Observed car transfer and kitchen use.', observations: 'Transfer to the driver seat is good. Struggles to lift the wheelchair frame into the car.', progress: 'Goals set for car transfers and cooking.', plan: 'Functional capacity assessment next. Look at a wheelchair loader.' }],
          [9, '11:00', 'assessment', 120, 'home', 15, null]
        ],
        tasks: []
      },

      {
        id: 'cl_ruby', firstName: 'Ruby', lastName: 'Anderson', dob: dob(31, '06-27'),
        phone: '0491 579 212', email: 'ruby.anderson@example.com', address: '6 Marine Parade', suburb: 'Kingscliff', state: 'NSW', postcode: '2487',
        status: 'waitlist', therapistId: 'st_hannah', fundingType: 'private', startDate: day(-8), referralSource: 'Self referral',
        alerts: '',
        background: 'Hypermobility condition causing joint pain and fatigue. Wants help with joint protection at work and home.',
        livingSituation: 'Lives alone. Works as a graphic designer.',
        health: 'Hypermobile Ehlers Danlos syndrome.',
        communication: 'Prefers email.',
        contacts: [],
        consents: [],
        agreement: null,
        plan: null,
        goals: [],
        assessments: [],
        reports: [],
        documents: [],
        appointments: [],
        tasks: []
      },

      {
        id: 'cl_peter', firstName: 'Peter', lastName: 'Walsh', dob: dob(79, '11-08'),
        phone: '02 5550 2268', email: 'peter.walsh@example.com', address: '41 Main Street', suburb: 'Alstonville', state: 'NSW', postcode: '2477',
        status: 'active', therapistId: 'st_hannah', fundingType: 'medicare', startDate: day(-4), referralSource: 'Dr Lena Fischer, GP',
        alerts: 'Uses oxygen at home. No smoking or open flames near the concentrator.',
        background: 'COPD with breathlessness during showering and dressing. GP referral for energy conservation and home safety.',
        livingSituation: 'Lives alone. Son visits on weekends.',
        health: 'Chronic obstructive pulmonary disease. Home oxygen overnight.',
        communication: '',
        contacts: [
          { name: 'Dr Lena Fischer', kind: 'gp', relationship: 'GP', organisation: ORG.ballinagp, phone: '02 5550 7720', email: 'reception@ballinagp.example.org', canDiscuss: true }
        ],
        consents: [],
        agreement: { template: 'private', start: 2, end: 367, status: 'draft', services: ['independence', 'home'] },
        plan: { name: 'Medicare GP chronic condition management plan', fundingType: 'medicare', start: year + '-01-01', end: year + '-12-31', sessionsAllowed: 5, managedBy: 'Medicare', reference: 'Referral from Dr Lena Fischer' },
        goals: [],
        assessments: [
          { type: 'initial', date: 2, status: 'planned', methods: [], findings: '', functionalNeeds: '', recommendations: '' }
        ],
        reports: [],
        documents: [
          { name: 'GP chronic condition management plan referral.pdf', type: 'referral', date: -5, size: 114688 }
        ],
        appointments: [
          [2, '13:30', 'initial', 120, 'home', 20, null]
        ],
        tasks: [
          { title: 'Record consent and send a service agreement to Peter Walsh', due: 1, priority: 'high', assignedTo: 'st_tom', automated: true, reason: 'A new client was added', kind: 'setup' }
        ]
      },

      {
        id: 'cl_jasmine', firstName: 'Jasmine', lastName: 'Brooks', dob: dob(46, '02-19'),
        phone: '0491 579 760', email: 'jasmine.brooks@example.com', address: '9/22 Varsity Parade', suburb: 'Varsity Lakes', state: 'QLD', postcode: '4227',
        status: 'active', therapistId: 'st_priya', fundingType: 'ndis_plan', ndisNumber: '430000017', startDate: day(-85), referralSource: 'Community mental health team',
        alerts: 'Call before arriving. Prefers to meet at the local cafe on harder days.',
        background: 'Bipolar disorder. Wants to build a routine for household tasks and get out into the community more.',
        livingSituation: 'Lives alone in a unit.',
        health: 'Bipolar affective disorder, currently stable. Sees a psychiatrist monthly.',
        communication: 'Plain language. Check in about how she is feeling at the start of each session.',
        contacts: [
          { name: 'Accounts team', kind: 'planmanager', relationship: 'Plan manager', organisation: ORG.tweedplans, phone: '02 5550 6605', email: 'invoices@tweedplans.example.org', canDiscuss: true }
        ],
        consents: [
          { type: 'treatment', date: day(-85), givenBy: 'Jasmine Brooks', method: 'written' },
          { type: 'share_planmanager', date: day(-85), givenBy: 'Jasmine Brooks', method: 'written', limitations: 'Invoices only.' },
          { type: 'share_coordinator', date: day(-85), givenBy: 'Jasmine Brooks', method: 'written', status: 'withdrawn', withdrawn: -30, withdrawnNote: 'Jasmine asked us to stop sharing updates with her previous support coordinator after changing providers.' }
        ],
        agreement: { template: 'ndis', start: -85, end: 280, status: 'signed', signed: -84, services: ['independence', 'therapy'] },
        plan: { name: 'NDIS plan', fundingType: 'ndis_plan', start: -100, end: 265, budget: 4800, managedBy: ORG.tweedplans, reference: 'Current plan' },
        goals: [
          { description: 'Keep my unit tidy with a weekly routine', area: 'domestic', status: 'active', created: -80, review: -2, baseline: 3, target: 7,
            progress: [[-50, 4, 'Weekly planner on the fridge.'], [-22, 5, 'Following the planner most weeks.']] },
          { description: 'Join the Thursday walking group at the lake', area: 'social', status: 'active', created: -80, review: 18, baseline: 1, target: 7,
            progress: [[-22, 3, 'Walked the route with Priya.']] }
        ],
        assessments: [
          { type: 'initial', date: -82, status: 'completed', methods: ['interview', 'copm', 'lawton'], findings: 'Managing personal care. Household tasks pile up during low periods. Lawton IADL shows help needed with housework and shopping.', functionalNeeds: 'Routines and prompts for household tasks. Graded community participation.', recommendations: 'Fortnightly therapy for three months.' }
        ],
        reports: [],
        documents: [
          { name: 'Weekly planner template.pdf', type: 'correspondence', date: -50, size: 65536 }
        ],
        appointments: [
          [-50, '10:00', 'therapy', 60, 'home', 15, { goals: [0], reason: 'Household routine.', interventions: 'Built a weekly planner together. Broke cleaning into ten minute jobs.', observations: 'Engaged and chose her own jobs for each day.', progress: 'Planner in use.', plan: 'Review in two weeks.' }],
          [-36, '10:00', 'therapy', 60, 'community', 15, { goals: [1], reason: 'Community participation.', interventions: 'Met at the cafe. Talked through the walking group and what feels hard about it.', observations: 'Anxious about meeting new people. Happy to walk the route first.', progress: 'Plan agreed.', plan: 'Walk the route together next session.' }],
          [-22, '10:00', 'therapy', 60, 'community', 15, { goals: [0, 1], reason: 'Walk the lake route.', interventions: 'Walked the lake route together on a Thursday morning. Reviewed the planner.', observations: 'Saw the group and said hello to the organiser.', progress: 'Following the planner most weeks.', plan: 'Jasmine to try joining the group next Thursday.' }],
          [-8, '10:00', 'therapy', 60, 'home', 15, null],
          [0, '10:00', 'therapy', 60, 'community', 15, null],
          [13, '10:00', 'therapy', 60, 'community', 15, null]
        ],
        tasks: [
          { title: 'Review Jasmine\'s goals, review date has passed', due: -2, priority: 'normal', assignedTo: 'st_priya' }
        ]
      }
    ];

    /* Busy times per staff member and day, so sample appointments never overlap */
    const busy = {};
    const SLOTS = ['08:30', '09:00', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '15:00', '15:30'];
    function freeStart(staffId, date, start, duration) {
      const key = staffId + date;
      busy[key] = busy[key] || [];
      const fits = (s) => {
        const a = D.minutes(s);
        const b = a + duration;
        return busy[key].every(([x, y]) => b <= x || a >= y);
      };
      const choice = fits(start) ? start : SLOTS.find(fits) || start;
      busy[key].push([D.minutes(choice), D.minutes(choice) + duration]);
      return choice;
    }

    let ref = 1001;
    const audits = [];
    const audit = (at, actorId, action, table, recordId, clientId, summary) => audits.push({ id: 'ev_' + (audits.length + 1), at, actorId, action, table, recordId, clientId, summary, fields: [] });

    clients.forEach((c) => {
      const client = {
        id: c.id, ref: ref++, firstName: c.firstName, lastName: c.lastName, preferredName: c.preferredName || '', dob: c.dob,
        phone: c.phone, email: c.email, address: c.address, suburb: c.suburb, state: c.state, postcode: c.postcode,
        status: c.status, therapistId: c.therapistId, fundingType: c.fundingType, ndisNumber: c.ndisNumber || '',
        startDate: c.startDate, referralSource: c.referralSource, alerts: c.alerts, background: c.background,
        livingSituation: c.livingSituation, health: c.health, communication: c.communication,
        createdAt: stamp(c.startDate, '09:10'), updatedAt: stamp(c.startDate, '09:10'), createdBy: 'st_tom'
      };
      t.clients.push(client);
      const name = (c.preferredName || c.firstName) + ' ' + c.lastName;
      audit(stamp(c.startDate, '09:10'), 'st_tom', 'created', 'clients', c.id, c.id, 'Added client: ' + name);

      c.contacts.forEach((x, i) => t.contacts.push(Object.assign({ id: c.id + '_ct' + i, clientId: c.id, organisation: '', isPrimary: false, canDiscuss: false }, x)));

      c.consents.forEach((x, i) => {
        const consent = {
          id: c.id + '_cs' + i, clientId: c.id, type: x.type, date: x.date, givenBy: x.givenBy, method: x.method,
          limitations: x.limitations || '', status: x.status || 'current', expiryDate: '',
          withdrawnDate: x.withdrawn ? day(x.withdrawn) : '', withdrawnNote: x.withdrawnNote || '', recordedBy: 'st_tom'
        };
        t.consents.push(consent);
        audit(stamp(x.date, '09:20'), 'st_tom', 'created', 'consents', consent.id, c.id, 'Added consent record: ' + AWY.schema.labelOf('consentType', x.type));
        if (x.withdrawn) audit(stamp(day(x.withdrawn), '11:05'), 'st_priya', 'updated', 'consents', consent.id, c.id, 'Changed consent record from Current to Withdrawn: ' + AWY.schema.labelOf('consentType', x.type));
        if (x.method === 'written' || x.method === 'electronic') {
          t.documents.push({ id: c.id + '_dcs' + i, clientId: c.id, name: 'Consent form, ' + AWY.schema.labelOf('consentType', x.type).toLowerCase() + '.pdf', type: 'consent', date: x.date, status: x.status === 'withdrawn' ? 'superseded' : 'current', size: 98304 + i * 2048, source: 'uploaded', uploadedBy: 'st_tom', linkedId: consent.id, notes: '' });
        }
      });

      const settings = t.settings[0];
      const addAgreement = (a, suffix, statusOverride, sent) => {
        const tpl = settings.agreementTemplates[a.template];
        const startDate = day(a.start);
        const kind = a.template === 'ndis' ? 'ndis' : a.template === 'sah' ? 'sah' : 'private';
        const keys = kind === 'ndis' ? ['ndis_ot', 'ndis_travel', 'ndis_report'] : kind === 'sah' ? ['sah_ot'] : ['private_initial', 'private_therapy', 'private_short', 'private_report', 'private_travel'];
        const rates = keys.map((k) => {
          const item = t.supportItems.filter((i) => i.key === k && i.effectiveFrom <= startDate).sort((x, y) => y.effectiveFrom.localeCompare(x.effectiveFrom))[0];
          return item ? { key: k, itemId: item.id, name: item.name, rate: item.rate, unit: item.unit, code: item.code } : null;
        }).filter(Boolean);
        const status = statusOverride || a.status;
        const agreement = {
          id: c.id + '_ag' + suffix, clientId: c.id, template: a.template, services: a.services, rates: rates,
          conditions: tpl.conditions, cancellationTerms: tpl.cancellation, startDate: startDate, endDate: day(a.end),
          status: status, sentDate: sent !== undefined ? day(sent) : status !== 'draft' ? startDate : '',
          signedDate: status === 'signed' ? day(a.signed) : '', signedBy: status === 'signed' ? (c.consents[0] ? c.consents[0].givenBy : name) : '',
          signatureMethod: status === 'signed' ? 'Signed paper copy' : '', createdBy: 'st_tom'
        };
        t.agreements.push(agreement);
        return agreement;
      };
      if (c.agreement) {
        const a = addAgreement(c.agreement, '', null, c.agreement.sent);
        if (a.status === 'signed') {
          t.documents.push({ id: c.id + '_dag', clientId: c.id, name: 'Service agreement, signed.pdf', type: 'agreement', date: a.signedDate, status: 'current', size: 176128, source: 'uploaded', uploadedBy: 'st_tom', linkedId: a.id, notes: '' });
          audit(stamp(a.signedDate, '14:30'), 'st_tom', 'updated', 'agreements', a.id, c.id, 'Changed service agreement from Awaiting signature to Signed');
        }
        if (a.status === 'awaiting') audit(stamp(a.sentDate, '10:15'), 'st_tom', 'updated', 'agreements', a.id, c.id, 'Changed service agreement from Draft to Awaiting signature');
        if (c.agreement.renewal) {
          const r = Object.assign({}, c.agreement, { start: c.agreement.end + 1, end: c.agreement.end + 366 });
          addAgreement(r, 'r', c.agreement.renewal.status, c.agreement.renewal.sent);
          audit(stamp(day(c.agreement.renewal.sent), '10:15'), 'st_tom', 'updated', 'agreements', c.id + '_agr', c.id, 'Changed service agreement from Draft to Awaiting signature');
        }
      }

      const addPlan = (p, suffix) => {
        if (!p) return null;
        const plan = {
          id: c.id + '_fp' + suffix, clientId: c.id, name: p.name, fundingType: p.fundingType,
          startDate: /^\d{4}/.test(String(p.start)) ? p.start : day(p.start),
          endDate: /^\d{4}/.test(String(p.end)) ? p.end : day(p.end),
          budget: p.budget || '', sessionsAllowed: p.sessionsAllowed || '', managedBy: p.managedBy || '', reference: p.reference || '', notes: ''
        };
        t.fundingPlans.push(plan);
        return plan;
      };
      addPlan(c.plan, '');
      addPlan(c.previousPlan, 'old');

      const goalIds = [];
      c.goals.forEach((g, i) => {
        const id = c.id + '_gl' + i;
        goalIds.push(id);
        t.goals.push({ id, clientId: c.id, description: g.description, area: g.area, status: g.status, createdDate: day(g.created), reviewDate: day(g.review), baseline: g.baseline, target: g.target, createdBy: c.therapistId });
        g.progress.forEach((p, j) => {
          t.progress.push({ id: id + '_pg' + j, goalId: id, clientId: c.id, date: workday(p[0]), rating: p[1], comment: p[2], authorId: c.therapistId });
        });
      });

      c.assessments.forEach((a, i) => {
        const id = c.id + '_as' + i;
        t.assessments.push({
          id, clientId: c.id, type: a.type, date: workday(a.date), status: a.status, assessorId: c.therapistId,
          methods: a.methods, findings: a.findings, functionalNeeds: a.functionalNeeds, recommendations: a.recommendations,
          reviewedBy: a.status === 'reviewed' ? 'st_hannah' : '', reviewedAt: a.status === 'reviewed' ? stamp(workday(a.date + 7), '16:00') : ''
        });
      });

      c.reports.forEach((r, i) => {
        const id = c.id + '_rp' + i;
        const report = {
          id, ref: 0, clientId: c.id, type: r.type, title: r.title, authorId: c.therapistId, dueDate: day(r.due), status: r.status,
          recipient: r.recipient, summary: r.summary, sections: reportSections(c, r),
          deliveredDate: r.delivered ? day(r.delivered) : '', deliveredTo: r.delivered ? r.recipient : '', deliveryMethod: r.method || '',
          reviewedBy: r.status === 'completed' || r.status === 'delivered' ? 'st_hannah' : '', assessmentId: c.assessments.length ? c.id + '_as0' : null
        };
        t.reports.push(report);
        if (r.delivered) {
          t.documents.push({ id: c.id + '_drp' + i, clientId: c.id, name: r.title + '.pdf', type: 'report', date: day(r.delivered), status: 'current', size: 288768, source: 'generated', uploadedBy: c.therapistId, linkedId: id, notes: '' });
          audit(stamp(day(r.delivered), '15:40'), c.therapistId, 'updated', 'reports', id, c.id, 'Changed report from Completed to Delivered: ' + r.title);
        }
      });

      c.documents.forEach((d, i) => {
        t.documents.push({ id: c.id + '_dc' + i, clientId: c.id, name: d.name, type: d.type, date: day(d.date), status: 'current', size: d.size, source: 'uploaded', uploadedBy: 'st_tom', linkedId: null, notes: '' });
      });

      c.appointments.forEach((row, i) => {
        const [offset, start, type, duration, location, travel, note, extra] = row;
        const x = extra || {};
        const staffId = x.staff || c.therapistId;
        const date = workday(offset);
        const startTime = freeStart(staffId, date, start, duration + (travel || 0));
        let status = date < today ? 'completed' : 'scheduled';
        if (date === today && D.minutes(startTime) + duration < new Date().getHours() * 60 + new Date().getMinutes() && note) status = 'completed';
        if (x.cancel) status = 'cancelled';
        const id = c.id + '_ap' + i;
        const appt = {
          id, clientId: c.id, staffId, type, date, start: startTime, duration, location,
          address: location === 'home' ? c.address + ', ' + c.suburb : location === 'community' ? 'Meet in ' + c.suburb : location === 'telehealth' ? 'Video call link sent by text' : 'Clinic',
          travelMins: travel || 0, status, followUp: false, followUpNote: '', notes: '',
          cancelReason: x.cancel ? x.cancel.reason : '', lateCancellation: x.cancel ? x.cancel.late : false,
          goalIds: note && note.goals ? note.goals.map((g) => goalIds[g]).filter(Boolean) : [],
          createdAt: stamp(day(Math.min(offset, 0) - 7), '12:00'), createdBy: 'st_tom'
        };
        if (c.id === 'cl_jack' && offset === 6) {
          appt.status = 'rescheduled';
          appt.rescheduledFrom = { date: workday(5), start: '09:00' };
          appt.notes = 'Moved at Jack\'s request because of a work shift.';
        }
        t.appointments.push(appt);

        if (status === 'completed' && note) {
          const final = note.status !== 'draft';
          const n = {
            id: id + '_nt', clientId: c.id, appointmentId: id, authorId: staffId, template: note.template || 'session', date, type,
            reason: note.reason, goalIds: appt.goalIds, interventions: note.interventions, observations: note.observations,
            progress: note.progress, plan: note.plan, followUp: note.followUp || '', status: final ? 'final' : 'draft',
            finalisedAt: final ? stamp(date, '17:10') : '', finalisedBy: final ? staffId : '', amendments: [],
            createdAt: stamp(date, '16:30'), updatedAt: stamp(date, final ? '17:10' : '16:45'), createdBy: staffId
          };
          t.notes.push(n);
          if (final) audit(stamp(date, '17:10'), staffId, 'finalised', 'notes', n.id, c.id, 'Finalised ' + AWY.schema.labelOf('noteTemplate', n.template).toLowerCase() + ' for ' + AWY.fmt.date(date));
        }
        if (status === 'completed' && !note) {
          t.tasks.push({
            id: id + '_tk', title: 'Write session note for ' + name + ', ' + AWY.fmt.date(date), description: 'The appointment was marked completed without a finalised note.',
            clientId: c.id, dueDate: D.addBusinessDays(date, 1), priority: 'normal', status: 'open', assignedTo: staffId, createdBy: 'system',
            automated: true, reason: 'A session was completed without a note', relatedType: 'appointments', relatedId: id, kind: 'note',
            createdAt: stamp(date, '17:30')
          });
        }
      });

      c.tasks.forEach((tk, i) => {
        t.tasks.push({
          id: c.id + '_tk' + i, title: tk.title, description: tk.description || '', clientId: c.id, dueDate: day(tk.due), priority: tk.priority,
          status: 'open', assignedTo: tk.assignedTo, createdBy: tk.automated ? 'system' : 'st_hannah', automated: !!tk.automated, reason: tk.reason || '',
          relatedType: tk.kind === 'setup' ? 'clients' : '', relatedId: tk.kind === 'setup' ? c.id : '', kind: tk.kind || '', createdAt: stamp(day(Math.min(tk.due, 0) - 5), '10:00')
        });
      });
    });

    function rulesIsNdis(type) {
      return String(type || '').startsWith('ndis');
    }

    /* Report contents for the document preview */
    function reportSections(c, r) {
      const name = (c.preferredName || c.firstName) + ' ' + c.lastName;
      const first = c.preferredName || c.firstName;
      const base = [
        { heading: 'Reason for report', body: r.summary },
        { heading: 'Background', body: c.background + ' ' + c.livingSituation }
      ];
      const byType = {
        homemod: [
          { heading: 'Assessment', body: (c.assessments.find((a) => a.type === 'home') || {}).findings || 'Home visit completed with measurements of the relevant areas.' },
          { heading: 'Functional impact', body: (c.assessments.find((a) => a.type === 'home') || {}).functionalNeeds || '' },
          { heading: 'Recommendations', body: (c.assessments.find((a) => a.type === 'home') || {}).recommendations || '' },
          { heading: 'Why these recommendations are needed', body: 'Without these changes, ' + first + ' is at ongoing risk of falls during everyday personal care and is likely to need more support from family or paid carers. The recommended changes are the simplest options that meet ' + first + '\'s needs.' }
        ],
        fca: [
          { heading: 'Assessment methods', body: 'Interview, observation of everyday tasks in the home and community, and standardised measures including the COPM and WHODAS 2.0.' },
          { heading: 'Findings', body: (c.assessments.find((a) => a.type === 'fca' || a.type === 'initial') || {}).findings || '' },
          { heading: 'Support needs', body: (c.assessments.find((a) => a.type === 'fca' || a.type === 'initial') || {}).functionalNeeds || '' },
          { heading: 'Recommendations', body: (c.assessments.find((a) => a.type === 'fca' || a.type === 'initial') || {}).recommendations || '' }
        ],
        progress: [
          { heading: 'Goals and progress', body: c.goals.map((g) => '"' + g.description + '": ' + (g.progress.length ? g.progress[g.progress.length - 1][2] : 'Not yet started.')).join(' ') },
          { heading: 'Therapy provided', body: 'Weekly occupational therapy sessions at home and in the community, with allied health assistant support for travel training.' },
          { heading: 'Recommendations for the next plan', body: 'Continued occupational therapy at a reduced frequency to consolidate cooking skills and support an increase in work hours. Estimated 30 hours over 12 months, including report writing.' }
        ],
        at: [
          { heading: 'Assessment', body: (c.assessments.find((a) => a.type === 'at' || a.type === 'home') || {}).findings || '' },
          { heading: 'Options trialled', body: 'Options were trialled in ' + first + '\'s home with the supplier present where possible.' },
          { heading: 'Recommendation', body: (c.assessments.find((a) => a.type === 'at' || a.type === 'home') || {}).recommendations || '' }
        ],
        gp: [
          { heading: 'Summary', body: 'Thank you for referring ' + name + '. ' + ((c.assessments[0] || {}).findings || '') },
          { heading: 'Recommendations', body: (c.assessments[0] || {}).recommendations || '' },
          { heading: 'Sessions used', body: 'Medicare sessions used with occupational therapy so far this calendar year are listed in the client record.' }
        ],
        discharge: [
          { heading: 'Services provided', body: 'Assessment, equipment prescription and therapy sessions at home.' },
          { heading: 'Outcomes', body: c.goals.map((g) => '"' + g.description + '": ' + (g.status === 'achieved' ? 'achieved.' : 'progressing.')).join(' ') },
          { heading: 'Recommendations after discharge', body: 'Continue using the equipment provided. Contact us again if needs change.' }
        ]
      };
      return base.concat(byType[r.type] || []);
    }

    /* Report reference numbers */
    t.reports.forEach((r, i) => (r.ref = 301 + i));
    t.agreements.forEach((a, i) => (a.ref = 201 + i));

    /* Delivered services and invoices, built from completed appointments */
    const itemFor = (key, date) => t.supportItems.filter((i) => i.key === key && i.effectiveFrom <= date && (!i.effectiveTo || i.effectiveTo >= date))[0];
    const clientById = (id) => t.clients.find((c) => c.id === id);
    const planFor = (clientId, date) => t.fundingPlans.find((p) => p.clientId === clientId && p.startDate <= date && p.endDate >= date);
    const round2 = (n) => Math.round(n * 100) / 100;

    t.appointments.filter((a) => a.status === 'completed' || (a.status === 'cancelled' && a.lateCancellation)).forEach((a) => {
      const client = clientById(a.clientId);
      const kind = rulesIsNdis(client.fundingType) ? 'ndis' : client.fundingType === 'sah' ? 'sah' : 'private';
      const entries = [];
      if (a.status === 'cancelled') {
        if (kind === 'ndis') entries.push({ key: 'ndis_cancel', minutes: a.duration, description: 'Short notice cancellation' });
      } else {
        const key = kind === 'ndis' ? 'ndis_ot' : kind === 'sah' ? 'sah_ot' : a.type === 'initial' ? 'private_initial' : a.duration <= 30 ? 'private_short' : 'private_therapy';
        entries.push({ key, minutes: a.duration, description: AWY.schema.labelOf('appointmentType', a.type) });
        if (a.travelMins > 0 && kind === 'ndis') entries.push({ key: 'ndis_travel', minutes: Math.min(a.travelMins, 30), travel: true, description: 'Travel for ' + AWY.schema.labelOf('appointmentType', a.type).toLowerCase() });
        if (a.travelMins > 20 && kind === 'private') entries.push({ key: 'private_travel', minutes: a.travelMins - 20, travel: true, description: 'Travel for ' + AWY.schema.labelOf('appointmentType', a.type).toLowerCase() });
      }
      const age = D.diffDays(a.date, today);
      entries.forEach((e, j) => {
        const item = itemFor(e.key, a.date);
        if (!item) return;
        t.supportLogs.push({
          id: a.id + '_sl' + j, clientId: a.clientId, appointmentId: a.id, staffId: a.staffId, date: a.date, itemId: item.id, key: item.key,
          code: item.code, description: e.description, minutes: e.minutes, quantity: item.unit === 'hour' ? round2(e.minutes / 60) : 1,
          unit: item.unit, rate: item.rate, travel: !!e.travel, fundingPlanId: (planFor(a.clientId, a.date) || {}).id || null,
          status: age > 12 ? 'invoiced' : age > 5 ? 'verified' : 'recorded', automated: true,
          verifiedBy: age > 5 ? 'st_tom' : '', verifiedAt: age > 5 ? stamp(D.addDays(a.date, 2), '10:00') : '', invoiceId: null
        });
      });
    });

    /* Group invoiced services into monthly invoices per client */
    const groups = {};
    t.supportLogs.filter((l) => l.status === 'invoiced').forEach((l) => {
      const k = l.clientId + '|' + l.date.slice(0, 7);
      (groups[k] = groups[k] || []).push(l);
    });
    let invoiceNumber = 1001;
    /* For these clients the most recent invoice past its due date is left unpaid, so it shows as overdue */
    const overdueClients = ['cl_jasmine', 'cl_robert'];
    const naturalDue = (k) => D.addDays(groups[k].map((l) => l.date).sort().pop(), 16);
    const leaveUnpaid = overdueClients.map((cid) => Object.keys(groups).filter((k) => k.startsWith(cid + '|') && naturalDue(k) < today).sort().pop()).filter(Boolean);
    Object.keys(groups).sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1])).forEach((k) => {
      const logs = groups[k];
      const client = clientById(logs[0].clientId);
      const last = logs.map((l) => l.date).sort().pop();
      const issueDate = D.addDays(last, 2);
      const dueDate = D.addDays(issueDate, 14);
      const plan = planFor(client.id, last);
      const kind = client.fundingType;
      const billTo = kind === 'ndis_plan' ? 'planmanager' : kind === 'sah' ? 'provider' : 'client';
      const billToName = billTo === 'client' ? client.firstName + ' ' + client.lastName : (plan && plan.managedBy) || '';
      const status = dueDate >= today || leaveUnpaid.includes(k) ? 'issued' : 'paid';
      const id = 'in_' + invoiceNumber;
      t.invoices.push({
        id, number: invoiceNumber++, clientId: client.id, status, issueDate, dueDate,
        billTo, billToName, paidDate: status === 'paid' ? D.addDays(issueDate, 9) : '', paymentMethod: status === 'paid' ? (billTo === 'planmanager' ? 'planmanager' : billTo === 'provider' ? 'provider' : 'transfer') : '',
        notes: '', fromServices: true, createdBy: 'st_tom', createdAt: stamp(issueDate, '09:00')
      });
      logs.forEach((l, i) => {
        l.invoiceId = id;
        t.invoiceLines.push({ id: id + '_il' + i, invoiceId: id, supportLogId: l.id, date: l.date, itemId: l.itemId, code: l.code, description: l.description, quantity: l.quantity, unit: l.unit, rate: l.rate });
      });
    });

    /* A duplicate invoice that was cancelled, linked to a complaint */
    const jasmineInvoice = t.invoices.filter((i) => i.clientId === 'cl_jasmine')[0];
    if (jasmineInvoice) {
      const id = 'in_' + invoiceNumber;
      t.invoices.push(Object.assign({}, jasmineInvoice, { id, number: invoiceNumber++, status: 'cancelled', paidDate: '', paymentMethod: '', notes: 'Cancelled. Sent in error as a duplicate of Invoice ' + jasmineInvoice.number + '.' }));
      t.invoiceLines.filter((l) => l.invoiceId === jasmineInvoice.id).forEach((l, i) => t.invoiceLines.push(Object.assign({}, l, { id: id + '_il' + i, invoiceId: id, supportLogId: null })));
    }

    /* Two draft invoices made from recently verified services */
    ['cl_nina', 'cl_daniel'].forEach((clientId) => {
      const logs = t.supportLogs.filter((l) => l.clientId === clientId && l.status === 'verified');
      if (!logs.length) return;
      const client = clientById(clientId);
      const plan = planFor(clientId, today);
      const billTo = client.fundingType === 'ndis_plan' ? 'planmanager' : 'client';
      const id = 'in_' + invoiceNumber;
      t.invoices.push({
        id, number: invoiceNumber++, clientId, status: 'draft', issueDate: today, dueDate: D.addDays(today, 14), billTo,
        billToName: billTo === 'client' ? client.firstName + ' ' + client.lastName : (plan && plan.managedBy) || '',
        paidDate: '', paymentMethod: '', notes: 'Draft created from ' + logs.length + ' verified services.', fromServices: true, createdBy: 'st_tom', createdAt: stamp(today, '08:40')
      });
      logs.forEach((l, i) => {
        l.status = 'invoiced';
        l.invoiceId = id;
        t.invoiceLines.push({ id: id + '_il' + i, invoiceId: id, supportLogId: l.id, date: l.date, itemId: l.itemId, code: l.code, description: l.description, quantity: l.quantity, unit: l.unit, rate: l.rate });
      });
    });

    /* Referrals */
    const referral = (id, offset, data) => t.referrals.push(Object.assign({
      id, ref: 0, receivedDate: day(offset), state: 'NSW', fundingType: '', ndisNumber: '', phone: '', email: '',
      referrerName: '', referrerOrg: '', referrerPhone: '', referrerEmail: '', assignedTo: 'st_tom', nextAction: '', nextActionDate: '',
      notes: '', clientId: null, consentToContact: true, kind: 'referral', createdAt: stamp(day(offset), '10:30'), createdBy: 'st_tom'
    }, data));
    referral('rf_beverley', -1, { source: 'website', firstName: 'Beverley', lastName: 'Stone', phone: '0491 579 455', suburb: 'Banora Point', state: 'NSW', fundingType: 'sah', service: 'home', status: 'new', referrerName: 'Claire Stone', referrerOrg: 'Daughter', referrerPhone: '0491 570 006', referrerEmail: 'claire.stone@example.com', reason: 'Mum came home from hospital last week after a fall. I am worried about her bathroom and the steps at the front door.', nextAction: 'Call Claire to talk about a home visit', nextActionDate: day(1), createdBy: 'website' });
    referral('rf_kevin', -2, { source: 'gp', firstName: 'Kevin', lastName: 'Brandt', phone: '07 5550 1937', suburb: 'Mudgeeraba', state: 'QLD', fundingType: 'medicare', service: 'home', status: 'new', referrerName: 'Dr Amir Haddad', referrerOrg: 'Mudgeeraba Medical Centre (demo)', referrerPhone: '07 5550 1180', referrerEmail: 'reception@mudgeerabamc.example.org', reason: 'Falls risk and home safety review under a chronic condition management plan.', nextAction: 'Call Kevin to book an initial assessment', nextActionDate: day(1) });
    referral('rf_olivia', -9, { source: 'coordinator', firstName: 'Olivia', lastName: 'Hartley', phone: '0491 570 110', suburb: 'Byron Bay', state: 'NSW', fundingType: 'ndis_plan', ndisNumber: '430000021', service: 'assessments', status: 'awaiting', referrerName: 'Sam Nguyen', referrerOrg: ORG.northernlight, referrerPhone: '07 5550 2231', referrerEmail: 'sam.nguyen@example.org', reason: 'Functional capacity assessment needed before her plan reassessment in three months.', nextAction: 'Waiting on a copy of the current plan and signed consent', nextActionDate: day(2), assignedTo: 'st_tom' });
    referral('rf_arthur', -5, { source: 'hospital', firstName: 'Arthur', lastName: 'Benson', phone: '07 5550 7351', suburb: 'Coolangatta', state: 'QLD', fundingType: 'sah', service: 'technology', status: 'review', referrerName: 'Rosa Medina', referrerOrg: 'Hospital discharge planning team (demo)', referrerPhone: '07 5550 6012', referrerEmail: 'discharge.planning@example.org', reason: 'Needs a mobility and equipment review before going home from rehabilitation.', nextAction: 'Hannah to confirm capacity for a home visit next week', nextActionDate: day(0), assignedTo: 'st_hannah' });
    referral('rf_ruby', -14, { source: 'self', firstName: 'Ruby', lastName: 'Anderson', phone: '0491 579 212', email: 'ruby.anderson@example.com', suburb: 'Kingscliff', state: 'NSW', fundingType: 'private', service: 'therapy', status: 'waitlisted', reason: 'Joint pain and fatigue with a hypermobility condition. Wants help with work set up.', nextAction: 'Offer the first available appointment', nextActionDate: day(10), clientId: 'cl_ruby', createdBy: 'website' });
    referral('rf_desmond', -20, { source: 'coordinator', firstName: 'Desmond', lastName: 'Price', phone: '0491 570 006', suburb: 'Kyogle', state: 'NSW', fundingType: 'ndis_agency', service: 'assessments', status: 'closed', referrerName: 'Priscilla Ward', referrerOrg: 'Valley Support Coordination (demo)', referrerPhone: '02 5550 8807', referrerEmail: 'priscilla.ward@example.org', reason: 'Functional capacity assessment.', nextAction: '', notes: 'Plan is NDIA managed. Explained we are not a registered provider and suggested two registered providers nearby.' });
    referral('rf_tama', -16, { source: 'coordinator', firstName: 'Tama', lastName: 'Ngata', phone: '0491 578 148', suburb: 'Nerang', state: 'QLD', fundingType: 'ndis_plan', ndisNumber: '430000016', service: 'assessments', status: 'accepted', referrerName: 'Sam Nguyen', referrerOrg: ORG.northernlight, referrerPhone: '07 5550 2231', referrerEmail: 'sam.nguyen@example.org', reason: 'Spinal cord injury. Car transfers and kitchen access.', clientId: 'cl_tama', assignedTo: 'st_priya' });
    referral('rf_peter', -6, { source: 'gp', firstName: 'Peter', lastName: 'Walsh', phone: '02 5550 2268', suburb: 'Alstonville', state: 'NSW', fundingType: 'medicare', service: 'independence', status: 'accepted', referrerName: 'Dr Lena Fischer', referrerOrg: ORG.ballinagp, referrerPhone: '02 5550 7720', referrerEmail: 'reception@ballinagp.example.org', reason: 'COPD with breathlessness during personal care. Energy conservation and home safety.', clientId: 'cl_peter', assignedTo: 'st_hannah' });
    referral('rf_simone', -11, { source: 'family', firstName: 'Simone', lastName: 'Carter', phone: '0491 570 313', suburb: 'Pottsville', state: 'NSW', fundingType: 'private', service: 'independence', status: 'waitlisted', referrerName: 'Greg Carter', referrerOrg: 'Husband', referrerPhone: '0491 571 266', reason: 'Recovering from a long hospital stay and finding everyday tasks exhausting.', nextAction: 'Call when a Thursday spot opens up', nextActionDate: day(12) });
    t.referrals.forEach((r, i) => (r.ref = 501 + i));
    t.referrals.forEach((r) => audit(stamp(r.receivedDate, '10:30'), r.createdBy, 'created', 'referrals', r.id, r.clientId, 'Added referral: ' + r.firstName + ' ' + r.lastName));

    /* Follow up tasks that automations created for the newest referrals */
    ['rf_beverley', 'rf_kevin'].forEach((rid, i) => {
      const r = t.referrals.find((x) => x.id === rid);
      t.tasks.push({
        id: 'tk_ref' + i, title: 'Follow up new referral for ' + r.firstName + ' ' + r.lastName, description: 'Contact ' + (r.referrerName || r.firstName) + ' to talk about the referral, funding and next steps.',
        clientId: null, dueDate: D.addBusinessDays(r.receivedDate, 2), priority: r.source === 'website' ? 'high' : 'normal', status: 'open', assignedTo: 'st_tom',
        createdBy: 'system', automated: true, reason: 'A new referral was received', relatedType: 'referrals', relatedId: r.id, kind: 'referral', createdAt: stamp(r.receivedDate, '10:31')
      });
    });

    /* General practice tasks */
    const practiceTask = (id, title, due, priority, assignedTo, status, description) => t.tasks.push({
      id, title, description: description || '', clientId: null, dueDate: day(due), priority, status, assignedTo, createdBy: 'st_hannah',
      automated: false, reason: '', relatedType: '', relatedId: '', kind: '', completedAt: status === 'done' ? stamp(day(due), '15:00') : '', completedBy: status === 'done' ? assignedTo : '',
      createdAt: stamp(day(due - 10), '09:00')
    });
    practiceTask('tk_p1', 'Renew professional indemnity insurance', 21, 'high', 'st_hannah', 'open', 'Policy renews next month. Check the cover amount suits home visits.');
    practiceTask('tk_p2', 'Restock shower chair and toilet frame loan pool', 4, 'normal', 'st_mia', 'open');
    practiceTask('tk_p3', 'Update fee schedule for the new financial year', -60, 'normal', 'st_tom', 'done');
    practiceTask('tk_p4', 'Check car first aid kit', -1, 'low', 'st_mia', 'open');
    practiceTask('tk_p5', 'Clinical supervision with Priya', 8, 'normal', 'st_hannah', 'open');
    practiceTask('tk_p6', 'Chase overdue invoices from last month', -3, 'high', 'st_tom', 'open', 'Two invoices are past their due date.');
    practiceTask('tk_p7', 'Send monthly invoices to plan managers', -12, 'normal', 'st_tom', 'done');

    /* Incidents and complaints */
    const incident = (id, data) => t.incidents.push(Object.assign({ id, ref: 0, clientId: null, reportedBy: 'st_hannah', assignedTo: 'st_hannah', actionTaken: '', resolution: '', resolvedDate: '', reportable: 'no', createdAt: stamp(day(-1), '09:00') }, data));
    incident('ic_slip', { kind: 'nearmiss', date: workday(-45), title: 'Client nearly slipped on a wet bathroom floor during a session', clientId: 'cl_margaret', description: 'During the shower chair trial, Marg stepped onto a wet tile and lost her balance briefly. Hannah steadied her. No injury.', actionTaken: 'Non slip mat placed immediately. Karen informed. Bathroom floor added to the visit checklist.', status: 'closed', resolution: 'Recommendation for a non slip mat included in the home modification report.', resolvedDate: workday(-44), reportedBy: 'st_hannah' });
    incident('ic_invoice', { kind: 'complaint', date: workday(-30), title: 'Plan manager received a duplicate invoice', clientId: 'cl_jasmine', description: 'Tweed Coast Plan Partners contacted us after receiving the same invoice twice. Jasmine was worried her funding had been charged twice.', actionTaken: 'Duplicate invoice cancelled. Apologised to Jasmine and the plan manager. Confirmed only one payment was made.', status: 'resolved', resolution: 'Invoice checking step added before sending.', resolvedDate: workday(-27), assignedTo: 'st_tom', reportedBy: 'st_tom' });
    incident('ic_car', { kind: 'incident', date: workday(-4), title: 'Minor damage to a client\'s letterbox when reversing', clientId: 'cl_wayne', description: 'Hannah clipped the letterbox post while reversing out of the driveway. Wayne and Sharon were told straight away.', actionTaken: 'Photos taken. Offered to pay for repairs.', status: 'investigating', assignedTo: 'st_hannah', reportedBy: 'st_hannah' });
    incident('ic_dizzy', { kind: 'incident', date: workday(-15), title: 'Client felt dizzy during a community session', clientId: 'cl_jack', description: 'Jack felt dizzy at the bus interchange. Mia helped him sit down and he recovered after ten minutes and some water.', actionTaken: 'Ella informed. Jack agreed to let his GP know. Session ended early.', status: 'open', reportable: 'tbc', assignedTo: 'st_priya', reportedBy: 'st_mia' });
    incident('ic_thanks', { kind: 'feedback', date: workday(-38), title: 'Thank you from Grace\'s son', clientId: 'cl_grace', description: 'Michael called to say the stove timer has given him real peace of mind when he leaves for work.', actionTaken: 'Shared with the team.', status: 'closed', resolvedDate: workday(-38), assignedTo: 'st_priya', reportedBy: 'st_tom' });
    t.incidents.forEach((r, i) => (r.ref = 101 + i));

    /* Remaining audit history: tasks completed and invoices issued or paid */
    t.invoices.forEach((inv) => {
      if (inv.status !== 'draft') audit(stamp(inv.issueDate, '09:05'), 'st_tom', 'updated', 'invoices', inv.id, inv.clientId, 'Changed invoice from Draft to Issued: Invoice ' + inv.number);
      if (inv.status === 'paid') audit(stamp(inv.paidDate, '11:20'), 'st_tom', 'updated', 'invoices', inv.id, inv.clientId, 'Recorded payment for Invoice ' + inv.number);
    });
    t.auditEvents = audits.sort((a, b) => a.at.localeCompare(b.at));

    return t;
  }

  AWY.seed = { build: build };
})();
