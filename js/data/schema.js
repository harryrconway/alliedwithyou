/*
  Field, option and status definitions for the dashboard.
  Forms, badges and validation read from here, so each one is described once.
  Only the sections that are switched on are described. Client and clinical records
  are added back when those sections open.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));

  const NO_CLIENT_DETAILS = "Please don't include client names or health details. Client records aren't switched on yet.";

  const options = {
    role: opt([
      ['administrator', 'Administrator'],
      ['therapist', 'Occupational therapist'],
      ['reception', 'Reception'],
      ['support', 'Support staff'],
      ['developer', 'Developer']
    ]),
    fundingType: opt([
      ['private', 'Private (self funded)'],
      ['healthfund', 'Private health insurance'],
      ['medicare', 'Medicare GP plan'],
      ['sah', 'Support at Home'],
      ['ndis_self', 'NDIS self managed'],
      ['ndis_plan', 'NDIS plan managed'],
      ['ndis_agency', 'NDIS agency managed']
    ]),
    service: opt([
      ['assessments', 'Functional capacity assessment'],
      ['independence', 'Daily living and independence'],
      ['home', 'Home safety and access'],
      ['technology', 'Assistive technology and equipment'],
      ['therapy', 'Goal focused therapy'],
      ['reports', 'Report or recommendations']
    ]),
    appointmentType: opt([
      ['initial', 'Initial assessment'],
      ['therapy', 'Therapy session'],
      ['homevisit', 'Home safety visit'],
      ['assessment', 'Functional assessment'],
      ['equipment', 'Equipment trial'],
      ['review', 'Review']
    ]),
    priority: opt([
      ['low', 'Low'],
      ['normal', 'Normal'],
      ['high', 'High']
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
    blockKind: opt([
      ['booked', 'Booked'],
      ['unavailable', 'Unavailable'],
      ['leave', 'Leave'],
      ['admin', 'Admin time'],
      ['travel', 'Travel']
    ]),
    timeZone: opt([
      ['Australia/Sydney', 'NSW time (Northern Rivers)'],
      ['Australia/Brisbane', 'QLD time (Gold Coast)']
    ]),
    blockLength: opt([
      ['15', '15 minutes'],
      ['30', '30 minutes'],
      ['45', '45 minutes'],
      ['60', '1 hour'],
      ['90', '1 hour 30 minutes'],
      ['120', '2 hours'],
      ['150', '2 hours 30 minutes'],
      ['180', '3 hours'],
      ['240', '4 hours'],
      ['300', '5 hours'],
      ['360', '6 hours'],
      ['480', '8 hours'],
      ['600', '10 hours']
    ]),
    feedbackKind: opt([
      ['issue', 'Something went wrong'],
      ['bug', "Something isn't working properly"],
      ['feature', 'An idea for something new'],
      ['suggestion', 'A way to improve something']
    ]),
    errorCategory: opt([
      ['validation', 'Form check'],
      ['network', 'Connection dropped'],
      ['uncertain', 'Save not confirmed'],
      ['permission', 'Not allowed'],
      ['server', 'Server error'],
      ['unexpected', 'Unexpected error']
    ])
  };

  /* Status sets: label, tone (colour family) and icon. Badges always show the label. */
  const s = (label, tone, icon) => ({ label, tone, icon });
  const statuses = {
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
    account: {
      pending: s('Waiting for approval', 'warning', 'clock'),
      active: s('Active', 'success', 'checkCircle'),
      declined: s('Declined', 'neutral', 'minusCircle'),
      disabled: s('Switched off', 'neutral', 'lock')
    },
    feedback: {
      submitted: s('Submitted', 'info', 'dot'),
      under_review: s('Under review', 'warning', 'eye'),
      planned: s('Planned', 'info', 'calendar'),
      in_progress: s('In progress', 'warning', 'refresh'),
      completed: s('Completed', 'success', 'checkCircle'),
      declined: s('Declined', 'neutral', 'minusCircle')
    }
  };

  const statusOptions = (key) => Object.keys(statuses[key]).map((value) => ({ value, label: statuses[key][value].label }));

  /*
    Table definitions.
    fields: used by the form builder. type is one of text, email, tel, date, time, number,
    money, select, textarea, checkbox, checks, staff.
  */
  const tables = {
    staff: {
      singular: 'staff member',
      plural: 'staff',
      fields: [
        { name: 'name', label: 'Full name', type: 'text', required: true },
        { name: 'title', label: 'Position title', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'tel', rule: 'phone' },
        { name: 'registration', label: 'AHPRA registration', type: 'text', hint: 'For registered practitioners only' }
      ]
    },

    tasks: {
      singular: 'task',
      plural: 'tasks',
      fields: [
        { name: 'title', label: 'Task', type: 'text', required: true, span: 'all', hint: NO_CLIENT_DETAILS },
        { name: 'assignedTo', label: 'Assigned to', type: 'staff', required: true },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: options.priority, required: true },
        { name: 'description', label: 'Details', type: 'textarea', span: 'all' }
      ]
    },

    calendar: {
      singular: 'calendar entry',
      plural: 'calendar entries'
    },

    supportItems: {
      singular: 'fee',
      plural: 'fees',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, span: 'all' },
        { name: 'funding', label: 'Fee schedule', type: 'select', options: options.itemFunding, required: true },
        { name: 'code', label: 'Support item or item number', type: 'text' },
        { name: 'unit', label: 'Unit', type: 'select', options: options.unit, required: true },
        { name: 'rate', label: 'Rate', type: 'money', required: true },
        { name: 'effectiveFrom', label: 'Applies from', type: 'date', required: true },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 'all' }
      ]
    },

    feedback: {
      singular: 'report',
      plural: 'reports',
      fields: [
        { name: 'kind', label: 'What is it about?', type: 'select', options: options.feedbackKind, required: true, span: 'all' },
        { name: 'title', label: 'Short summary', type: 'text', required: true, span: 'all' },
        { name: 'description', label: 'What were you doing, and what happened?', type: 'textarea', span: 'all', rows: 5, hint: NO_CLIENT_DETAILS }
      ]
    }
  };

  function labelOf(optionKey, value) {
    const list = options[optionKey] || [];
    const found = list.find((o) => String(o.value) === String(value));
    return found ? found.label : value || '';
  }

  function status(key, value) {
    return (statuses[key] && statuses[key][value]) || { label: value || 'Unknown', tone: 'neutral', icon: 'dot' };
  }

  function fieldLabel(table, name) {
    const def = tables[table];
    const f = def && def.fields ? def.fields.find((x) => x.name === name) : null;
    return f ? f.label : name.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  AWY.schema = { options, statuses, tables, labelOf, status, statusOptions, fieldLabel, NO_CLIENT_DETAILS };
})();
