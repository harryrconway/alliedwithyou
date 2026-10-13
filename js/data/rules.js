/*
  Business rules and derived values.
  These are plain functions over a data snapshot. Totals, overdue states, dashboard
  figures and statistics are always worked out here from the underlying records,
  never stored separately.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const D = AWY.date;
  const schema = AWY.schema;

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const byId = (list, id) => list.find((r) => r.id === id) || null;
  const sum = (list, fn) => round2(list.reduce((t, x) => t + (Number(fn(x)) || 0), 0));
  const LIVE_APPOINTMENT = ['scheduled', 'rescheduled'];

  const rules = {
    round2,
    sum,

    /* Names */
    clientName(c) {
      return c ? schema.tables.clients.title(c) : 'Unknown client';
    },
    clientFullName(c) {
      return c ? c.firstName + ' ' + c.lastName : 'Unknown client';
    },
    client(db, id) {
      return byId(db.clients, id);
    },
    clientNameById(db, id) {
      return rules.clientName(byId(db.clients, id));
    },
    staffName(db, id) {
      if (id === 'system') return 'Automatic';
      if (id === 'website') return 'Website form';
      const s = byId(db.staff, id);
      return s ? s.name : 'Former staff member';
    },
    staffFirstName(db, id) {
      return rules.staffName(db, id).split(' ')[0];
    },
    forClient(db, table, clientId) {
      return db[table].filter((r) => r.clientId === clientId);
    },
    isNdis(fundingType) {
      return String(fundingType || '').startsWith('ndis');
    },
    fundingKind(fundingType) {
      if (rules.isNdis(fundingType)) return 'ndis';
      if (fundingType === 'sah') return 'sah';
      return 'private';
    },

    /* Appointments */
    appointmentEnd(a) {
      return D.addMinutes(a.start, Number(a.duration) || 0);
    },
    isLive(a) {
      return LIVE_APPOINTMENT.includes(a.status);
    },
    upcoming(db, today, days) {
      const until = D.addDays(today, days);
      return db.appointments
        .filter((a) => rules.isLive(a) && a.date >= today && a.date <= until)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    },
    onDay(db, day, staffId) {
      return db.appointments
        .filter((a) => a.date === day && (!staffId || a.staffId === staffId))
        .sort((a, b) => a.start.localeCompare(b.start));
    },
    nextAppointment(db, clientId, today) {
      return db.appointments
        .filter((a) => a.clientId === clientId && rules.isLive(a) && a.date >= today)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0] || null;
    },
    lastAppointment(db, clientId, today) {
      return db.appointments
        .filter((a) => a.clientId === clientId && a.status === 'completed' && a.date <= today)
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0] || null;
    },

    /* Clinical notes */
    noteFor(db, appointmentId) {
      return db.notes.find((n) => n.appointmentId === appointmentId) || null;
    },
    /* Completed sessions that don't yet have a finalised note */
    notesOutstanding(db, today) {
      return db.appointments
        .filter((a) => a.status === 'completed' && a.date <= today)
        .map((a) => ({ appointment: a, note: rules.noteFor(db, a.id) }))
        .filter((x) => !x.note || x.note.status !== 'final')
        .sort((a, b) => a.appointment.date.localeCompare(b.appointment.date));
    },

    /* Invoices */
    lineAmount(line) {
      return round2((Number(line.quantity) || 0) * (Number(line.rate) || 0));
    },
    invoiceLines(db, invoiceId) {
      return db.invoiceLines.filter((l) => l.invoiceId === invoiceId).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    },
    invoiceTotal(db, invoice) {
      return sum(rules.invoiceLines(db, invoice.id), rules.lineAmount);
    },
    invoiceStatus(invoice, today) {
      if (invoice.status === 'issued' && invoice.dueDate < today) return 'overdue';
      return invoice.status;
    },
    unpaidInvoices(db, today) {
      return db.invoices.filter((i) => i.status === 'issued').map((i) => Object.assign({}, i, { derivedStatus: rules.invoiceStatus(i, today), total: rules.invoiceTotal(db, i) }));
    },
    billTo(db, client, today) {
      const kind = client ? client.fundingType : '';
      const plan = client ? rules.activePlan(db, client.id, today) : null;
      if (kind === 'ndis_plan') return { billTo: 'planmanager', billToName: (plan && plan.managedBy) || 'Plan manager' };
      if (kind === 'sah') return { billTo: 'provider', billToName: (plan && plan.managedBy) || 'Support at Home provider' };
      return { billTo: 'client', billToName: rules.clientFullName(client) };
    },

    /* Service agreements and consent */
    agreementStatus(a, today) {
      if (a.status === 'signed' && a.endDate && a.endDate < today) return 'expired';
      return a.status;
    },
    agreementStale(a, today) {
      return a.status === 'awaiting' && a.sentDate && D.diffDays(a.sentDate, today) >= 7;
    },
    currentAgreement(db, clientId, today) {
      return db.agreements.find((a) => a.clientId === clientId && rules.agreementStatus(a, today) === 'signed') || null;
    },
    unsignedAgreements(db) {
      return db.agreements.filter((a) => a.status === 'awaiting' || a.status === 'draft');
    },
    consentStatus(c, today) {
      if (c.status === 'current' && c.expiryDate && c.expiryDate < today) return 'expired';
      return c.status;
    },
    hasTreatmentConsent(db, clientId, today) {
      return db.consents.some((c) => c.clientId === clientId && c.type === 'treatment' && rules.consentStatus(c, today) === 'current');
    },
    consentGaps(db, today) {
      return db.clients.filter((c) => c.status === 'active' && !rules.hasTreatmentConsent(db, c.id, today));
    },

    /* Goals */
    goalProgress(db, goalId) {
      return db.progress.filter((p) => p.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date));
    },
    goalLatest(db, goal) {
      const list = rules.goalProgress(db, goal.id);
      return list.length ? list[list.length - 1].rating : goal.baseline;
    },
    goalsDueReview(db, today, within) {
      const until = D.addDays(today, within === undefined ? 14 : within);
      return db.goals.filter((g) => g.status === 'active' && g.reviewDate <= until).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));
    },

    /* Reports */
    reportsOutstanding(db) {
      return db.reports.filter((r) => r.status !== 'delivered');
    },
    reportOverdue(r, today) {
      return (r.status === 'draft' || r.status === 'review') && r.dueDate < today;
    },
    reportsDueSoon(db, today, within) {
      const until = D.addDays(today, within === undefined ? 7 : within);
      return db.reports.filter((r) => (r.status === 'draft' || r.status === 'review') && r.dueDate <= until).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },

    /* Tasks */
    taskStatus(t, today) {
      if (t.status === 'open' && t.dueDate < today) return 'overdue';
      return t.status;
    },
    openTasks(db) {
      return db.tasks.filter((t) => t.status === 'open');
    },
    overdueTasks(db, today) {
      return db.tasks.filter((t) => t.status === 'open' && t.dueDate < today);
    },

    /* Pricing: the rate in effect on a given date */
    rateFor(db, key, date) {
      return db.supportItems
        .filter((i) => i.key === key && i.effectiveFrom <= date && (!i.effectiveTo || i.effectiveTo >= date))
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
    },
    itemVersions(db, key) {
      return db.supportItems.filter((i) => i.key === key).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    },
    itemIsCurrent(item, today) {
      return item.effectiveFrom <= today && (!item.effectiveTo || item.effectiveTo >= today);
    },
    logAmount(log) {
      return round2((Number(log.quantity) || 0) * (Number(log.rate) || 0));
    },

    /* Funding plans */
    planStatus(plan, today) {
      if (plan.endDate < today) return 'ended';
      if (D.diffDays(today, plan.endDate) <= 42) return 'ending';
      return 'active';
    },
    activePlan(db, clientId, date) {
      return db.fundingPlans.find((p) => p.clientId === clientId && p.startDate <= date && p.endDate >= date) || null;
    },
    planLogs(db, plan) {
      return db.supportLogs.filter((l) => l.clientId === plan.clientId && l.date >= plan.startDate && l.date <= plan.endDate);
    },
    planUsage(db, plan) {
      const logs = rules.planLogs(db, plan);
      const used = sum(logs, rules.logAmount);
      const sessions = new Set(logs.filter((l) => !l.travel && l.appointmentId).map((l) => l.appointmentId)).size;
      const budget = Number(plan.budget) || 0;
      return {
        used: used,
        budget: budget,
        remaining: budget ? round2(budget - used) : null,
        percent: budget ? Math.min(100, Math.round((used / budget) * 100)) : null,
        sessions: sessions,
        sessionsAllowed: Number(plan.sessionsAllowed) || null,
        logs: logs
      };
    },

    /* Things worth knowing about a client at a glance */
    clientFlags(db, client, today) {
      const flags = [];
      if (client.status !== 'active') return flags;
      if (!rules.hasTreatmentConsent(db, client.id, today)) flags.push({ tone: 'danger', icon: 'alertCircle', text: 'No current consent for assessment and therapy' });
      const agreement = rules.currentAgreement(db, client.id, today);
      if (!agreement) {
        const pending = db.agreements.find((a) => a.clientId === client.id && (a.status === 'awaiting' || a.status === 'draft'));
        flags.push(pending
          ? { tone: 'warning', icon: 'clock', text: pending.status === 'awaiting' ? 'Service agreement awaiting signature' : 'Service agreement still in draft' }
          : { tone: 'warning', icon: 'signature', text: 'No signed service agreement' });
      }
      const plan = rules.activePlan(db, client.id, today);
      if (plan) {
        const st = rules.planStatus(plan, today);
        if (st === 'ending') flags.push({ tone: 'warning', icon: 'wallet', text: plan.name + ' ends ' + AWY.fmt.date(plan.endDate) });
        const usage = rules.planUsage(db, plan);
        if (usage.percent !== null && usage.percent >= 85) flags.push({ tone: 'warning', icon: 'wallet', text: usage.percent + '% of funding used' });
        if (usage.sessionsAllowed && usage.sessions >= usage.sessionsAllowed) flags.push({ tone: 'warning', icon: 'wallet', text: 'All Medicare sessions used this year' });
      } else if (client.fundingType !== 'private' && client.fundingType !== 'healthfund') {
        flags.push({ tone: 'warning', icon: 'wallet', text: 'No current funding plan recorded' });
      }
      const overdue = db.invoices.filter((i) => i.clientId === client.id && rules.invoiceStatus(i, today) === 'overdue');
      if (overdue.length) flags.push({ tone: 'danger', icon: 'receipt', text: AWY.fmt.plural(overdue.length, 'overdue invoice') });
      const notes = rules.notesOutstanding(db, today).filter((x) => x.appointment.clientId === client.id);
      if (notes.length) flags.push({ tone: 'warning', icon: 'note', text: AWY.fmt.plural(notes.length, 'session note') + ' to finish' });
      return flags;
    },

    /* Everything the dashboard shows, worked out from the records */
    dashboard(db, today) {
      const upcoming = rules.upcoming(db, today, 7);
      const unpaid = rules.unpaidInvoices(db, today);
      const overdueInvoices = unpaid.filter((i) => i.derivedStatus === 'overdue');
      return {
        today: rules.onDay(db, today).filter((a) => a.status !== 'cancelled'),
        upcoming: upcoming,
        newReferrals: db.referrals.filter((r) => r.status === 'new'),
        activeClients: db.clients.filter((c) => c.status === 'active'),
        notesOutstanding: rules.notesOutstanding(db, today),
        reportsOutstanding: rules.reportsOutstanding(db),
        reportsDueSoon: rules.reportsDueSoon(db, today, 7),
        unsignedAgreements: rules.unsignedAgreements(db),
        staleAgreements: db.agreements.filter((a) => rules.agreementStale(a, today)),
        openTasks: rules.openTasks(db),
        overdueTasks: rules.overdueTasks(db, today),
        unpaid: unpaid,
        unpaidTotal: sum(unpaid, (i) => i.total),
        overdueInvoices: overdueInvoices,
        goalsDueReview: rules.goalsDueReview(db, today, 14),
        consentGaps: rules.consentGaps(db, today),
        logsToCheck: db.supportLogs.filter((l) => l.status === 'recorded'),
        readyToInvoice: db.supportLogs.filter((l) => l.status === 'verified' && !l.invoiceId)
      };
    },

    /* Business statistics for a date range */
    statistics(db, from, to) {
      const inRange = (d) => d && d >= from && d <= to;
      const appts = db.appointments.filter((a) => inRange(a.date));
      const completed = appts.filter((a) => a.status === 'completed');
      const logs = db.supportLogs.filter((l) => inRange(l.date));
      const invoices = db.invoices.filter((i) => inRange(i.issueDate));
      const referrals = db.referrals.filter((r) => inRange(r.receivedDate));
      const countBy = (list, fn) => list.reduce((m, x) => {
        const k = fn(x);
        m[k] = (m[k] || 0) + 1;
        return m;
      }, {});

      const weeks = [];
      let w = D.startOfWeek(from);
      while (w <= to) {
        const end = D.addDays(w, 6);
        weeks.push({
          start: w,
          completed: completed.filter((a) => a.date >= w && a.date <= end).length,
          booked: appts.filter((a) => a.date >= w && a.date <= end && a.status !== 'cancelled').length
        });
        w = D.addDays(w, 7);
      }

      const invoiceSummary = {};
      invoices.forEach((i) => {
        const st = rules.invoiceStatus(i, D.today());
        invoiceSummary[st] = invoiceSummary[st] || { count: 0, total: 0 };
        invoiceSummary[st].count += 1;
        invoiceSummary[st].total = round2(invoiceSummary[st].total + rules.invoiceTotal(db, i));
      });

      return {
        activeClients: db.clients.filter((c) => c.status === 'active').length,
        newClients: db.clients.filter((c) => inRange(c.startDate)).length,
        referrals: referrals.length,
        referralSources: countBy(referrals, (r) => r.source),
        appointments: appts.filter((a) => a.status !== 'cancelled').length,
        completedAppointments: completed.length,
        cancelled: appts.filter((a) => a.status === 'cancelled').length,
        lateCancellations: appts.filter((a) => a.status === 'cancelled' && a.lateCancellation).length,
        weeks: weeks,
        assessmentsCompleted: db.assessments.filter((a) => (a.status === 'completed' || a.status === 'reviewed') && inRange(a.date)).length,
        reportsOutstanding: rules.reportsOutstanding(db).length,
        reportsDelivered: db.reports.filter((r) => r.status === 'delivered' && inRange(r.deliveredDate)).length,
        serviceHours: round2(sum(logs.filter((l) => !l.travel && l.unit === 'hour'), (l) => l.quantity) + sum(logs.filter((l) => !l.travel && l.unit === 'session'), (l) => (l.minutes || 60) / 60)),
        travelHours: sum(logs.filter((l) => l.travel), (l) => l.quantity),
        deliveredValue: sum(logs, rules.logAmount),
        invoiced: sum(invoices.filter((i) => i.status !== 'cancelled' && i.status !== 'draft'), (i) => rules.invoiceTotal(db, i)),
        paid: sum(invoices.filter((i) => i.status === 'paid'), (i) => rules.invoiceTotal(db, i)),
        invoiceSummary: invoiceSummary,
        fundingMix: countBy(db.clients.filter((c) => c.status === 'active'), (c) => c.fundingType),
        appointmentTypes: countBy(completed, (a) => a.type)
      };
    }
  };

  AWY.rules = rules;
})();
