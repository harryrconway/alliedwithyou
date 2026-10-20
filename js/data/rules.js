/*
  Business rules and derived values.
  Plain functions over a data snapshot. Overdue states, current fees and calendar
  clashes are always worked out here from the underlying records, never stored.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});
  const D = AWY.date;

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const byId = (list, id) => list.find((r) => r.id === id) || null;

  const rules = {
    round2,

    /* Staff */
    staffName(db, id) {
      const s = byId(db.staff, id);
      if (!s) return 'Former staff member';
      return s.name || s.email;
    },
    staffFirstName(db, id) {
      return rules.staffName(db, id).split(' ')[0];
    },
    activeStaff(db) {
      return db.staff.filter((s) => s.status === 'active').sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    },
    pendingStaff(db) {
      return db.staff.filter((s) => s.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    /* Tasks */
    taskStatus(t, today) {
      if (t.status === 'open' && t.dueDate < today) return 'overdue';
      return t.status;
    },
    openTasks(db, staffId) {
      return db.tasks.filter((t) => t.status === 'open' && (!staffId || t.assignedTo === staffId));
    },
    overdueTasks(db, today, staffId) {
      return rules.openTasks(db, staffId).filter((t) => t.dueDate < today);
    },

    /* Fees: the rate in effect on a given date */
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

    /* Staff checks: renew within 60 days of expiry */
    checkStatus(c, today) {
      if (!c.expiresOn) return 'noexpiry';
      if (c.expiresOn < today) return 'expired';
      if (c.expiresOn <= D.addDays(today, 60)) return 'expiring';
      return 'current';
    },
    checksDue(db, today, staffId) {
      return db.staffChecks
        .filter((c) => (!staffId || c.staffId === staffId) && ['expired', 'expiring'].includes(rules.checkStatus(c, today)))
        .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
    },

    /* Templates */
    templateVersions(db, templateId) {
      return db.templateVersions.filter((v) => v.templateId === templateId).sort((a, b) => b.versionNo - a.versionNo);
    },

    /* Calendar entries. Each one happens at an exact moment, shown in the time zone it was booked in. */
    blockStart(b) {
      return new Date(b.startsAt).getTime();
    },
    blockEnd(b) {
      return new Date(b.startsAt).getTime() + Number(b.duration) * 60000;
    },
    /* Another entry for the same person that overlaps, ignoring the one being edited */
    blockClash(db, entry, ignoreId) {
      const start = new Date(entry.startsAt).getTime();
      const end = start + Number(entry.duration) * 60000;
      return db.calendar.find((b) => b.id !== ignoreId && b.staffId === entry.staffId && start < rules.blockEnd(b) && end > rules.blockStart(b)) || null;
    },
    blocksOn(db, day, staffId) {
      return db.calendar
        .filter((b) => b.date === day && (!staffId || b.staffId === staffId))
        .sort((a, b) => a.start.localeCompare(b.start));
    },
    blocksBetween(db, from, to, staffId) {
      return db.calendar
        .filter((b) => b.date >= from && b.date <= to && (!staffId || b.staffId === staffId))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    },
    weekAhead(today) {
      return D.addDays(today, 6);
    }
  };

  AWY.rules = rules;
})();
