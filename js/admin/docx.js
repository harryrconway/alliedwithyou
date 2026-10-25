/*
  Word files for templates made in the dashboard.

  A template is kept as a list of sections (content.blocks), and build() turns it into a
  .docx in the practice's style: A4, Arial, teal headings, shaded fill in tables, the
  chosen logo in the header and a footer with page numbers. The file is written from
  scratch each time, so it never carries anything over from an older document.

  Content:
    { v: 1, logo: null for the main logo, 'none', or a logo's id,
      footer: 'text', pageNumbers: true, watermark: true, blocks: [ ... ] }
  watermark puts a large, faint copy of the logo mark in the bottom right corner of every
  page, behind the text, running off the edges. The picture is faint itself (see
  images/watermark.png), so it looks the same in Word, Google Docs and LibreOffice.
  Blocks:
    title { text, lead }          heading { text }          subheading { text }
    text { text, guide }          bullets { items }         ticks { items }
    fields { rows: [{ label, hint }] }
    table { columns, rows: [[cell text]], labels, widths }
    box { heading, items }        space { lines }           pagebreak {}
  In text, a blank line starts a new paragraph and **words** are bold.

  Needs only AWY.zip, so the checks in tests/ can run it outside a browser too.
*/
(function () {
  const AWY = (window.AWY = window.AWY || {});

  const WIDTH = 9412;
  const TEAL = '0C5661';
  const SAGE = '9DB595';
  const GREY = '5E6664';
  const SHADE = 'EEF5EC';
  const LINE = 'CFCBC2';
  const BOX = '☐';
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const FOOTER = 'Allied With You   |   Occupational therapy   |   admin@alliedwithyou.com.au';

  const TYPES = ['title', 'heading', 'subheading', 'text', 'bullets', 'ticks', 'fields', 'table', 'box', 'space', 'pagebreak'];
  const LIMIT = { blocks: 400, text: 20000, line: 600, items: 200, rows: 200, columns: 8 };

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const DRAW_NS = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  /* Text and lists, tidied so nothing odd reaches the file */

  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max || LIMIT.line);
  const list = (v, max) => (Array.isArray(v) ? v : []).slice(0, max || LIMIT.items);

  /* Keeps only what build() understands, within sensible limits */
  function normalise(content) {
    const c = content && typeof content === 'object' ? content : {};
    const blocks = list(c.blocks, LIMIT.blocks).filter((b) => b && TYPES.includes(b.type)).map((b) => {
      switch (b.type) {
        case 'title': return { type: 'title', text: str(b.text, 160), lead: str(b.lead) };
        case 'heading':
        case 'subheading': return { type: b.type, text: str(b.text, 160) };
        case 'text': return { type: 'text', text: str(b.text, LIMIT.text), guide: !!b.guide };
        case 'bullets':
        case 'ticks': return { type: b.type, items: list(b.items).map((i) => str(i)) };
        case 'fields': return { type: 'fields', rows: list(b.rows, LIMIT.rows).map((r) => ({ label: str(r && r.label, 200), hint: str(r && r.hint, 300) })) };
        case 'table': {
          const columns = list(b.columns, LIMIT.columns).map((h) => str(h, 120));
          if (!columns.length) columns.push('');
          const rows = list(b.rows, LIMIT.rows).map((r) => columns.map((x, i) => str(Array.isArray(r) ? r[i] : '', 400)));
          const widths = list(b.widths, LIMIT.columns).map(Number);
          const fits = widths.length === columns.length && widths.every((w) => w >= 400) && widths.reduce((n, w) => n + w, 0) === WIDTH;
          return { type: 'table', columns: columns, rows: rows, labels: !!b.labels, widths: fits ? widths : null };
        }
        case 'box': return { type: 'box', heading: str(b.heading, 160), items: list(b.items).map((i) => str(i)) };
        case 'space': return { type: 'space', lines: Math.min(30, Math.max(1, Math.round(Number(b.lines) || 4))) };
        default: return { type: 'pagebreak' };
      }
    });
    return {
      v: 1,
      logo: c.logo === 'none' || (typeof c.logo === 'string' && /^[0-9a-f-]{36}$/.test(c.logo)) ? c.logo : null,
      footer: c.footer == null ? FOOTER : str(c.footer, 200),
      pageNumbers: c.pageNumbers !== false,
      watermark: c.watermark !== false,
      blocks: blocks
    };
  }

  /* WordprocessingML pieces */

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function rpr(o) {
    let p = '';
    if (o.bold) p += '<w:b/>';
    if (o.color) p += '<w:color w:val="' + o.color + '"/>';
    if (o.size) p += '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>';
    return p ? '<w:rPr>' + p + '</w:rPr>' : '';
  }

  /* One line of text as runs, with **bold** parts */
  function runs(text, o) {
    const opts = o || {};
    return String(text).split(/(\*\*[^*]+\*\*)/).filter((s) => s).map((s) => {
      const bold = /^\*\*[^*]+\*\*$/.test(s);
      const t = bold ? s.slice(2, -2) : s;
      return '<w:r>' + rpr(Object.assign({}, opts, { bold: opts.bold || bold })) + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
    }).join('');
  }

  /* Lines joined by line breaks within one paragraph */
  function lines(text, o) {
    return String(text).split('\n').map((l) => runs(l, o)).join('<w:r><w:br/></w:r>');
  }

  function para(content, o) {
    const opts = o || {};
    let p = '';
    if (opts.style) p += '<w:pStyle w:val="' + opts.style + '"/>';
    if (opts.keep) p += '<w:keepNext/>';
    if (opts.after != null || opts.before != null) {
      p += '<w:spacing' + (opts.before != null ? ' w:before="' + opts.before + '"' : '') + (opts.after != null ? ' w:after="' + opts.after + '"' : '') + '/>';
    }
    return '<w:p>' + (p ? '<w:pPr>' + p + '</w:pPr>' : '') + (content || '') + '</w:p>';
  }

  const blank = (after) => para('', { after: after == null ? 200 : after });

  function cell(width, content, shade) {
    return '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' +
      (shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + SHADE + '"/>' : '') + '</w:tcPr>' + (content || blank()) + '</w:tc>';
  }

  /* rows: [[{ content, shade }]]. headerRows repeat on each page. */
  function table(widths, rows, headerRows) {
    const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => '<w:' + side + ' w:val="single" w:sz="4" w:space="0" w:color="' + LINE + '"/>').join('');
    const grid = widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join('');
    const body = rows.map((cells, i) => '<w:tr><w:trPr><w:cantSplit/>' + (i < (headerRows || 0) ? '<w:tblHeader/>' : '') + '</w:trPr>' +
      cells.map((c, j) => cell(widths[j], c.content, c.shade)).join('') + '</w:tr>').join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="' + WIDTH + '" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>' + border +
      '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>' +
      '<w:tblGrid>' + grid + '</w:tblGrid>' + body + '</w:tbl>' + para();
  }

  /* Equal columns that add up to the page width exactly */
  function equal(n) {
    const each = Math.floor(WIDTH / n);
    return Array.from({ length: n }, (x, i) => (i === n - 1 ? WIDTH - each * (n - 1) : each));
  }

  const small = (text, o) => para(lines(text, Object.assign({ size: 19 }, o)), { after: 0 });

  function block(b) {
    switch (b.type) {
      case 'title':
        return para(runs(b.text), { style: 'Title' }) + (b.lead ? para(lines(b.lead, { color: GREY })) : '');
      case 'heading':
        return para(runs(b.text), { style: 'Heading1' });
      case 'subheading':
        return para(runs(b.text), { style: 'Heading2' });
      case 'text':
        return String(b.text).split(/\n[ \t]*\n/).filter((p) => p.trim()).map((p) =>
          b.guide ? para(lines(p.trim(), { color: GREY, size: 19 }), { after: 100, keep: true }) : para(lines(p.trim()))).join('');
      case 'bullets':
        return b.items.filter((i) => i.trim()).map((i) => para(runs(i), { style: 'ListBullet', after: 40 })).join('');
      case 'ticks': {
        const items = b.items.filter((i) => i.trim());
        return items.map((i, n) => para(runs(BOX + '  ' + i), { after: 60, keep: n < items.length - 1 })).join('');
      }
      case 'fields':
        return b.rows.length ? table([3515, 5897], b.rows.map((r) => [
          { content: para(runs(r.label, { bold: true }), { after: r.hint ? 0 : null }) + (r.hint ? para(runs(r.hint, { color: GREY, size: 17 }), { after: 0 }) : ''), shade: true },
          { content: blank() }
        ])) : '';
      case 'table': {
        const widths = b.widths || equal(b.columns.length);
        const head = b.columns.map((h) => ({ content: small(h, { bold: true }), shade: true }));
        const body = b.rows.map((r) => r.map((text, i) => {
          if (b.labels && i === 0) return { content: small(text, { bold: true }), shade: true };
          return { content: text ? small(text) : blank() };
        }));
        return table(widths, [head].concat(body), 1);
      }
      case 'box':
        return table([WIDTH], [[{
          content: (b.heading ? para(runs(b.heading, { bold: true }), { after: 60 }) : '') +
            b.items.filter((i) => i.trim()).map((i) => para(runs(i, { size: 19 }), { style: 'ListBullet', after: 40 })).join('') + para('', { after: 0 }),
          shade: true
        }]]);
      case 'space':
        return table([WIDTH], [[{ content: Array.from({ length: b.lines }, () => blank(120)).join('') }]]);
      case 'pagebreak':
        return para('<w:r><w:br w:type="page"/></w:r>');
      default:
        return '';
    }
  }

  /* The logo, sized to sit in the header like the main one: no taller than 2.47 cm, no wider than 6.67 cm */
  function logoSize(width, height) {
    const maxW = 2400000;
    const maxH = 889313;
    const aspect = width / height;
    let h = maxH;
    let w = Math.round(h * aspect);
    if (w > maxW) {
      w = maxW;
      h = Math.round(w / aspect);
    }
    return { w: w, h: h };
  }

  /* A4 in EMUs, and the faint logo: 14 cm square, about a quarter of it off the bottom right edges */
  const PAGE_W = 7560310;
  const PAGE_H = 10692130;
  const MARK = 5040000;

  function watermark(mark) {
    const x = PAGE_W - Math.round(MARK * 0.74);
    const y = PAGE_H - Math.round(MARK * 0.74);
    return '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">' +
      '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>' + x + '</wp:posOffset></wp:positionH>' +
      '<wp:positionV relativeFrom="page"><wp:posOffset>' + y + '</wp:posOffset></wp:positionV>' +
      '<wp:extent cx="' + MARK + '" cy="' + MARK + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>' +
      '<wp:docPr id="2" name="Watermark"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
      '<pic:nvPicPr><pic:cNvPr id="0" name="watermark.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + MARK + '" cy="' + MARK + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';
  }

  function header(logo, mark) {
    const behind = mark ? watermark(mark) : '';
    if (!logo) return HEAD + '<w:hdr ' + NS + (mark ? ' ' + DRAW_NS : '') + '>' + para(behind, { style: 'Header' }) + '</w:hdr>';
    const s = logoSize(logo.width, logo.height);
    const drawing = behind + '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + s.w + '" cy="' + s.h + '"/>' +
      '<wp:docPr id="1" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
      '<pic:nvPicPr><pic:cNvPr id="0" name="logo.' + logo.ext + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + s.w + '" cy="' + s.h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    return HEAD + '<w:hdr ' + NS + ' ' + DRAW_NS + '>' + para(drawing, { style: 'Header' }) + '</w:hdr>';
  }

  function field(code) {
    const f = rpr({ color: GREY, size: 16 });
    return '<w:r>' + f + '<w:fldChar w:fldCharType="begin"/></w:r><w:r>' + f + '<w:instrText xml:space="preserve"> ' + code + ' </w:instrText></w:r>' +
      '<w:r>' + f + '<w:fldChar w:fldCharType="separate"/></w:r><w:r>' + f + '<w:t>1</w:t></w:r><w:r>' + f + '<w:fldChar w:fldCharType="end"/></w:r>';
  }

  function footer(text, pageNumbers) {
    const o = { color: GREY, size: 16 };
    let content = text ? runs(text, o) : '';
    if (pageNumbers) content += runs((text ? '   |   ' : '') + 'Page ', o) + field('PAGE') + runs(' of ', o) + field('NUMPAGES');
    return HEAD + '<w:ftr ' + NS + '><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>' + content + '</w:p></w:ftr>';
  }

  function styles() {
    const heading = (id, name, level, before, after, size) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="' + before + '" w:after="' + after + '"/><w:outlineLvl w:val="' + level + '"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:color w:val="' + TEAL + '"/><w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr></w:style>';
    const plain = (id, name) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>' +
      '<w:pPr><w:tabs><w:tab w:val="center" w:pos="4706"/><w:tab w:val="right" w:pos="9412"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>';
    return HEAD + '<w:styles ' + NS + '>' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-AU" w:eastAsia="en-AU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="10"/><w:qFormat/>' +
      '<w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="' + SAGE + '"/></w:pBdr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:contextualSpacing/></w:pPr>' +
      '<w:rPr><w:b/><w:color w:val="' + TEAL + '"/><w:spacing w:val="5"/><w:kern w:val="28"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>' +
      heading('Heading1', 'heading 1', 0, 320, 0, 26) +
      heading('Heading2', 'heading 2', 1, 200, 80, 22) +
      '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>' +
      '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:contextualSpacing/></w:pPr></w:style>' +
      plain('Header', 'header') + plain('Footer', 'footer') +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>' +
      '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>';
  }

  const NUMBERING = HEAD + '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
    '<w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

  const SETTINGS = HEAD + '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    '<w:themeFontLang w:val="en-AU"/></w:settings>';

  function rels(list) {
    return HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      list.map((r) => '<Relationship Id="' + r[0] + '" Type="' + r[1] + '" Target="' + r[2] + '"/>').join('') + '</Relationships>';
  }

  const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships/';

  function types(images) {
    const doc = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
    const over = [
      ['/word/document.xml', doc + 'document.main+xml'],
      ['/word/styles.xml', doc + 'styles+xml'],
      ['/word/numbering.xml', doc + 'numbering+xml'],
      ['/word/settings.xml', doc + 'settings+xml'],
      ['/word/header1.xml', doc + 'header+xml'],
      ['/word/footer1.xml', doc + 'footer+xml'],
      ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
      ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml']
    ];
    return HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      Array.from(new Set(images)).map((ext) => '<Default Extension="' + ext + '" ContentType="image/' + ext + '"/>').join('') +
      over.map((o) => '<Override PartName="' + o[0] + '" ContentType="' + o[1] + '"/>').join('') + '</Types>';
  }

  function core(title, created) {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + esc(title) + '</dc:title><dc:creator>Allied With You</dc:creator><cp:lastModifiedBy>Allied With You</cp:lastModifiedBy>' +
      '<dc:language>en-AU</dc:language>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + (created || now) + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
  }

  const APP = HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
    '<Company>Allied With You</Company><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><LinksUpToDate>false</LinksUpToDate>' +
    '<SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged></Properties>';

  /*
    The parts of the Word file, as [{ name, data }] for AWY.zip.
    options: { title, created, logo: { data: Uint8Array, type: 'image/png' or 'image/jpeg', width, height } or null,
      watermark: { data: Uint8Array } for the faint logo, a PNG, or null }
  */
  function parts(content, options) {
    const c = normalise(content);
    const o = options || {};
    const logo = o.logo && o.logo.data ? Object.assign({}, o.logo, { ext: o.logo.type === 'image/jpeg' ? 'jpeg' : 'png' }) : null;
    const mark = c.watermark && o.watermark && o.watermark.data ? o.watermark : null;
    const top = logo ? 2400 : 1134;
    const body = c.blocks.map(block).join('');
    const document = HEAD + '<w:document ' + NS + '><w:body>' + (body || para()) +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:footerReference w:type="default" r:id="rId5"/>' +
      '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' + top + '" w:right="1247" w:bottom="1134" w:left="1247" w:header="720" w:footer="567" w:gutter="0"/>' +
      '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>';
    const titleBlock = c.blocks.find((b) => b.type === 'title');
    const enc = new TextEncoder();
    const files = [
      ['[Content_Types].xml', types([logo && logo.ext, mark && 'png'].filter((x) => x))],
      ['_rels/.rels', rels([['rId1', OFFICE + 'officeDocument', 'word/document.xml'], ['rId2', PACKAGE + 'metadata/core-properties', 'docProps/core.xml'], ['rId3', OFFICE + 'extended-properties', 'docProps/app.xml']])],
      ['docProps/core.xml', core(o.title || (titleBlock && titleBlock.text) || 'Template', o.created)],
      ['docProps/app.xml', APP],
      ['word/document.xml', document],
      ['word/styles.xml', styles()],
      ['word/numbering.xml', NUMBERING],
      ['word/settings.xml', SETTINGS],
      ['word/header1.xml', header(logo, mark)],
      ['word/footer1.xml', footer(c.footer, c.pageNumbers)],
      ['word/_rels/document.xml.rels', rels([['rId1', OFFICE + 'styles', 'styles.xml'], ['rId2', OFFICE + 'numbering', 'numbering.xml'], ['rId3', OFFICE + 'settings', 'settings.xml'], ['rId4', OFFICE + 'header', 'header1.xml'], ['rId5', OFFICE + 'footer', 'footer1.xml']])]
    ].map((f) => ({ name: f[0], data: enc.encode(f[1]) }));
    const pictures = [];
    if (logo) pictures.push(['rId1', OFFICE + 'image', 'media/logo.' + logo.ext]);
    if (mark) pictures.push(['rId2', OFFICE + 'image', 'media/watermark.png']);
    if (pictures.length) files.push({ name: 'word/_rels/header1.xml.rels', data: enc.encode(rels(pictures)) });
    if (logo) files.push({ name: 'word/media/logo.' + logo.ext, data: logo.data });
    if (mark) files.push({ name: 'word/media/watermark.png', data: mark.data });
    return files;
  }

  /* The Word file itself */
  function build(content, options) {
    return AWY.zip(parts(content, options), MIME);
  }

  AWY.docx = { build: build, parts: parts, normalise: normalise, TYPES: TYPES, MIME: MIME, FOOTER: FOOTER, WIDTH: WIDTH };
})();
