/*
  Data definitions for every record type.
  Forms, status badges, validation and the change history all read from here,
  so a field or status only needs to be described once.
  Each table maps to a separate table in the planned Supabase database.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));

  const options = {
    fundingType: opt([
      ['private', 'Private (self funded)'],
      ['healthfund', 'Private health insurance'],
      ['medicare', 'Medicare GP plan'],
      ['sah', 'Support at Home'],
      ['ndis_self', 'NDIS self managed'],
      ['ndis_plan', 'NDIS plan managed'],
      ['ndis_agency', 'NDIS agency managed']
    ]),
    referralSource: opt([
      ['website', 'Website form'],
      ['gp', 'GP'],
      ['coordinator', 'Support coordinator'],
      ['planmanager', 'Plan manager'],
      ['alliedhealth', 'Allied health professional'],
      ['hospital', 'Hospital or health service'],
      ['family', 'Family member or carer'],
      ['self', 'Self referral'],
      ['other', 'Other']
    ]),
    service: opt([
      ['assessments', 'Functional capacity assessment'],
      ['independence', 'Daily living and independence'],
      ['home', 'Home safety and access'],
      ['technology', 'Assistive technology and equipment'],
      ['therapy', 'Goal focused therapy'],
      ['reports', 'Report or recommendations'],
      ['unsure', 'Not sure yet']
    ]),
    appointmentType: opt([
      ['initial', 'Initial assessment'],
      ['therapy', 'Therapy session'],
      ['homevisit', 'Home safety visit'],
      ['assessment', 'Functional assessment'],
      ['equipment', 'Equipment trial'],
      ['review', 'Review']
    ]),
    location: opt([
      ['home', "Client's home"],
      ['community', 'Community'],
      ['clinic', 'Clinic'],
      ['telehealth', 'Telehealth']
    ]),
    noteTemplate: opt([
      ['session', 'Session note'],
      ['initial', 'Initial assessment note'],
      ['progress', 'Progress update'],
      ['discharge', 'Discharge summary']
    ]),
    assessmentType: opt([
      ['initial', 'Initial occupational therapy assessment'],
      ['fca', 'Functional capacity assessment'],
      ['home', 'Home safety assessment'],
      ['at', 'Assistive technology assessment'],
      ['falls', 'Falls risk assessment']
    ]),
    assessmentMethod: opt([
      ['interview', 'Interview'],
      ['observation', 'Task observation'],
      ['copm', 'COPM'],
      ['whodas', 'WHODAS 2.0'],
      ['westmead', 'Westmead Home Safety Assessment'],
      ['lawton', 'Lawton IADL Scale'],
      ['barthel', 'Modified Barthel Index'],
      ['fes', 'Falls Efficacy Scale'],
      ['measure', 'Environmental measurements']
    ]),
    goalArea: opt([
      ['selfcare', 'Self care'],
      ['domestic', 'Domestic tasks'],
      ['mobility', 'Mobility and transfers'],
      ['community', 'Community access'],
      ['safety', 'Home safety'],
      ['work', 'Work and study'],
      ['social', 'Social participation'],
      ['leisure', 'Leisure']
    ]),
    reportType: opt([
      ['fca', 'Functional capacity report'],
      ['progress', 'Progress report'],
      ['at', 'Assistive technology recommendation'],
      ['homemod', 'Home modification report'],
      ['gp', 'Letter to GP'],
      ['discharge', 'Discharge summary']
    ]),
    documentType: opt([
      ['consent', 'Consent form'],
      ['agreement', 'Service agreement'],
      ['report', 'Report'],
      ['assessment', 'Assessment record'],
      ['referral', 'Referral letter'],
      ['plan', 'Funding plan'],
      ['correspondence', 'Correspondence'],
      ['other', 'Other']
    ]),
    consentType: opt([
      ['treatment', 'Assessment and therapy'],
      ['share_gp', 'Share information with GP'],
      ['share_coordinator', 'Share information with support coordinator'],
      ['share_planmanager', 'Share information with plan manager'],
      ['collect', 'Collect information from other providers'],
      ['telehealth', 'Telehealth sessions'],
      ['photos', 'Photos for therapy and reports']
    ]),
    consentMethod: opt([
      ['written', 'Written'],
      ['verbal', 'Verbal'],
      ['electronic', 'Electronic form']
    ]),
    agreementTemplate: opt([
      ['private', 'Private client agreement'],
      ['ndis', 'NDIS service agreement'],
      ['sah', 'Support at Home agreement']
    ]),
    contactKind: opt([
      ['family', 'Family member or carer'],
      ['representative', 'Nominee or guardian'],
      ['coordinator', 'Support coordinator'],
      ['planmanager', 'Plan manager'],
      ['gp', 'GP'],
      ['provider', 'Other provider']
    ]),
    priority: opt([
      ['low', 'Low'],
      ['normal', 'Normal'],
      ['high', 'High']
    ]),
    incidentKind: opt([
      ['incident', 'Incident'],
      ['nearmiss', 'Near miss'],
      ['complaint', 'Complaint'],
      ['feedback', 'Feedback']
    ]),
    reportable: opt([
      ['no', 'No'],
      ['tbc', 'To be confirmed'],
      ['yes', 'Yes']
    ]),
    role: opt([
      ['owner', 'Practice owner'],
      ['therapist', 'Occupational therapist'],
      ['admin', 'Practice administrator'],
      ['support', 'Support staff']
    ]),
    unit: opt([
      ['hour', 'Per hour'],
      ['session', 'Per session'],
      ['each', 'Each']
    ]),
    itemFunding: opt([
      ['private', 'Private fee schedule'],
      ['ndis', 'NDIS'],
      ['sah', 'Support at Home'],
      ['medicare', 'Medicare']
    ]),
    billTo: opt([
      ['client', 'Client'],
      ['planmanager', 'Plan manager'],
      ['provider', 'Support at Home provider'],
      ['other', 'Someone else']
    ]),
    state: opt([
      ['NSW', 'NSW'],
      ['QLD', 'QLD']
    ]),
    deliveryMethod: opt([
      ['email', 'Secure email'],
      ['portal', 'Provider portal'],
      ['post', 'Post'],
      ['hand', 'In person']
    ]),
    paymentMethod: opt([
      ['transfer', 'Bank transfer'],
      ['card', 'Card'],
      ['planmanager', 'Paid by plan manager'],
      ['provider', 'Paid by provider']
    ])
  };

  /* Status sets: label, tone (colour family) and icon. Badges always show the label. */
  const s = (label, tone, icon) => ({ label, tone, icon });
  const statuses = {
    client: {
      active: s('Active', 'success', 'checkCircle'),
      waitlist: s('Waitlisted', 'warning', 'clock'),
      onhold: s('On hold', 'neutral', 'minusCircle'),
      discharged: s('Discharged', 'neutral', 'check'),
      archived: s('Archived', 'neutral', 'archive')
    },
    referral: {
      new: s('New enquiry', 'info', 'inbox'),
      awaiting: s('Awaiting information', 'warning', 'clock'),
      review: s('Under review', 'info', 'eye'),
      accepted: s('Accepted', 'success', 'checkCircle'),
      waitlisted: s('Waitlisted', 'warning', 'clock'),
      closed: s('Closed', 'neutral', 'minusCircle')
    },
    appointment: {
      scheduled: s('Scheduled', 'info', 'calendar'),
      rescheduled: s('Rescheduled', 'warning', 'refresh'),
      completed: s('Completed', 'success', 'check'),
      cancelled: s('Cancelled', 'neutral', 'minusCircle')
    },
    note: {
      draft: s('Draft', 'warning', 'edit'),
      final: s('Finalised', 'success', 'lock')
    },
    assessment: {
      planned: s('Planned', 'info', 'calendar'),
      inprogress: s('In progress', 'warning', 'clock'),
      completed: s('Completed', 'success', 'check'),
      reviewed: s('Reviewed', 'sage', 'checkCircle')
    },
    goal: {
      planned: s('Planned', 'info', 'calendar'),
      active: s('Active', 'sage', 'target'),
      achieved: s('Achieved', 'success', 'checkCircle'),
      discontinued: s('Discontinued', 'neutral', 'minusCircle')
    },
    report: {
      draft: s('Draft', 'warning', 'edit'),
      review: s('In review', 'info', 'eye'),
      completed: s('Completed', 'success', 'check'),
      delivered: s('Delivered', 'sage', 'send')
    },
    document: {
      current: s('Current', 'success', 'check'),
      draft: s('Draft', 'warning', 'edit'),
      awaiting: s('Awaiting signature', 'warning', 'clock'),
      superseded: s('Superseded', 'neutral', 'archive')
    },
    consent: {
      current: s('Current', 'success', 'checkCircle'),
      withdrawn: s('Withdrawn', 'danger', 'minusCircle'),
      expired: s('Expired', 'neutral', 'clock')
    },
    agreement: {
      draft: s('Draft', 'neutral', 'edit'),
      awaiting: s('Awaiting signature', 'warning', 'clock'),
      signed: s('Signed', 'success', 'checkCircle'),
      expired: s('Expired', 'neutral', 'clock'),
      cancelled: s('Cancelled', 'neutral', 'minusCircle')
    },
    plan: {
      active: s('Active', 'success', 'checkCircle'),
      ending: s('Ending soon', 'warning', 'clock'),
      ended: s('Ended', 'neutral', 'archive')
    },
    supportLog: {
      recorded: s('Needs checking', 'warning', 'edit'),
      verified: s('Verified', 'success', 'check'),
      invoiced: s('Invoiced', 'sage', 'receipt')
    },
    invoice: {
      draft: s('Draft', 'neutral', 'edit'),
      issued: s('Issued', 'info', 'send'),
      overdue: s('Overdue', 'danger', 'alert'),
      paid: s('Paid', 'success', 'checkCircle'),
      cancelled: s('Cancelled', 'neutral', 'minusCircle')
    },
    task: {
      open: s('Open', 'info', 'dot'),
      overdue: s('Overdue', 'danger', 'alert'),
      done: s('Done', 'success', 'check')
    },
    priority: {
      low: s('Low', 'neutral', 'chevronDown'),
      normal: s('Normal', 'info', 'dot'),
      high: s('High', 'danger', 'chevronUp')
    },
    incident: {
      open: s('Open', 'danger', 'alertCircle'),
      investigating: s('Investigating', 'warning', 'eye'),
      resolved: s('Resolved', 'success', 'check'),
      closed: s('Closed', 'neutral', 'archive')
    }
  };

  const statusOptions = (key) => Object.keys(statuses[key]).map((value) => ({ value, label: statuses[key][value].label }));

  /*
    Table definitions.
    fields: used by the form builder. type is one of text, email, tel, date, time, number,
    money, select, textarea, checkbox, checks, client, staff.
    title(record, db): how the record is named in lists and the change history.
  */
  const tables = {
    staff: {
      singular: 'staff member',
      plural: 'staff',
      title: (r) => r.name,
      fields: [
        { name: 'name', label: 'Full name', type: 'text', required: true },
        { name: 'role', label: 'Access role', type: 'select', options: options.role, required: true },
        { name: 'title', label: 'Position title', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', rule: 'phone' },
        { name: 'registration', label: 'AHPRA registration', type: 'text', hint: 'For registered practitioners only' }
      ]
    },

    clients: {
      singular: 'client',
      plural: 'clients',
      statusKey: 'client',
      title: (r) => (r.preferredName || r.firstName) + ' ' + r.lastName,
      fields: [
        { name: 'firstName', label: 'First name', type: 'text', required: true },
        { name: 'lastName', label: 'Last name', type: 'text', required: true },
        { name: 'preferredName', label: 'Preferred name', type: 'text' },
        { name: 'dob', label: 'Date of birth', type: 'date' },
        { name: 'phone', label: 'Phone', type: 'tel', rule: 'phone', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Street address', type: 'text', span: 'all' },
        { name: 'suburb', label: 'Suburb or town', type: 'text', required: true },
        { name: 'state', label: 'State', type: 'select', options: options.state, required: true },
        { name: 'postcode', label: 'Postcode', type: 'text', rule: 'postcode' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('client'), required: true },
        { name: 'therapistId', label: 'Therapist', type: 'staff', clinical: true, required: true },
        { name: 'fundingType', label: 'Funding', type: 'select', options: options.fundingType, required: true },
        { name: 'ndisNumber', label: 'NDIS number', type: 'text', rule: 'ndis', hint: 'Nine digits, NDIS participants only' },
        { name: 'startDate', label: 'Start date', type: 'date' },
        { name: 'referralSource', label: 'Referred by', type: 'text' },
        { name: 'alerts', label: 'Visit alerts', type: 'text', span: 'all', hint: 'Things staff should know before a home visit, such as pets or access' },
        { name: 'background', label: 'Background and reason for referral', type: 'textarea', span: 'all' },
        { name: 'livingSituation', label: 'Living situation', type: 'textarea', span: 'all' },
        { name: 'health', label: 'Relevant health information', type: 'textarea', span: 'all', hint: 'Only what is needed for occupational therapy' },
        { name: 'communication', label: 'Communication needs', type: 'text', span: 'all' }
      ]
    },

    contacts: {
      singular: 'contact',
      plural: 'contacts',
      title: (r) => r.name,
      clientField: 'clientId',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'kind', label: 'Type', type: 'select', options: options.contactKind, required: true },
        { name: 'relationship', label: 'Relationship or role', type: 'text', required: true },
        { name: 'organisation', label: 'Organisation', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'tel', rule: 'phone' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'isPrimary', label: 'Main contact for this client', type: 'checkbox' },
        { name: 'canDiscuss', label: 'Client has consented to us discussing their care with this person', type: 'checkbox', span: 'all' }
      ]
    },

    referrals: {
      singular: 'referral',
      plural: 'referrals',
      statusKey: 'referral',
      title: (r) => r.firstName + ' ' + r.lastName,
      fields: [
        { name: 'receivedDate', label: 'Date received', type: 'date', required: true },
        { name: 'source', label: 'Source', type: 'select', options: options.referralSource, required: true },
        { name: 'referrerName', label: 'Referrer name', type: 'text' },
        { name: 'referrerOrg', label: 'Referrer organisation', type: 'text' },
        { name: 'referrerPhone', label: 'Referrer phone', type: 'tel', rule: 'phone' },
        { name: 'referrerEmail', label: 'Referrer email', type: 'email' },
        { name: 'firstName', label: 'Client first name', type: 'text', required: true },
        { name: 'lastName', label: 'Client last name', type: 'text', required: true },
        { name: 'phone', label: 'Client phone', type: 'tel', rule: 'phone' },
        { name: 'email', label: 'Client email', type: 'email' },
        { name: 'suburb', label: 'Suburb or town', type: 'text', required: true },
        { name: 'state', label: 'State', type: 'select', options: options.state },
        { name: 'fundingType', label: 'Funding', type: 'select', options: options.fundingType },
        { name: 'ndisNumber', label: 'NDIS number', type: 'text', rule: 'ndis' },
        { name: 'service', label: 'Service requested', type: 'select', options: options.service, required: true },
        { name: 'status', label: 'Stage', type: 'select', options: statusOptions('referral'), required: true },
        { name: 'assignedTo', label: 'Assigned to', type: 'staff' },
        { name: 'nextAction', label: 'Next action', type: 'text', span: 'all' },
        { name: 'nextActionDate', label: 'Next action due', type: 'date' },
        { name: 'reason', label: 'Reason for referral', type: 'textarea', span: 'all', required: true },
        { name: 'notes', label: 'Intake notes', type: 'textarea', span: 'all' }
      ]
    },

    consents: {
      singular: 'consent record',
      plural: 'consent records',
      statusKey: 'consent',
      clientField: 'clientId',
      title: (r) => labelOf('consentType', r.type),
      fields: [
        { name: 'type', label: 'Consent for', type: 'select', options: options.consentType, required: true },
        { name: 'date', label: 'Date recorded', type: 'date', required: true },
        { name: 'givenBy', label: 'Given by', type: 'text', required: true, hint: 'The client, or their representative' },
        { name: 'method', label: 'How it was given', type: 'select', options: options.consentMethod, required: true },
        { name: 'expiryDate', label: 'Review or expiry date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('consent'), required: true },
        { name: 'limitations', label: 'Limits or conditions', type: 'textarea', span: 'all', hint: 'For example, information about mental health is not to be shared' },
        { name: 'withdrawnNote', label: 'Withdrawal details', type: 'textarea', span: 'all' }
      ]
    },

    agreements: {
      singular: 'service agreement',
      plural: 'service agreements',
      statusKey: 'agreement',
      clientField: 'clientId',
      title: (r) => 'Agreement ' + r.ref,
      fields: [
        { name: 'template', label: 'Template', type: 'select', options: options.agreementTemplate, required: true },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('agreement').filter((o) => o.value !== 'expired'), required: true },
        { name: 'services', label: 'Services covered', type: 'checks', options: options.service.filter((o) => o.value !== 'unsure'), span: 'all', required: true },
        { name: 'conditions', label: 'Conditions', type: 'textarea', span: 'all' },
        { name: 'cancellationTerms', label: 'Cancellation terms', type: 'textarea', span: 'all', required: true }
      ]
    },

    appointments: {
      singular: 'appointment',
      plural: 'appointments',
      statusKey: 'appointment',
      clientField: 'clientId',
      title: (r, db) => labelOf('appointmentType', r.type) + ' with ' + clientTitle(db, r.clientId) + ' on ' + AWY.fmt.date(r.date),
      fields: [
        { name: 'clientId', label: 'Client', type: 'client', required: true },
        { name: 'staffId', label: 'Staff member', type: 'staff', required: true },
        { name: 'type', label: 'Appointment type', type: 'select', options: options.appointmentType, required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'start', label: 'Start time', type: 'time', required: true },
        { name: 'duration', label: 'Duration in minutes', type: 'number', min: 15, max: 480, required: true },
        { name: 'location', label: 'Location', type: 'select', options: options.location, required: true },
        { name: 'address', label: 'Address or meeting point', type: 'text' },
        { name: 'travelMins', label: 'Travel time in minutes', type: 'number', min: 0, max: 240, hint: 'Each way, used for travel charges where they apply' },
        { name: 'followUp', label: 'Needs follow up after this session', type: 'checkbox' },
        { name: 'followUpNote', label: 'Follow up details', type: 'text', span: 'all' },
        { name: 'notes', label: 'Booking notes', type: 'textarea', span: 'all', hint: 'Practical details only. Clinical information belongs in the clinical note.' }
      ]
    },

    notes: {
      singular: 'clinical note',
      plural: 'clinical notes',
      statusKey: 'note',
      clientField: 'clientId',
      title: (r, db) => labelOf('noteTemplate', r.template) + ' for ' + clientTitle(db, r.clientId) + ', ' + AWY.fmt.date(r.date),
      /* Once finalised, only corrections can be added */
      lockedWhen: (r) => r.status === 'final',
      editableWhenLocked: ['amendments', 'updatedAt']
    },

    assessments: {
      singular: 'assessment',
      plural: 'assessments',
      statusKey: 'assessment',
      clientField: 'clientId',
      title: (r, db) => labelOf('assessmentType', r.type) + ' for ' + clientTitle(db, r.clientId),
      fields: [
        { name: 'type', label: 'Assessment type', type: 'select', options: options.assessmentType, required: true },
        { name: 'date', label: 'Assessment date', type: 'date', required: true },
        { name: 'assessorId', label: 'Assessor', type: 'staff', clinical: true, required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('assessment'), required: true },
        { name: 'methods', label: 'Methods used', type: 'checks', options: options.assessmentMethod, span: 'all' },
        { name: 'findings', label: 'Findings', type: 'textarea', span: 'all' },
        { name: 'functionalNeeds', label: 'Functional needs', type: 'textarea', span: 'all' },
        { name: 'recommendations', label: 'Recommendations', type: 'textarea', span: 'all' }
      ]
    },

    goals: {
      singular: 'goal',
      plural: 'goals',
      statusKey: 'goal',
      clientField: 'clientId',
      title: (r) => r.description,
      fields: [
        { name: 'description', label: 'Goal, in the client\'s words where possible', type: 'textarea', span: 'all', required: true },
        { name: 'area', label: 'Area', type: 'select', options: options.goalArea, required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('goal'), required: true },
        { name: 'createdDate', label: 'Date set', type: 'date', required: true },
        { name: 'reviewDate', label: 'Review date', type: 'date', required: true },
        { name: 'baseline', label: 'Starting point (0 to 10)', type: 'number', min: 0, max: 10, hint: 'For example, a COPM performance score' },
        { name: 'target', label: 'Target (0 to 10)', type: 'number', min: 0, max: 10 }
      ]
    },

    progress: {
      singular: 'progress update',
      plural: 'progress updates',
      clientField: 'clientId',
      title: (r) => 'Progress update on ' + AWY.fmt.date(r.date),
      fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'rating', label: 'Rating (0 to 10)', type: 'number', min: 0, max: 10, required: true },
        { name: 'comment', label: 'What changed', type: 'textarea', span: 'all', required: true }
      ]
    },

    reports: {
      singular: 'report',
      plural: 'reports',
      statusKey: 'report',
      clientField: 'clientId',
      title: (r, db) => labelOf('reportType', r.type) + ' for ' + clientTitle(db, r.clientId),
      fields: [
        { name: 'clientId', label: 'Client', type: 'client', required: true },
        { name: 'type', label: 'Report type', type: 'select', options: options.reportType, required: true },
        { name: 'authorId', label: 'Author', type: 'staff', clinical: true, required: true },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
        { name: 'recipient', label: 'Intended recipient', type: 'text', span: 'all', hint: 'Who the report is for, such as the NDIA or the client\'s GP' },
        { name: 'summary', label: 'Purpose of the report', type: 'textarea', span: 'all' }
      ]
    },

    documents: {
      singular: 'document',
      plural: 'documents',
      statusKey: 'document',
      clientField: 'clientId',
      title: (r) => r.name,
      fields: [
        { name: 'clientId', label: 'Client', type: 'client', required: true },
        { name: 'name', label: 'Document name', type: 'text', required: true, span: 'all' },
        { name: 'type', label: 'Type', type: 'select', options: options.documentType, required: true },
        { name: 'date', label: 'Document date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('document'), required: true },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 'all' }
      ]
    },

    fundingPlans: {
      singular: 'funding plan',
      plural: 'funding plans',
      statusKey: 'plan',
      clientField: 'clientId',
      title: (r, db) => r.name + ' for ' + clientTitle(db, r.clientId),
      fields: [
        { name: 'clientId', label: 'Client', type: 'client', required: true },
        { name: 'name', label: 'Plan name', type: 'text', required: true },
        { name: 'fundingType', label: 'Funding', type: 'select', options: options.fundingType, required: true },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'budget', label: 'Amount for occupational therapy', type: 'money', hint: 'Leave blank if there is no set amount' },
        { name: 'sessionsAllowed', label: 'Sessions allowed', type: 'number', min: 0, hint: 'For Medicare GP plans' },
        { name: 'managedBy', label: 'Plan manager or provider', type: 'text' },
        { name: 'reference', label: 'Plan or package reference', type: 'text' },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 'all' }
      ]
    },

    supportItems: {
      singular: 'price item',
      plural: 'price items',
      title: (r) => r.name,
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, span: 'all' },
        { name: 'funding', label: 'Fee schedule', type: 'select', options: options.itemFunding, required: true },
        { name: 'code', label: 'Support item or item number', type: 'text' },
        { name: 'unit', label: 'Unit', type: 'select', options: options.unit, required: true },
        { name: 'rate', label: 'Rate', type: 'money', required: true },
        { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true },
        { name: 'effectiveTo', label: 'Effective until', type: 'date', hint: 'Leave blank if still current' },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 'all' }
      ]
    },

    supportLogs: {
      singular: 'delivered service',
      plural: 'delivered services',
      statusKey: 'supportLog',
      clientField: 'clientId',
      title: (r, db) => r.description + ' for ' + clientTitle(db, r.clientId) + ', ' + AWY.fmt.date(r.date)
    },

    invoices: {
      singular: 'invoice',
      plural: 'invoices',
      statusKey: 'invoice',
      clientField: 'clientId',
      title: (r) => 'Invoice ' + r.number
    },

    invoiceLines: {
      singular: 'invoice line',
      plural: 'invoice lines',
      title: (r) => r.description
    },

    tasks: {
      singular: 'task',
      plural: 'tasks',
      statusKey: 'task',
      clientField: 'clientId',
      title: (r) => r.title,
      fields: [
        { name: 'title', label: 'Task', type: 'text', required: true, span: 'all' },
        { name: 'clientId', label: 'Related client', type: 'client' },
        { name: 'assignedTo', label: 'Assigned to', type: 'staff', required: true },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: options.priority, required: true },
        { name: 'description', label: 'Details', type: 'textarea', span: 'all' }
      ]
    },

    incidents: {
      singular: 'incident or complaint',
      plural: 'incidents and complaints',
      statusKey: 'incident',
      clientField: 'clientId',
      title: (r) => r.title,
      fields: [
        { name: 'kind', label: 'Type', type: 'select', options: options.incidentKind, required: true },
        { name: 'date', label: 'Date it happened', type: 'date', required: true },
        { name: 'title', label: 'Short summary', type: 'text', required: true, span: 'all' },
        { name: 'clientId', label: 'Client involved', type: 'client' },
        { name: 'assignedTo', label: 'Assigned to', type: 'staff', required: true },
        { name: 'status', label: 'Status', type: 'select', options: statusOptions('incident'), required: true },
        { name: 'reportable', label: 'Reportable to an external body', type: 'select', options: options.reportable, required: true },
        { name: 'description', label: 'What happened', type: 'textarea', span: 'all', required: true },
        { name: 'actionTaken', label: 'Action taken', type: 'textarea', span: 'all' },
        { name: 'resolution', label: 'Resolution', type: 'textarea', span: 'all' }
      ]
    },

    auditEvents: {
      singular: 'change',
      plural: 'changes',
      title: (r) => r.summary
    },

    settings: {
      singular: 'setting',
      plural: 'settings',
      title: () => 'Practice settings'
    }
  };

  function labelOf(optionKey, value) {
    const list = options[optionKey] || [];
    const found = list.find((o) => o.value === value);
    return found ? found.label : value || '';
  }

  function clientTitle(db, id) {
    const c = db && db.clients ? db.clients.find((x) => x.id === id) : null;
    return c ? tables.clients.title(c) : 'a client';
  }

  function status(key, value) {
    return (statuses[key] && statuses[key][value]) || { label: value || 'Unknown', tone: 'neutral', icon: 'dot' };
  }

  function fieldLabel(table, name) {
    const def = tables[table];
    const f = def && def.fields ? def.fields.find((x) => x.name === name) : null;
    return f ? f.label : name.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  AWY.schema = { options, statuses, tables, labelOf, status, statusOptions, fieldLabel, clientTitle };
})();
