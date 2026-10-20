/*
  Date helpers and Australian display formats.
  Dates are stored as YYYY-MM-DD strings and times as HH:MM (24 hour).
  Everything shown on screen goes through AWY.fmt so wording stays consistent.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* A time zone for each state and territory, in the usual order. The ACT has its own
     name so entries can be marked ACT, though its clock matches Sydney's. */
  const ZONES = {
    'Australia/Sydney': 'NSW',
    'Australia/Melbourne': 'VIC',
    'Australia/Brisbane': 'QLD',
    'Australia/Adelaide': 'SA',
    'Australia/Perth': 'WA',
    'Australia/Hobart': 'TAS',
    'Australia/Darwin': 'NT',
    'Australia/Canberra': 'ACT'
  };

  function parse(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  const date = {
    parse,
    toISO,
    today() {
      return toISO(new Date());
    },
    now() {
      return new Date().toISOString();
    },
    addDays(iso, n) {
      const d = parse(iso);
      d.setDate(d.getDate() + n);
      return toISO(d);
    },
    addMonths(iso, n) {
      const d = parse(iso);
      d.setMonth(d.getMonth() + n);
      return toISO(d);
    },
    /* Whole days from a to b (positive when b is later) */
    diffDays(a, b) {
      const da = parse(a);
      const db = parse(b);
      return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
    },
    /* Monday of the week containing iso */
    startOfWeek(iso) {
      const d = parse(iso);
      const offset = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - offset);
      return toISO(d);
    },
    startOfMonth(iso) {
      const d = parse(iso);
      return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
    },
    endOfMonth(iso) {
      const d = parse(iso);
      return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    },
    weekday(iso) {
      return parse(iso).getDay();
    },
    /* Skips Saturdays and Sundays */
    addBusinessDays(iso, n) {
      let d = iso;
      let left = n;
      while (left > 0) {
        d = date.addDays(d, 1);
        const wd = date.weekday(d);
        if (wd !== 0 && wd !== 6) left -= 1;
      }
      return d;
    },
    minutes(time) {
      const [h, m] = String(time || '0:0').split(':').map(Number);
      return h * 60 + m;
    },
    fromMinutes(total) {
      return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
    },
    addMinutes(time, mins) {
      return date.fromMinutes(date.minutes(time) + mins);
    },
    stampDate(stamp) {
      return stamp ? toISO(new Date(stamp)) : '';
    },

    /* Time zones. Clocks differ by up to three hours across Australia, and only some states
       have daylight saving, so a stored moment shows as different local times around the country. */
    ZONES: ZONES,
    localZone() {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Brisbane';
      } catch (error) {
        return 'Australia/Brisbane';
      }
    },
    /* The date and time a moment falls on in a given zone */
    zoneParts(stamp, timeZone) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(stamp));
      const get = (t) => (parts.find((p) => p.type === t) || {}).value;
      return { date: get('year') + '-' + get('month') + '-' + get('day'), time: (get('hour') === '24' ? '00' : get('hour')) + ':' + get('minute') };
    },
    /* Minutes the zone is ahead of UTC at that moment */
    zoneOffset(stamp, timeZone) {
      const p = date.zoneParts(stamp, timeZone);
      const [y, m, d] = p.date.split('-').map(Number);
      const [h, mi] = p.time.split(':').map(Number);
      const asUtc = Date.UTC(y, m - 1, d, h, mi);
      const t = new Date(stamp).getTime();
      return Math.round((asUtc - (t - (t % 60000))) / 60000);
    },
    /* The exact moment for a local date and time in a zone */
    fromZone(day, time, timeZone) {
      const [y, m, d] = day.split('-').map(Number);
      const [h, mi] = String(time).split(':').map(Number);
      const guess = Date.UTC(y, m - 1, d, h, mi);
      let stamp = guess - date.zoneOffset(guess, timeZone) * 60000;
      stamp = guess - date.zoneOffset(stamp, timeZone) * 60000;
      return new Date(stamp).toISOString();
    },
    zoneShort(timeZone) {
      return ZONES[timeZone] || String(timeZone || '').replace(/_/g, ' ');
    },
    zoneLabel(timeZone) {
      return ZONES[timeZone] ? ZONES[timeZone] + ' time' : String(timeZone || '').replace(/_/g, ' ');
    },
    /* The zone the calendar is shown in: this device's when it's in Australia, otherwise the practice's usual zone */
    viewZone(usual) {
      const local = date.localZone();
      if (ZONES[local]) return local;
      return ZONES[usual] ? usual : 'Australia/Brisbane';
    },
    /* True when a moment shows at a different clock time in the zone than on this device */
    zoneDiffers(stamp, timeZone) {
      return date.zoneOffset(stamp, timeZone) !== date.zoneOffset(stamp, date.localZone());
    }
  };

  const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
  const number = new Intl.NumberFormat('en-AU');

  const fmt = {
    date(iso) {
      const d = parse(iso);
      return d ? d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() : '';
    },
    dateLong(iso) {
      const d = parse(iso);
      return d ? DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
    },
    dateFull(iso) {
      const d = parse(iso);
      return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
    },
    dateDay(iso) {
      const d = parse(iso);
      return d ? DAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] : '';
    },
    dayName(iso) {
      const d = parse(iso);
      return d ? DAYS[d.getDay()] : '';
    },
    dayShort(iso) {
      const d = parse(iso);
      return d ? DAYS_SHORT[d.getDay()] : '';
    },
    monthYear(iso) {
      const d = parse(iso);
      return d ? MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
    },
    monthShort(iso) {
      const d = parse(iso);
      return d ? MONTHS_SHORT[d.getMonth()] : '';
    },
    time(time) {
      if (!time) return '';
      const [h, m] = time.split(':').map(Number);
      const suffix = h >= 12 ? 'pm' : 'am';
      const hour = h % 12 === 0 ? 12 : h % 12;
      return hour + ':' + pad(m) + ' ' + suffix;
    },
    timeRange(start, mins) {
      return fmt.time(start) + ' to ' + fmt.time(date.addMinutes(start, mins));
    },
    duration(mins) {
      const m = Number(mins) || 0;
      if (m < 60) return m + ' min';
      const h = Math.floor(m / 60);
      const r = m % 60;
      return h + ' hr' + (r ? ' ' + r + ' min' : '');
    },
    hours(mins) {
      const h = Math.round(((Number(mins) || 0) / 60) * 100) / 100;
      return h + (h === 1 ? ' hour' : ' hours');
    },
    money(n) {
      return money.format(Number(n) || 0);
    },
    number(n) {
      return number.format(Number(n) || 0);
    },
    percent(n) {
      return Math.round(Number(n) || 0) + '%';
    },
    stamp(stamp) {
      if (!stamp) return '';
      const d = new Date(stamp);
      return fmt.date(toISO(d)) + ', ' + fmt.time(pad(d.getHours()) + ':' + pad(d.getMinutes()));
    },
    relative(iso) {
      if (!iso) return '';
      const n = date.diffDays(date.today(), iso);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n === -1) return 'Yesterday';
      if (n > 1 && n < 14) return 'In ' + n + ' days';
      if (n < -1 && n > -14) return Math.abs(n) + ' days ago';
      if (n >= 14 && n < 60) return 'In ' + Math.round(n / 7) + ' weeks';
      if (n <= -14 && n > -60) return Math.round(Math.abs(n) / 7) + ' weeks ago';
      return fmt.date(iso);
    },
    plural(n, one, many) {
      return n + ' ' + (n === 1 ? one : many || one + 's');
    },
    initials(name) {
      return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');
    },
    age(dob) {
      if (!dob) return '';
      const d = parse(dob);
      const t = new Date();
      let a = t.getFullYear() - d.getFullYear();
      if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a -= 1;
      return a;
    },
    fileSize(bytes) {
      const b = Number(bytes) || 0;
      if (b < 1024) return b + ' bytes';
      if (b < 1048576) return Math.round(b / 1024) + ' KB';
      return (b / 1048576).toFixed(1) + ' MB';
    }
  };

  AWY.date = date;
  AWY.fmt = fmt;
})();
