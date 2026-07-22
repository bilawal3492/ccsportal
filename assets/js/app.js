/* Centre CCS Portal: standalone React admin (React 18 + htm, no build step).
 * Managers: Dashboard + Saved estimates (scoped).
 * Super admins: also Centres & fees, Promotions, Brands, Users, full CRUD.
 * All data via the WordPress REST API, scoped server-side by role. */
(function () {
	'use strict';
	var CFG = window.CCSP_APP || {};
	var ASSETS = CFG.assets || '';
	var React = window.React, ReactDOM = window.ReactDOM;
	if (!React || !ReactDOM || !window.htm) { return; }
	var html = window.htm.bind(React.createElement);
	var useState = React.useState, useEffect = React.useEffect, useCallback = React.useCallback;

	function money(n) { return '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
	/** Today's date as YYYY-MM-DD (local time), used to cap DOB inputs so no future dates. */
	function todayISO() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
	function api(path, opts) {
		opts = opts || {};
		return fetch(CFG.root + path, {
			method: opts.method || 'GET', credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
			body: opts.body ? JSON.stringify(opts.body) : undefined
		}).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }, function () { return { ok: r.ok, status: r.status, body: null }; }); });
	}
	var STC = { new: 'st-new', contacted: 'st-contacted', enrolled: 'st-enrolled', lost: 'st-lost' };
	var F = React.Fragment;
	function Icon(p) {
		var n = p.name, inner = null;
		if (n === 'dashboard') { inner = html`<${F}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><//>`; }
		else if (n === 'estimates') { inner = html`<${F}><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 13h6M9 17h4"/><//>`; }
		else if (n === 'centres') { inner = html`<${F}><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><//>`; }
		else if (n === 'promotions') { inner = html`<${F}><path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h8l8.6 8.6a1.4 1.4 0 0 1 0 1.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/><//>`; }
		else if (n === 'brands') { inner = html`<${F}><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/><path d="M12 21a3 3 0 0 0 0-6 2 2 0 0 1-2-2 2 2 0 0 0-4 0"/><//>`; }
		else if (n === 'users') { inner = html`<${F}><circle cx="9" cy="8" r="3.5"/><path d="M3 21a6 6 0 0 1 12 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 21a6 6 0 0 0-3-5.2"/><//>`; }
		else if (n === 'doc') { inner = html`<${F}><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><//>`; }
		else if (n === 'check') { inner = html`<path d="M20 6 9 17l-5-5"/>`; }
		else if (n === 'percent') { inner = html`<${F}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><//>`; }
		else if (n === 'dollar') { inner = html`<${F}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><//>`; }
		else if (n === 'plus') { inner = html`<${F}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/><//>`; }
		else if (n === 'testing') { inner = html`<${F}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/><//>`; }
		else if (n === 'feedback') { inner = html`<${F}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/><//>`; }
		else if (n === 'log') { inner = html`<${F}><path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><line x1="7" y1="9" x2="16" y2="9"/><line x1="7" y1="13" x2="16" y2="13"/><line x1="7" y1="17" x2="12" y2="17"/><//>`; }
		else if (n === 'menu') { inner = html`<${F}><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/><//>`; }
		else if (n === 'settings') { inner = html`<${F}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/><//>`; }
		return html`<svg width=${p.size || 18} height=${p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">${inner}</svg>`;
	}
	/* The i9 brand symbol (extracted from the i9 Education logo). Inherits colour
	   via currentColor, so it sits on the dark sidebar or a coloured chip. */
	function I9Mark(p) {
		return html`<svg height=${p.h || 22} viewBox="0 0 94 179" fill="currentColor" aria-hidden="true" style=${{ display: 'block' }}>
			<path d="M34.87 100.02C33.37 98.86 31.98 97.47 30.75 95.77C26.84 90.38 24.89 83.2 24.89 74.21C24.89 66.33 26.77 59.61 30.52 54.04C31.87 52.04 33.32 50.42 34.86 49.14V39.7C26.44 41.27 19.14 44.82 12.94 50.37C4.32 58.1 0 67.81 0 79.5C0 89.7 3.4 98.26 10.21 105.18C16.87 111.95 25.09 115.39 34.86 115.53V100.01L34.87 100.02Z"/>
			<path d="M80.47 53.43C73.5 45.85 64.88 41.24 54.66 39.53V49.51C56.76 51.27 58.64 53.62 60.27 56.58C64.29 63.86 66.3 73.66 66.3 85.99C66.3 89.26 66 92.67 65.4 96.24C61.95 99.18 58.36 101.25 54.65 102.48V111.89C57.7 110.82 60.82 109.53 64.06 107.96C62.42 126.75 56.89 142.15 47.48 154.15C38.07 166.15 25.66 173.42 10.25 175.95V178.97C25.35 178.97 39.29 175.05 52.05 167.19C64.81 159.34 74.99 148.53 82.58 134.75C90.17 120.98 93.96 106.58 93.96 91.54C93.96 75.91 89.46 63.2 80.46 53.42"/>
			<path d="M58.06 13.46C58.06 20.93 51.78 26.91 44.61 26.91C37.44 26.91 31.16 20.93 31.16 13.46C31.16 5.99 37.43 0 44.61 0C51.79 0 58.06 5.98 58.06 13.46Z"/>
		</svg>`;
	}
	/* The full i9 Education logo (image asset). Light/dark variants swap via CSS. */
	function Logo(p) {
		return html`<span class=${'i9logo' + (p.className ? ' ' + p.className : '')}>
			<img class="i9logo-light" src=${ASSETS + 'img/i9-education-black-logo.svg'} alt="i9 Education" />
			<img class="i9logo-dark" src=${ASSETS + 'img/i9-education-white-logo.svg'} alt="i9 Education" />
		</span>`;
	}
	/* Branded, centred loading state used everywhere: the i9 mark with a label under it. */
	function Loader(p) {
		return html`<div class="loader"><span class="loader-mark"><${I9Mark} h=${42} /></span><span class="loader-txt">${p.label || 'Loading…'}</span></div>`;
	}
	var SECTION_TITLE = { dashboard: 'Dashboard', calculator: 'New calculation', estimates: 'Saved estimates', detail: 'Estimate', centres: 'Centres & fees', promotions: 'Promotions', brands: 'Brands', users: 'Users', log: 'Activity log', testing: 'Testing scenarios', feedback: 'Feedback', settings: 'Settings' };

	/* ---------------- Form primitives ---------------- */
	function Text(p) {
		return html`<label class=${'f' + (p.wide ? ' wide' : '')}><span>${p.label}${p.req ? html`<i class="req">*</i>` : null}</span>
			<input type=${p.type || 'text'} value=${p.value == null ? '' : p.value} placeholder=${p.placeholder || ''}
				min=${p.min} max=${p.max} step=${p.step} readOnly=${p.readOnly}
				onInput=${function (e) { p.onChange(e.target.value); }} /></label>`;
	}
	function Sel(p) {
		return html`<label class=${'f' + (p.wide ? ' wide' : '')}><span>${p.label}${p.req ? html`<i class="req">*</i>` : null}</span>
			<select value=${p.value == null ? '' : String(p.value)} onChange=${function (e) { p.onChange(e.target.value); }}>
				${p.options.map(function (o) { return html`<option key=${o[0]} value=${String(o[0])}>${o[1]}</option>`; })}
			</select></label>`;
	}
	function Area(p) {
		return html`<label class="f wide"><span>${p.label}</span>
			<textarea rows=${p.rows || 4} value=${p.value == null ? '' : p.value} placeholder=${p.placeholder || ''}
				onInput=${function (e) { p.onChange(e.target.value); }}></textarea></label>`;
	}
	function Checks(p) {
		return html`<div class="checks">${p.items.map(function (it) {
			var on = p.value.indexOf(it.id) !== -1;
			return html`<label key=${it.id} class="chk"><input type="checkbox" checked=${on}
				onChange=${function () { p.onChange(on ? p.value.filter(function (x) { return x !== it.id; }) : p.value.concat([it.id])); }} /> ${it.label}</label>`;
		})}</div>`;
	}
	function Actions(p) {
		return html`<div class="formactions">
			<button class="btn primary" disabled=${p.saving} onClick=${p.onSave}>${p.saving ? 'Saving…' : (p.saveLabel || 'Save')}</button>
			<button class="btn" onClick=${p.onCancel}>Cancel</button>
			${p.onDelete ? html`<button class="btn danger" onClick=${p.onDelete}>${p.deleteLabel || 'Delete'}</button>` : null}
			${p.error ? html`<span class="formerr">${p.error}</span>` : null}
		</div>`;
	}

	/* ---------------- Dashboard ---------------- */
	function Donut(p) {
		var segs = p.segments, size = p.size || 168, sw = p.stroke || 22;
		var r = (size - sw) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
		var total = segs.reduce(function (s, x) { return s + x.value; }, 0);
		var off = 0;
		return html`<svg width=${size} height=${size} viewBox=${'0 0 ' + size + ' ' + size} class="donut">
			<circle cx=${cx} cy=${cy} r=${r} fill="none" stroke="var(--sunken)" strokeWidth=${sw} />
			${total > 0 ? segs.filter(function (s) { return s.value > 0; }).map(function (s, i) {
				var dash = s.value / total * C;
				var el = html`<circle key=${i} cx=${cx} cy=${cy} r=${r} fill="none" stroke=${s.color} strokeWidth=${sw}
					strokeDasharray=${dash + ' ' + (C - dash)} strokeDashoffset=${-off} transform=${'rotate(-90 ' + cx + ' ' + cy + ')'} />`;
				off += dash; return el;
			}) : null}
			<text x=${cx} y=${cy - 2} textAnchor="middle" class="donut-n">${p.center}</text>
			<text x=${cx} y=${cy + 16} textAnchor="middle" class="donut-l">${p.centerSub}</text>
		</svg>`;
	}
	function Dashboard(props) {
		var s = useState(null), data = s[0], setData = s[1];
		useEffect(function () { api('reports/summary').then(function (r) { setData(r.body); }); }, []);
		if (!data) { return html`<${Loader} label="Loading dashboard…" />`; }
		var c = data.counts || {};
		var STLABEL = { new: 'New', contacted: 'Contacted', enrolled: 'Enrolled', lost: 'Lost' };
		var STVAR = { new: 'var(--new)', contacted: 'var(--contacted)', enrolled: 'var(--enrolled)', lost: 'var(--lost)' };
		var segs = ['new', 'contacted', 'enrolled', 'lost'].map(function (k) { return { k: k, label: STLABEL[k], value: c[k] || 0, color: STVAR[k] }; });
		var trend = data.trend || [];
		var maxT = Math.max.apply(null, trend.map(function (t) { return t.total; }).concat([1]));
		return html`<div>
			<div class="page-head"><h1 class="page-h">Dashboard</h1>
				${props.onStartTour ? html`<button class="btn sm" onClick=${props.onStartTour}>How it works</button>` : null}</div>
			<div class="kpi-row">
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Estimates</span><span class="kpi-ic ic-blue"><${Icon} name="doc" /></span></div><span class="kpi-n">${data.total}</span><span class="kpi-sub">total leads saved</span></div>
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Enrolled</span><span class="kpi-ic ic-green"><${Icon} name="check" /></span></div><span class="kpi-n">${c.enrolled || 0}</span><span class="kpi-sub">${data.total ? Math.round((c.enrolled || 0) / data.total * 100) : 0}% of leads</span></div>
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Conversion</span><span class="kpi-ic ic-amber"><${Icon} name="percent" /></span></div><span class="kpi-n">${data.conversion}%</span><span class="kpi-sub">leads → enrolled</span></div>
				<div class="kpi kpi-accent"><div class="kpi-top"><span class="kpi-l">Enrolled annual fees</span><span class="kpi-ic ic-violet"><${Icon} name="dollar" /></span></div><span class="kpi-n">${money(data.enrolled_annual_fees || 0)}</span><span class="kpi-sub">from ${c.enrolled || 0} enrolled famil${(c.enrolled || 0) === 1 ? 'y' : 'ies'}</span></div>
			</div>
			<div class="grid2">
				<div class="card"><h3>Lead pipeline</h3>
					<div class="pipe-chart">
						<${Donut} segments=${segs} center=${data.total} centerSub="leads" />
						<div class="pipe-legend">${segs.map(function (sg) {
							var pctv = data.total ? Math.round(sg.value / data.total * 100) : 0;
							return html`<div class="leg-row" key=${sg.k}><span class="dot" style=${{ background: sg.color }}></span><span class="leg-lab">${sg.label}</span><span class="leg-n">${sg.value}</span><span class="leg-pct">${pctv}%</span></div>`;
						})}</div>
					</div>
				</div>
				<div class="card"><h3>Leads over time <span class="h3-note">last 6 months</span></h3>
					${trend.length === 0 ? html`<p class="muted">No data yet.</p>` : html`<${F}>
						<div class="trend">${trend.map(function (t, i) {
							return html`<div class="trend-col" key=${i}>
								<div class="trend-track"><div class="trend-bar" style=${{ height: Math.round(t.total / maxT * 100) + '%' }} title=${t.total + ' leads · ' + t.enrolled + ' enrolled'}>
									${t.total > 0 && t.enrolled > 0 ? html`<div class="trend-en" style=${{ height: Math.round(t.enrolled / t.total * 100) + '%' }}></div>` : null}
								</div></div>
								<span class="trend-v">${t.total}</span><span class="trend-x">${t.label}</span>
							</div>`;
						})}</div>
						<div class="trend-legend"><span class="leg-row"><span class="dot" style=${{ background: 'var(--brand-blue)' }}></span> Leads</span><span class="leg-row"><span class="dot" style=${{ background: 'var(--enrolled)' }}></span> Enrolled</span></div>
					<//>`}
				</div>
			</div>
			<div class="grid2">
				<div class="card"><h3>Projected annual fees</h3>
					<div class="rev-main">${money(data.enrolled_annual_fees || 0)}<span>from enrolled families</span></div>
					<div class="rev-row"><span>Full pipeline potential</span><b>${money(data.annual_fees || 0)}</b></div>
					<div class="rev-row"><span>Enrolled weekly fees</span><b>${money(data.enrolled_weekly_fees || 0)}</b></div>
				</div>
				<div class="card"><h3>Promotions used</h3>
					${(data.promotions_used && data.promotions_used.length)
						? data.promotions_used.map(function (p, i) { return html`<div class="pipe-row" key=${i}><span class="pipe-lab">${p.name}</span><span class="pipe-n">${p.count}</span></div>`; })
						: html`<p class="muted">No promotions applied yet.</p>`}
				</div>
			</div>
		</div>`;
	}

	/* ---------------- Estimates ---------------- */
	function Estimates(props) {
		var st = useState([]), rows = st[0], setRows = st[1];
		var fs = useState('all'), filter = fs[0], setFilter = fs[1];
		var qs = useState(''), q = qs[0], setQ = qs[1];
		var ls = useState(true), loading = ls[0], setLoading = ls[1];
		var load = useCallback(function () {
			setLoading(true);
			api('estimates?status=' + filter + (q ? '&search=' + encodeURIComponent(q) : '')).then(function (r) { setRows((r.body && r.body.estimates) || []); setLoading(false); });
		}, [filter, q]);
		useEffect(function () { load(); }, [filter]);
		return html`<div>
			<h1 class="page-h">Saved estimates</h1>
			<div class="toolbar">
				<div class="tabs">${['all', 'new', 'contacted', 'enrolled', 'lost'].map(function (k) {
					return html`<button key=${k} class=${'tab' + (filter === k ? ' active' : '')} onClick=${function () { setFilter(k); }}>${k}</button>`;
				})}</div>
				<div class="search"><input placeholder="Search name or email" value=${q} onInput=${function (e) { setQ(e.target.value); }}
					onKeyDown=${function (e) { if (e.key === 'Enter') { load(); } }} /><button class="btn" onClick=${load}>Search</button></div>
			</div>
			${loading ? html`<${Loader} label="Loading…" />` : html`<div class="tablewrap"><table class="tbl">
				<thead><tr><th>Family</th><th>Centre</th><th>CCS</th><th class="num">Weekly gap</th><th>Status</th><th>Date</th></tr></thead>
				<tbody>${rows.length === 0 ? html`<tr><td colspan="6" class="empty">No estimates found.</td></tr>` : rows.map(function (r) {
					return html`<tr key=${r.id} class="rowlink" onClick=${function () { props.onOpen(r.id); }}>
						<td><strong>${r.parent_name || '-'}</strong><br/><span class="muted">${r.parent_email || ''}</span></td>
						<td>${r.centre || '-'}</td><td>${r.ccs_pct}%</td><td class="num">${money(r.weekly_gap)}</td>
						<td><span class=${'badge ' + (STC[r.status] || '')}>${r.status}</span></td>
						<td class="muted">${(r.created_at || '').substring(0, 10)}</td></tr>`;
				})}</tbody></table></div>`}
		</div>`;
	}
	function Detail(props) {
		var s = useState(null), d = s[0], setD = s[1];
		var ss = useState(''), saving = ss[0], setSaving = ss[1];
		var ps = useState('fortnight'), per = ps[0], setPer = ps[1];
		useEffect(function () { api('estimates/' + props.id).then(function (r) { setD(r.body); if (r.body && r.body.results && r.body.results.period) { setPer(r.body.results.period); } }); }, [props.id]);
		if (!d) { return html`<${Loader} label="Loading…" />`; }
		var res = d.results || {}, inp = d.inputs || {}, tf = res.totals_fortnight || {}, ccs = res.ccs || {};
		var kids = res.children || [], inKids = inp.children || [];
		var promo = res.promo || null, cmp = res.compare || {}, byDays = cmp.by_days || [];

		/* Period scaling from the stored per-fortnight totals. */
		var PMULT = { week: 0.5, fortnight: 1, month: 26 / 12, year: 26 };
		var PSUF = { week: '/wk', fortnight: '/fortnight', month: '/mo', year: '/yr' };
		var PLBL = { week: 'Per week', fortnight: 'Per fortnight', month: 'Per month', year: 'Per year' };
		var m = PMULT[per] || 1, suf = PSUF[per] || '';
		function sc(n) { return (n || 0) * m; }
		var promoSave = (promo && promo.ongoing) ? (promo.weekly_saving / 0.5 * m) : 0;
		var netGap = Math.max(0, sc(tf.gap) - promoSave);

		function setStatus(v) { setSaving(v); api('estimates/' + d.id + '/status', { method: 'POST', body: { status: v } }).then(function () { setD(Object.assign({}, d, { status: v })); setSaving(''); }); }

		var name = d.parent_name || 'Estimate #' + d.id;
		var initial = (name.trim().charAt(0) || '?').toUpperCase();
		var ccsStatusTxt = inp.not_eligible ? 'Not eligible for CCS' : (inp.knows_ccs ? 'Known CCS % (entered)' : 'Estimated from income');
		var enrolTxt = ({ new: 'New enrolment', existing: 'Existing family', other: 'With another provider' })[inp.enrol_status] || '-';
		var higher = ccs.higher_pct > ccs.standard_pct;
		/* Attendance days selected in the estimate (max across children), for row highlight. */
		var selDays = kids.length ? Math.max.apply(null, kids.map(function (c) { return Math.max(c.daysWeek1 || 0, c.daysWeek2 || 0); })) : 0;

		return html`<div class="lead">
			<div class="lead-topbar">
				<button class="link" onClick=${props.onBack}>← Back to estimates</button>
				<button class="btn sm" onClick=${props.onEdit}>Edit estimate</button>
			</div>

			<div class="lead-hero">
				<div class="lead-id">
					<div class=${'lead-av ' + (STC[d.status] || '')}>${initial}</div>
					<div class="lead-id-txt">
						<h1 class="lead-name">${name}</h1>
						<div class="lead-sub">
							<span class=${'badge ' + (STC[d.status] || '')}>${d.status}</span>
							<span class="lead-dot">•</span><span>${d.centre || 'No centre'}</span>
							<span class="lead-dot">•</span><span class="muted">Lead #${d.id}</span>
							<span class="lead-dot">•</span><span class="muted">${(d.created_at || '').substring(0, 16)}</span>
						</div>
					</div>
				</div>
				<label class="lead-per"><span>View</span>
					<select class="calc-period" value=${per} onChange=${function (e) { setPer(e.target.value); }}>
						${['week', 'fortnight', 'month', 'year'].map(function (k) { return html`<option key=${k} value=${k}>${PLBL[k]}</option>`; })}
					</select>
				</label>
			</div>

			<div class="lead-kpis">
				<div class="lead-kpi"><span class="lead-kpi-l">Gross fee${suf}</span><span class="lead-kpi-n">${money(sc(tf.fee))}</span></div>
				<div class="lead-kpi"><span class="lead-kpi-l">Government pays${suf}</span><span class="lead-kpi-n good">${money(sc(tf.subsidy))}</span></div>
				<div class="lead-kpi hi"><span class="lead-kpi-l">Out of pocket${suf}</span><span class="lead-kpi-n">${money(netGap)}</span></div>
				<div class="lead-kpi"><span class="lead-kpi-l">CCS rate</span><span class="lead-kpi-n">${ccs.standard_pct != null ? ccs.standard_pct + '%' : d.ccs_pct + '%'}</span></div>
			</div>

			<div class="grid2">
				<div class="card"><h3><${Icon} name="users" size=${15} /> Family & enrolment</h3><dl class="dl">
					<div><dt>Parent name</dt><dd>${d.parent_name || '-'}</dd></div>
					<div><dt>Email</dt><dd>${d.parent_email ? html`<a class="lead-link" href=${'mailto:' + d.parent_email}>${d.parent_email}</a>` : '-'}</dd></div>
					<div><dt>Phone</dt><dd>${d.parent_phone ? html`<a class="lead-link" href=${'tel:' + d.parent_phone}>${d.parent_phone}</a>` : '-'}</dd></div>
					<div><dt>Centre</dt><dd>${d.centre || '-'}</dd></div>
					<div><dt>Enrolment status</dt><dd>${enrolTxt}</dd></div>
					<div><dt>Preferred start</dt><dd>${inp.start_date || 'Not set'}</dd></div>
					<div><dt>Created</dt><dd>${(d.created_at || '').substring(0, 16)}</dd></div>
				</dl></div>

				<div class="card"><h3><${Icon} name="percent" size=${15} /> Subsidy details</h3><dl class="dl">
					<div><dt>CCS basis</dt><dd>${ccsStatusTxt}</dd></div>
					<div><dt>Combined family income</dt><dd>${money(d.income)}</dd></div>
					<div><dt>Standard CCS %</dt><dd>${ccs.standard_pct != null ? ccs.standard_pct + '%' : d.ccs_pct + '%'}</dd></div>
					${higher ? html`<div><dt>Higher CCS % (younger child)</dt><dd class="good">${ccs.higher_pct}%</dd></div>` : null}
					<div><dt>Subsidised hours / fortnight</dt><dd>${ccs.hours_per_fortnight != null ? ccs.hours_per_fortnight + ' hrs' : '-'}</dd></div>
					${inp.activity_hours != null && inp.activity_hours !== '' ? html`<div><dt>Eligible hours (entered)</dt><dd>${inp.activity_hours} hrs</dd></div>` : null}
					<div><dt>CCS withholding</dt><dd>${inp.withholding != null ? inp.withholding + '%' : '5%'}</dd></div>
					<div><dt>First Nations loading</dt><dd>${inp.is_atsi ? 'Yes' : 'No'}</dd></div>
				</dl></div>
			</div>

			<div class="grid2">
				<div class="card"><h3><${Icon} name="dollar" size=${15} /> Estimate breakdown <span class="lead-h-note">${PLBL[per]}</span></h3>
					<div class="lead-fig"><span class="l">Gross fee</span><span class="v">${money(sc(tf.fee))}</span></div>
					<div class="lead-fig sub"><span class="l">CCS subsidy (before withholding)</span><span class="v good">−${money(sc(tf.subsidy_full))}</span></div>
					<div class="lead-fig sub"><span class="l">Withholding held back (5%)</span><span class="v">+${money(sc(tf.withholding))}</span></div>
					<div class="lead-fig"><span class="l">Government pays now</span><span class="v good">−${money(sc(tf.subsidy))}</span></div>
					${promoSave > 0 ? html`<div class="lead-fig"><span class="l">Promotion saving</span><span class="v good">−${money(promoSave)}</span></div>` : null}
					<div class="lead-fig total"><span class="l">Out of pocket</span><span class="v">${money(netGap)}</span></div>
					<p class="muted mini" style=${{ marginTop: '10px' }}>Estimate only. Final CCS entitlement is determined by Services Australia.</p>
				</div>

				<div class="lead-side">
					${promo ? html`<div class="card lead-promo"><h3><${Icon} name="promotions" size=${15} /> Promotion applied</h3>
						<strong class="lead-promo-name">${promo.name}</strong>
						${promo.description ? html`<p class="muted mini" style=${{ marginTop: '4px' }}>${promo.description}</p>` : null}
						<div class="lead-promo-figs">
							${promo.total_value ? html`<div><span>Total offer value</span><b class="good">${money(promo.total_value)}</b></div>` : null}
							${promo.ongoing ? html`<div><span>Ongoing saving / week</span><b class="good">${money(promo.weekly_saving)}</b></div>` : null}
							${promo.oneoff ? html`<div><span>One-off saving</span><b class="good">${money(promo.oneoff)}</b></div>` : null}
						</div>
					</div>` : null}

					<div class="card"><h3><${Icon} name="check" size=${15} /> Lead status</h3>
						<div class="statusbtns">${['new', 'contacted', 'enrolled', 'lost'].map(function (k) {
							return html`<button key=${k} disabled=${saving === k} class=${'sbtn' + (d.status === k ? ' active ' + STC[k] : '')} onClick=${function () { setStatus(k); }}>${k}</button>`;
						})}</div>
						<div class="lead-actions">
							${d.parent_email ? html`<a class="btn" href=${'mailto:' + d.parent_email}>Email family</a>` : null}
							${d.parent_phone ? html`<a class="btn" href=${'tel:' + d.parent_phone}>Call</a>` : null}
						</div>
					</div>
				</div>
			</div>

			${kids.length ? html`<div class="card"><h3><${Icon} name="users" size=${15} /> Children (${kids.length})</h3>
				<div class="lead-kids">${kids.map(function (c, i) {
					var ik = inKids[i] || {}, days = (c.daysWeek1 || 0) + (c.daysWeek2 || 0);
					return html`<div class="lead-kid" key=${i}>
						<div class="lead-kid-head">
							<strong>Child ${i + 1}</strong>
							<span class="muted">${ik.dob ? ik.dob + ' · ' : ''}${c.age}y old</span>
							${c.sibling ? html`<span class="cc-chip ghost">Sibling</span>` : null}
						</div>
						<div class="cc-chips lead-kid-chips">
							<span class="cc-chip">${days} days/ftn</span>
							<span class="cc-chip">${c.hoursPerDay}h/day</span>
							<span class=${'cc-chip pct' + (c.isHigher ? ' higher' : '')}>${c.ccs_pct}% CCS${c.isHigher ? ' (higher)' : ''}</span>
							<span class="cc-chip">${money(c.feePerDay)}/day</span>
						</div>
						<div class="lead-kid-grid">
							<div><span>Days wk 1 / wk 2</span><b>${c.daysWeek1} / ${c.daysWeek2}</b></div>
							<div><span>Session hours / day</span><b>${c.hoursPerDay}h</b></div>
							<div><span>Daily fee</span><b>${money(c.feePerDay)}</b></div>
							<div><span>Hourly fee</span><b>${money(c.hourlyFee)}</b></div>
							<div><span>Hourly cap</span><b>${money(c.hourlyCap)}</b></div>
							<div><span>Rate CCS applies to</span><b>${money(c.effRate)}/hr</b></div>
							<div><span>Gross fee / ftn</span><b>${money(c.fortnightFee)}</b></div>
							<div><span>Subsidy / ftn</span><b class="good">${money(c.fortnightSub)}</b></div>
							<div><span>Withholding / ftn</span><b>${money(c.withholding)}</b></div>
							<div><span>Out of pocket / ftn</span><b>${money(c.gap)}</b></div>
						</div>
					</div>`;
				})}</div>
			</div>` : null}

			${byDays.length ? html`<div class="card"><h3><${Icon} name="doc" size=${15} /> Attendance package comparison <span class="lead-h-note">per week</span></h3>
				<div class="tablewrap"><table class="cmp-tbl cmp-wide">
					<thead><tr><th>Days / week</th><th class="r">Daily rate</th><th class="r">Full fee / wk</th><th class="r">Govt pays</th><th class="r">Family pays / wk</th></tr></thead>
					<tbody>${byDays.map(function (r) {
						var rate = r.days ? r.weekly_fee / r.days : 0, govt = r.weekly_fee - r.weekly_gap, cur = r.days === selDays;
						return html`<tr key=${r.days} class=${cur ? 'lead-cur' : ''}>
							<td><strong>${r.days} ${r.days === 1 ? 'day' : 'days'}</strong>${cur ? html`<span class="rbadge best">This lead</span>` : null}</td>
							<td class="r">${money(rate)}</td>
							<td class="r">${money(r.weekly_fee)}</td>
							<td class="r good">−${money(govt)}</td>
							<td class="r"><strong>${money(r.weekly_gap)}</strong></td>
						</tr>`;
					})}</tbody>
				</table></div>
			</div>` : null}
		</div>`;
	}

	/* ---------------- Centres & fees ---------------- */
	function CentresView(props) {
		var caps = props.caps || {};
		var canEdit = !!(caps.manage_fees), canAdd = !!(caps.manage_portal);
		var s = useState(null), data = s[0], setData = s[1];
		var es = useState(null), editing = es[0], setEditing = es[1]; // id | 'new' | null
		var srt = useState({ key: null, dir: 'asc' }), sort = srt[0], setSort = srt[1];
		var bfS = useState(''), brandFilter = bfS[0], setBrandFilter = bfS[1];
		var load = useCallback(function () { api('admin/centres').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<${Loader} label="Loading centres…" />`; }
		if (editing !== null) {
			return html`<${CentreForm} id=${editing === 'new' ? null : editing} brands=${data.brands}
				onSaved=${function (b) { setData(Object.assign({}, data, { centres: b.centres })); setEditing(null); }}
				onCancel=${function () { setEditing(null); }} />`;
		}
		function feeOf(c, d) { return (c.day_fees && c.day_fees[d]) || c.full_daily_fee; }
		function val(c, key) {
			if (key === 'brand') { return c.brand_name.toLowerCase(); }
			if (key === 'name') { return c.name.toLowerCase(); }
			if (key.indexOf('day') === 0) { return feeOf(c, key.slice(3)); }
			return 0;
		}
		function toggleSort(key) {
			setSort(function (p) {
				if (p.key === key) { return { key: key, dir: p.dir === 'asc' ? 'desc' : 'asc' }; }
				// Text columns default A→Z; fee columns default high→low.
				return { key: key, dir: (key === 'brand' || key === 'name') ? 'asc' : 'desc' };
			});
		}
		function arrowEl(key) {
			var active = sort.key === key;
			return html`<span class=${'sort-ar' + (active ? ' on' : '')}>${active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>`;
		}
		var rows = data.centres.filter(function (c) { return !brandFilter || c.brand_name === brandFilter; });
		if (sort.key) {
			rows = rows.slice().sort(function (a, b) {
				var av = val(a, sort.key), bv = val(b, sort.key);
				if (av < bv) { return sort.dir === 'asc' ? -1 : 1; }
				if (av > bv) { return sort.dir === 'asc' ? 1 : -1; }
				return 0;
			});
		}
		var brandNames = data.centres.map(function (c) { return c.brand_name; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
		var brandOpts = [['', 'All brands']].concat(brandNames.map(function (b) { return [b, b]; }));
		function sortableTh(key, label, numeric) {
			return html`<th class=${(numeric ? 'num ' : '') + 'sortable' + (sort.key === key ? ' sorted' : '')} onClick=${function () { toggleSort(key); }}>${label} ${arrowEl(key)}</th>`;
		}
		return html`<div>
			<div class="page-head"><h1 class="page-h">Centres & fees</h1>
				<div class="ph-right">
					<select class="ctr-filter" value=${brandFilter} onChange=${function (e) { setBrandFilter(e.target.value); }}>
						${brandOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}
					</select>
					${canAdd ? html`<button class="btn primary" onClick=${function () { setEditing('new'); }}>+ Add centre</button>` : null}
				</div>
			</div>
			${!canEdit ? html`<p class="muted mini" style=${{ marginTop: '-8px' }}>You have view-only access to centre fees.</p>` : null}
			<div class="tablewrap"><table class="tbl">
				<thead><tr>${sortableTh('brand', 'Brand', false)}${sortableTh('name', 'Centre', false)}<th>Short</th>${sortableTh('day1', '1 day', true)}${sortableTh('day2', '2 days', true)}${sortableTh('day3', '3 days', true)}${sortableTh('day4', '4 days', true)}${sortableTh('day5', '5 days', true)}<th>Status</th><th></th></tr></thead>
				<tbody>${rows.map(function (c) {
					return html`<tr key=${c.id}>
						<td><span class="cdot" style=${{ background: c.accent }}></span>${c.brand_name}</td>
						<td>${c.name}</td><td><code>${c.code}</code></td>
						${[1, 2, 3, 4, 5].map(function (d) { return html`<td class="num" key=${d}>${money(feeOf(c, d))}</td>`; })}
						<td><span class=${'badge ' + (c.status === 'active' ? 'st-enrolled' : 'st-lost')}>${c.status}</span></td>
						<td>${canEdit ? html`<button class="btn sm" onClick=${function () { setEditing(c.id); }}>Edit</button>` : null}</td></tr>`;
				})}
				${rows.length === 0 ? html`<tr><td colspan="10" class="empty">No centres match.</td></tr>` : null}</tbody></table></div>
		</div>`;
	}
	function CentreForm(props) {
		var fs = useState(null), form = fs[0], setForm = fs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		var errs = useState(''), err = errs[0], setErr = errs[1];
		useEffect(function () {
			if (props.id) { api('admin/centres/' + props.id).then(function (r) { setForm(r.body); }); }
			else { setForm({ brand_id: props.brands[0] ? props.brands[0].id : 0, code: '', name: '', status: 'active', phone: '', email: '', address: '', book_tour_url: '', effective_from: '', day_fees: { 1: '', 2: '', 3: '', 4: '', 5: '' } }); }
		}, [props.id]);
		if (!form) { return html`<${Loader} label="Loading…" />`; }
		function up(k, v) { setForm(Object.assign({}, form, (function () { var o = {}; o[k] = v; return o; })())); }
		function dayFee(d, v) { var df = Object.assign({}, form.day_fees); df[d] = v; up('day_fees', df); }
		function save() {
			if (!form.name || !form.code) { setErr('Code and name are required.'); return; }
			setSaving(true); setErr('');
			api('admin/centres', { method: 'POST', body: form }).then(function (r) {
				setSaving(false);
				if (r.ok && r.body.ok) { props.onSaved(r.body); } else { setErr((r.body && r.body.message) || 'Save failed.'); }
			});
		}
		var brandOpts = props.brands.map(function (b) { return [b.id, b.name]; });
		return html`<div>
			<button class="link" onClick=${props.onCancel}>← Back to centres</button>
			<h1 class="page-h">${props.id ? 'Edit centre' : 'New centre'}</h1>
			<div class="card"><h3>Centre details</h3><div class="formgrid">
				<${Sel} label="Brand" value=${form.brand_id} onChange=${function (v) { up('brand_id', parseInt(v, 10)); }} options=${brandOpts} />
				<${Text} label="Code" value=${form.code} onChange=${function (v) { up('code', v); }} />
				<${Text} label="Centre name" value=${form.name} onChange=${function (v) { up('name', v); }} />
				<${Sel} label="Status" value=${form.status} onChange=${function (v) { up('status', v); }} options=${[['active', 'Active'], ['inactive', 'Inactive']]} />
				<${Text} label="Phone" value=${form.phone} onChange=${function (v) { up('phone', v); }} />
				<${Text} label="Email" type="email" value=${form.email} onChange=${function (v) { up('email', v); }} />
				<${Text} wide=${true} label="Address" value=${form.address} onChange=${function (v) { up('address', v); }} />
				<${Text} wide=${true} label="Book-a-tour URL" type="url" value=${form.book_tour_url} onChange=${function (v) { up('book_tour_url', v); }} />
			</div></div>
			<div class="card"><h3>Current fees</h3><div class="formgrid">
				<${Text} label="Effective from" type="date" value=${form.effective_from} onChange=${function (v) { up('effective_from', v); }} />
			</div>
			<h3 style=${{ marginTop: '14px' }}>Daily fee by attendance days</h3>
			<p class="muted mini" style=${{ margin: '-6px 0 12px' }}>The exact per-day fee a child pays based on how many days per week they attend.</p>
			<div class="formgrid">
				${[1, 2, 3, 4, 5].map(function (d) { return html`<${Text} key=${d} label=${d + '-day fee ($)'} type="number" step="0.01" value=${form.day_fees[d]} onChange=${function (v) { dayFee(d, v); }} />`; })}
			</div></div>
			<${Actions} saving=${saving} error=${err} onSave=${save} onCancel=${props.onCancel} />
		</div>`;
	}

	/* ---------------- Promotions ---------------- */
	function PromotionsView(props) {
		var caps = props.caps || {};
		var canEdit = !!(caps.manage_promotions);
		var s = useState(null), data = s[0], setData = s[1];
		var es = useState(null), editing = es[0], setEditing = es[1];
		var load = useCallback(function () { api('admin/promotions').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<${Loader} label="Loading promotions…" />`; }
		if (editing !== null && canEdit) {
			var current = editing === 'new' ? null : data.promotions.filter(function (p) { return p.id === editing; })[0];
			return html`<${PromotionForm} promo=${current} brands=${data.brands} centres=${data.centres} types=${data.promo_types}
				onSaved=${function (b) { setData(Object.assign({}, data, { promotions: b.promotions })); setEditing(null); }} onCancel=${function () { setEditing(null); }} />`;
		}
		return html`<div>
			<div class="page-head"><h1 class="page-h">Promotions</h1>${canEdit ? html`<button class="btn primary" onClick=${function () { setEditing('new'); }}>+ Add promotion</button>` : null}</div>
			${!canEdit ? html`<p class="muted mini" style=${{ marginTop: '-8px' }}>You have view-only access to promotions.</p>` : null}
			<div class="tablewrap"><table class="tbl">
				<thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Window</th><th>Status</th><th></th></tr></thead>
				<tbody>${data.promotions.length === 0 ? html`<tr><td colspan="6" class="empty">No promotions yet.</td></tr>` : data.promotions.map(function (p) {
					var val = p.unit === 'percent' ? p.value + '%' : p.unit === 'amount' ? money(p.value) : p.value + ' wks';
					var win = (p.start_date || '…') + ' → ' + (p.end_date || '…');
					return html`<tr key=${p.id}><td><strong>${p.name}</strong></td><td>${(data.promo_types[p.type] || p.type)}</td><td>${val}</td>
						<td class="muted">${(p.start_date || p.end_date) ? win : 'Always'}</td>
						<td><span class=${'badge ' + (p.status === 'active' ? 'st-enrolled' : 'st-lost')}>${p.status}</span></td>
						<td>${canEdit ? html`<button class="btn sm" onClick=${function () { setEditing(p.id); }}>Edit</button>` : null}</td></tr>`;
				})}</tbody></table></div>
		</div>`;
	}
	function PromotionForm(props) {
		var p = props.promo || { name: '', type: 'weeks_free', value: '', unit: 'weeks', start_date: '', end_date: '', eligibility: '', terms: '', stackable: 0, status: 'active', brand_ids: [], centre_ids: [] };
		var fs = useState(p), form = fs[0], setForm = fs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		var errs = useState(''), err = errs[0], setErr = errs[1];
		function up(k, v) { setForm(Object.assign({}, form, (function () { var o = {}; o[k] = v; return o; })())); }
		function save() {
			if (!form.name) { setErr('Name is required.'); return; }
			setSaving(true); setErr('');
			api('admin/promotions', { method: 'POST', body: Object.assign({}, form, { id: props.promo ? props.promo.id : 0 }) })
				.then(function (r) { setSaving(false); if (r.ok && r.body.ok) { props.onSaved(r.body); } else { setErr('Save failed.'); } });
		}
		function del() {
			if (!props.promo || !confirm('Delete this promotion?')) { return; }
			api('admin/promotions/' + props.promo.id, { method: 'DELETE' }).then(function (r) { if (r.ok) { props.onSaved(r.body); } });
		}
		var typeOpts = Object.keys(props.types).map(function (k) { return [k, props.types[k]]; });
		return html`<div>
			<button class="link" onClick=${props.onCancel}>← Back to promotions</button>
			<h1 class="page-h">${props.promo ? 'Edit promotion' : 'New promotion'}</h1>
			<div class="card"><h3>Offer</h3><div class="formgrid">
				<${Text} wide=${true} label="Name" value=${form.name} onChange=${function (v) { up('name', v); }} placeholder="e.g. 4 Weeks Free (Winter)" />
				<${Sel} label="Type" value=${form.type} onChange=${function (v) { up('type', v); }} options=${typeOpts} />
				<${Text} label="Value" type="number" step="0.01" value=${form.value} onChange=${function (v) { up('value', v); }} />
				<${Sel} label="How it applies" value=${form.unit} onChange=${function (v) { up('unit', v); }} options=${[['weeks', 'Weeks free (1 free / 5 weeks)'], ['percent', '% off parent gap'], ['amount', '$ off weekly gap'], ['sibling', 'Sibling discount (% off 2nd+ child fee)'], ['oneoff', 'One-off credit ($, e.g. refer a friend)']]} />
				<${Sel} label="Status" value=${form.status} onChange=${function (v) { up('status', v); }} options=${[['active', 'Active'], ['inactive', 'Inactive']]} />
				<${Text} label="Start date" type="date" value=${form.start_date} onChange=${function (v) { up('start_date', v); }} />
				<${Text} label="End date" type="date" value=${form.end_date} onChange=${function (v) { up('end_date', v); }} />
				<${Area} label="Eligibility notes (internal)" rows=${2} value=${form.eligibility} onChange=${function (v) { up('eligibility', v); }} />
				<${Area} label="Terms & conditions (shown to the family)" rows=${7} value=${form.terms} onChange=${function (v) { up('terms', v); }} />
			</div></div>
			<div class="card"><h3>Where it applies</h3><p class="muted" style=${{ marginTop: '-6px', marginBottom: '10px' }}>Leave all unticked for a group-wide offer.</p>
				<div class="grid2">
					<div><strong class="mini">Brands</strong><${Checks} value=${form.brand_ids} onChange=${function (v) { up('brand_ids', v); }} items=${props.brands.map(function (b) { return { id: b.id, label: b.name }; })} /></div>
					<div><strong class="mini">Centres</strong><div class="scrollbox"><${Checks} value=${form.centre_ids} onChange=${function (v) { up('centre_ids', v); }} items=${props.centres.map(function (c) { return { id: c.id, label: c.brand_name + ' · ' + c.name }; })} /></div></div>
				</div>
			</div>
			<${Actions} saving=${saving} error=${err} onSave=${save} onCancel=${props.onCancel} onDelete=${props.promo ? del : null} />
		</div>`;
	}

	/* ---------------- Brands ---------------- */
	function BrandsView() {
		var s = useState(null), list = s[0], setList = s[1];
		useEffect(function () { api('admin/brands').then(function (r) { setList(r.body.brands); }); }, []);
		if (!list) { return html`<${Loader} label="Loading brands…" />`; }
		return html`<div><h1 class="page-h">Brands</h1>
			${list.map(function (b) { return html`<${BrandCard} key=${b.id} brand=${b} onSaved=${function (r) { setList(r.brands); }} />`; })}
		</div>`;
	}
	function BrandCard(props) {
		var fs = useState(props.brand), form = fs[0], setForm = fs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		function up(k, v) { setForm(Object.assign({}, form, (function () { var o = {}; o[k] = v; return o; })())); }
		function save() { setSaving(true); api('admin/brands', { method: 'POST', body: form }).then(function (r) { setSaving(false); if (r.ok) { props.onSaved(r.body); } }); }
		return html`<div class="card"><h3><span class="cdot" style=${{ background: form.accent_color }}></span>${form.name} <code>${form.code}</code></h3>
			<div class="formgrid">
				<${Text} label="Name" value=${form.name} onChange=${function (v) { up('name', v); }} />
				<${Text} label="Accent colour" value=${form.accent_color} onChange=${function (v) { up('accent_color', v); }} placeholder="#df7a2c" />
				<${Text} wide=${true} label="Logo URL" type="url" value=${form.logo_url} onChange=${function (v) { up('logo_url', v); }} />
				<${Text} label="Email from name" value=${form.email_from_name} onChange=${function (v) { up('email_from_name', v); }} />
				<${Text} label="Email from address" type="email" value=${form.email_from_address} onChange=${function (v) { up('email_from_address', v); }} />
			</div>
			<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${save}>${saving ? 'Saving…' : 'Save ' + form.code}</button></div>
		</div>`;
	}

	/* ---------------- Users ---------------- */
	function genPassword() {
		var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
		var out = '';
		for (var i = 0; i < 14; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
		return out;
	}
	/* Group centres under their brand for an easy, brand-wise picker. */
	function groupCentres(centres) {
		var order = [], byBrand = {};
		centres.forEach(function (c) {
			var key = c.brand_name || 'Other';
			if (!byBrand[key]) { byBrand[key] = { brand: key, items: [] }; order.push(byBrand[key]); }
			byBrand[key].items.push({ id: c.id, label: c.code });
		});
		return order;
	}
	function BrandCentres(props) {
		var value = props.value;
		function toggle(id) { props.onChange(value.indexOf(id) !== -1 ? value.filter(function (x) { return x !== id; }) : value.concat([id])); }
		function toggleAll(ids, allOn) {
			if (allOn) { props.onChange(value.filter(function (id) { return ids.indexOf(id) === -1; })); }
			else { props.onChange(value.concat(ids.filter(function (id) { return value.indexOf(id) === -1; }))); }
		}
		return html`<div class="brandpick">${groupCentres(props.centres).map(function (g) {
			var ids = g.items.map(function (i) { return i.id; });
			var allOn = ids.length > 0 && ids.every(function (id) { return value.indexOf(id) !== -1; });
			return html`<div class="brandgrp" key=${g.brand}>
				<div class="brandgrp-h"><span>${g.brand}</span><button type="button" class="linkbtn" onClick=${function () { toggleAll(ids, allOn); }}>${allOn ? 'Clear' : 'Select all'}</button></div>
				<div class="brandgrp-items">${g.items.map(function (it) {
					var on = value.indexOf(it.id) !== -1;
					return html`<label key=${it.id} class="chk"><input type="checkbox" checked=${on} onChange=${function () { toggle(it.id); }} /> ${it.label}</label>`;
				})}</div>
			</div>`;
		})}</div>`;
	}
	function RoleRadio(props) {
		return html`<div class="rolepick">${props.roles.map(function (r) {
			return html`<label key=${r.id} class=${'rolopt' + (props.value === r.id ? ' on' : '')}>
				<input type="radio" name=${props.name} checked=${props.value === r.id} onChange=${function () { props.onChange(r.id); }} />
				<span class="rolopt-t"><span class="rolopt-l">${r.label}</span><span class="rolopt-h">${r.hint}</span></span>
			</label>`;
		})}</div>`;
	}
	function RoleBadge(props) { return html`<span class=${'rbadge ' + (props.role === 'admin' ? 'admin' : 'mgr')}>${props.label}</span>`; }

	function UsersView() {
		var s = useState(null), data = s[0], setData = s[1];
		var load = useCallback(function () { api('admin/users').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<${Loader} label="Loading users…" />`; }
		function remove(id, name) { if (confirm('Remove portal access for ' + name + '? Their WordPress account stays, but they can no longer sign in to the portal.')) { api('admin/managers/' + id, { method: 'DELETE' }).then(function (r) { if (r.ok) { setData(Object.assign({}, data, r.body)); } else { alert((r.body && r.body.message) || 'Could not remove access.'); } }); } }
		return html`<div>
			<h1 class="page-h">Users</h1>
			<div class="grid2">
				<div class="card"><h3>Portal users</h3>
					${data.users.length === 0 ? html`<p class="muted">No portal users yet.</p>` : data.users.map(function (m) {
						return html`<${UserRow} key=${m.id} m=${m} roles=${data.roles} centres=${data.centres}
							onSaved=${function (b) { setData(Object.assign({}, data, b)); }} onRemove=${function () { remove(m.id, m.name); }} />`;
					})}
				</div>
				<div><${AddUserForm} data=${data} onSaved=${function (b) { setData(Object.assign({}, data, b)); }} /></div>
			</div>
		</div>`;
	}
	function UserRow(props) {
		var m = props.m, roles = props.roles, centres = props.centres;
		var es = useState(false), open = es[0], setOpen = es[1];
		var rr = useState(m.role), role = rr[0], setRole = rr[1];
		var cs = useState(m.centre_ids), sel = cs[0], setSel = cs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		// Set-password panel state.
		var ps = useState(false), pwOpen = ps[0], setPwOpen = ps[1];
		var pv = useState(''), pw = pv[0], setPw = pv[1];
		var pb = useState(false), pwSaving = pb[0], setPwSaving = pb[1];
		var pm = useState(''), pwMsg = pm[0], setPwMsg = pm[1];
		var pe = useState(''), pwErr = pe[0], setPwErr = pe[1];
		function save() {
			setSaving(true);
			api('admin/managers', { method: 'POST', body: { user_id: m.id, role: role, centre_ids: (role === 'manager' || role === 'area') ? sel : [] } }).then(function (r) { setSaving(false); if (r.ok && r.body && r.body.ok) { setOpen(false); props.onSaved(r.body); } else { alert((r.body && r.body.message) || 'Could not save.'); } });
		}
		function togglePw() { setPwOpen(!pwOpen); setPwMsg(''); setPwErr(''); if (!pwOpen && !pw) { setPw(genPassword()); } }
		function copyPw() { if (pw && navigator.clipboard) { navigator.clipboard.writeText(pw); setPwMsg('Password copied to clipboard.'); setPwErr(''); } }
		function savePw() {
			if (pw.length < 8) { setPwErr('Password must be at least 8 characters.'); return; }
			setPwSaving(true); setPwErr(''); setPwMsg('');
			api('admin/managers/' + m.id + '/password', { method: 'POST', body: { password: pw } }).then(function (r) {
				setPwSaving(false);
				if (r.ok && r.body && r.body.ok) { setPwMsg('Password updated. Share it with ' + m.name + ' so they can sign in.'); if (r.body.users) { props.onSaved(r.body); } }
				else { setPwErr((r.body && r.body.message) || 'Could not set password.'); }
			});
		}
		var codes = m.role === 'admin' ? 'All centres' : (centres.filter(function (c) { return m.centre_ids.indexOf(c.id) !== -1; }).map(function (c) { return c.code; }).join(', ') || 'No centres');
		return html`<div class="mrow">
			<div class="mrow-top">
				<div><strong>${m.name}</strong> <${RoleBadge} role=${m.role} label=${m.role_label} />${m.is_self ? html`<span class="rbadge you">You</span>` : null}<br/><span class="muted">${m.email}</span></div>
				${m.locked ? html`<span class="muted mini">Managed in WordPress</span>` : html`<div>
					<button class="btn sm" onClick=${function () { setOpen(!open); }}>${open ? 'Close' : 'Edit'}</button> <button class="btn sm" onClick=${togglePw}>${pwOpen ? 'Close' : 'Set password'}</button> ${m.is_self ? null : html`<button class="btn sm danger" onClick=${props.onRemove}>Remove</button>`}
				</div>`}
			</div>
			<div class="muted mrow-centres">${codes}</div>
			${open && !m.locked ? html`<div class="mrow-edit">
				<strong class="mini">Role</strong>
				<${RoleRadio} name=${'role-' + m.id} roles=${roles} value=${role} onChange=${setRole} />
				${(role === 'manager' || role === 'area') ? html`<${F}><strong class="mini">Centres</strong><${BrandCentres} value=${sel} onChange=${setSel} centres=${centres} /><//>` : null}
				<div class="formactions"><button class="btn primary sm" disabled=${saving} onClick=${save}>${saving ? 'Saving…' : 'Save changes'}</button> <button class="btn sm" onClick=${function () { setOpen(false); setRole(m.role); setSel(m.centre_ids); }}>Cancel</button></div>
			</div>` : null}
			${pwOpen && !m.locked ? html`<div class="mrow-edit pw-set">
				<p class="muted mini">Set a password for this user and share it with them. No email is required.</p>
				<div class="pw-row">
					<input class="pw-input" type="text" spellcheck="false" autocomplete="off" value=${pw} placeholder="New password" onInput=${function (e) { setPw(e.target.value); }} />
					<button class="btn sm" onClick=${function () { setPw(genPassword()); setPwMsg(''); }}>Generate</button>
					<button class="btn sm" onClick=${copyPw}>Copy</button>
					<button class="btn primary sm" disabled=${pwSaving} onClick=${savePw}>${pwSaving ? 'Saving…' : 'Save password'}</button>
				</div>
				${pwMsg ? html`<span class="formok">${pwMsg}</span>` : null}
				${pwErr ? html`<span class="formerr">${pwErr}</span>` : null}
			</div>` : null}
		</div>`;
	}
	function AddUserForm(props) {
		var roles = props.data.roles;
		var mode = useState('assign'), tab = mode[0], setTab = mode[1];
		var us = useState(0), userId = us[0], setUserId = us[1];
		var rr = useState('manager'), role = rr[0], setRole = rr[1];
		var cs = useState([]), sel = cs[0], setSel = cs[1];
		var ns = useState({ name: '', email: '' }), nf = ns[0], setNf = ns[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		var errs = useState(''), err = errs[0], setErr = errs[1];
		var userOpts = [[0, 'Select a user…']].concat(props.data.assignable.map(function (u) { return [u.id, u.name + ' (' + u.email + ')']; }));
		function reset() { setUserId(0); setSel([]); setNf({ name: '', email: '' }); setErr(''); }
		function assign() {
			if (!userId) { setErr('Choose a user.'); return; }
			setSaving(true); setErr('');
			api('admin/managers', { method: 'POST', body: { user_id: userId, role: role, centre_ids: (role === 'manager' || role === 'area') ? sel : [] } }).then(function (r) { setSaving(false); if (r.ok && r.body && r.body.ok) { reset(); props.onSaved(r.body); } else { setErr((r.body && r.body.message) || 'Could not add user.'); } });
		}
		function create() {
			if (!nf.email) { setErr('Email is required.'); return; }
			setSaving(true); setErr('');
			api('admin/users/create', { method: 'POST', body: { name: nf.name, email: nf.email, role: role, centre_ids: (role === 'manager' || role === 'area') ? sel : [] } }).then(function (r) { setSaving(false); if (r.ok && r.body.ok) { reset(); props.onSaved(r.body); } else { setErr((r.body && r.body.message) || 'Could not create user.'); } });
		}
		var centrePicker = (role === 'manager' || role === 'area') ? html`<${F}><strong class="mini">Centres</strong><${BrandCentres} value=${sel} onChange=${setSel} centres=${props.data.centres} /><//>` : html`<p class="muted mini">Portal administrators have access to every centre.</p>`;
		return html`<div class="card"><h3>Add a user</h3>
			<div class="tabs mini2"><button class=${'tab' + (tab === 'assign' ? ' active' : '')} onClick=${function () { setTab('assign'); }}>Existing user</button><button class=${'tab' + (tab === 'create' ? ' active' : '')} onClick=${function () { setTab('create'); }}>New user</button></div>
			${tab === 'assign' ? html`<div>
				<${Sel} label="User" value=${userId} onChange=${function (v) { setUserId(parseInt(v, 10)); }} options=${userOpts} />
				${props.data.assignable.length === 0 ? html`<p class="muted mini">Every WordPress user already has a portal role. Use the New user tab to create one.</p>` : null}
				<strong class="mini">Role</strong><${RoleRadio} name="add-role" roles=${roles} value=${role} onChange=${setRole} />
				${centrePicker}
				<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${assign}>${saving ? 'Saving…' : 'Add user'}</button>${err ? html`<span class="formerr">${err}</span>` : null}</div>
			</div>` : html`<div>
				<${Text} label="Full name" value=${nf.name} onChange=${function (v) { setNf(Object.assign({}, nf, { name: v })); }} />
				<${Text} label="Email" type="email" value=${nf.email} onChange=${function (v) { setNf(Object.assign({}, nf, { email: v })); }} />
				<strong class="mini">Role</strong><${RoleRadio} name="new-role" roles=${roles} value=${role} onChange=${setRole} />
				${centrePicker}
				<p class="muted mini">The new user is emailed a set-password link. You can also set a password directly from their row once created.</p>
				<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${create}>${saving ? 'Creating…' : 'Create user'}</button>${err ? html`<span class="formerr">${err}</span>` : null}</div>
			</div>`}
		</div>`;
	}

	/* ---------------- Calculator ---------------- */
	function kv(k, v) { var o = {}; o[k] = v; return o; }
	function blankChild() { return { dob: '', hours_per_day: 10, fee_override: '', custom: false, days_week1: 3, days_week2: 3 }; }
	function defaultForm(id) { return { centre_id: id, knows_ccs: false, not_eligible: false, income: '', known_pct: '', activity_hours: '', withholding: 5, is_atsi: false, rate_basis: 'standard', promotion_id: 0, enrol_status: 'new', start_date: '', period: 'fortnight', parent_name: '', parent_email: '', parent_phone: '', children: [blankChild()] }; }
	/* Persist the in-progress calculation so switching tabs (or a reload) doesn't lose it. */
	var DRAFT_KEY = 'ccsp_calc_draft';
	function loadDraft() { try { var s = window.localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
	function saveDraft(v) { try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch (e) {} }
	function clearDraft() { try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
	/** Whether enough has been entered to show a meaningful estimate. */
	/** Enough to compute the CCS % (income or known %). No child info needed. */
	function pctReady(f) {
		if (f.not_eligible) { return true; }
		return f.knows_ccs ? (f.known_pct !== '' && f.known_pct != null) : (f.income !== '' && f.income != null);
	}
	/** Enough for a full estimate: CCS % plus every child's DOB, days and hours. */
	function estimateReady(f) {
		if (!pctReady(f) || !f.children.length) { return false; }
		if (!f.not_eligible && (f.activity_hours === '' || f.activity_hours == null)) { return false; }
		return f.children.every(function (c) {
			var days = (parseInt(c.days_week1, 10) || 0) + (parseInt(c.days_week2, 10) || 0);
			return c.dob && days > 0 && (parseFloat(c.hours_per_day) || 0) > 0;
		});
	}
	/** Mirror of the server fee resolver so the UI can show the auto amount. */
	function resolveFee(centre, basis, days, index) {
		if (!centre) { return 0; }
		if (basis === 'weekly') { return centre.weekly_rate; }
		if (basis === 'windback') { return centre.windback_rate; }
		if (days >= 1 && centre.tiers && centre.tiers[days] != null) { return centre.tiers[days]; }
		return centre.full_daily_fee;
	}

	function Calculator(props) {
		var editId = props.editId || 0;
		var cs = useState(null), centres = cs[0], setCentres = cs[1];
		var fst = useState(null), f = fst[0], setF = fst[1];
		var rs = useState(null), res = rs[0], setRes = rs[1];
		var msgS = useState(''), saveMsg = msgS[0], setSaveMsg = msgS[1];
		var savS = useState(false), saving = savS[0], setSaving = savS[1];
		var ocS = useState(0), openIdx = ocS[0], setOpenIdx = ocS[1];

		useEffect(function () {
			api('calc/centres').then(function (r) {
				var list = (r.body && r.body.centres) || [];
				setCentres(list);
				if (!list.length) { return; }
				if (editId) {
					// Editing: load the saved estimate's inputs into the form.
					api('estimates/' + editId).then(function (er) {
						var inp = er.body && er.body.inputs;
						setF(inp && inp.centre_id ? inp : defaultForm(list[0].id));
					});
					return;
				}
				var d = loadDraft();
				if (d && d.centre_id && list.some(function (c) { return c.id === d.centre_id; })) { setF(d); } else { setF(defaultForm(list[0].id)); }
			});
		}, []);
		useEffect(function () {
			if (!f || !f.centre_id) { return; }
			if (!pctReady(f)) { setRes(null); return; }
			var payload = f.not_eligible ? Object.assign({}, f, { knows_ccs: true, known_pct: 0 }) : f;
			var t = setTimeout(function () { api('calculate', { method: 'POST', body: payload }).then(function (r) { if (r.ok && r.body && r.body.ok) { setRes(r.body); } }); }, 300);
			return function () { clearTimeout(t); };
		}, [f]);
		useEffect(function () { if (f && !editId) { saveDraft(f); } }, [f]);

		if (!centres) { return html`<${Loader} label="Loading calculator…" />`; }
		if (!centres.length) { return html`<div class="card">No centre is assigned to your account.</div>`; }
		if (!f) { return html`<${Loader} label="…" />`; }

		var centre = centres.filter(function (c) { return c.id === f.centre_id; })[0] || centres[0];
		function up(k, v) { setF(Object.assign({}, f, kv(k, v))); }
		function upCentre(v) { var id = parseInt(v, 10); setF(Object.assign({}, f, { centre_id: id, promotion_id: 0 })); }
		function upChild(i, k, v) { var ch = f.children.slice(); ch[i] = Object.assign({}, ch[i], kv(k, v)); up('children', ch); }
		function upChildMulti(i, obj) { var ch = f.children.slice(); ch[i] = Object.assign({}, ch[i], obj); up('children', ch); }
		function addChild() { var ch = f.children.concat([blankChild()]); up('children', ch); setOpenIdx(ch.length - 1); }
		function removeChild(i) { if (f.children.length > 1) { var ch = f.children.slice(); ch.splice(i, 1); up('children', ch); setOpenIdx(0); } }
		function setAllDays(d) { up('children', f.children.map(function (c) { return Object.assign({}, c, { days_week1: d, days_week2: d }); })); }
		function applyBest() { if (res && res.compare && res.compare.best) { setF(Object.assign({}, f, { rate_basis: res.compare.best.basis, promotion_id: res.compare.best.promo_id })); } }
		var sessionH = parseFloat(f.children[0] && f.children[0].hours_per_day) || 10;
		function save() {
			if (!res) { return; }
			setSaving(true); setSaveMsg('');
			var body = { centre_id: f.centre_id, parent_name: f.parent_name, parent_email: f.parent_email, parent_phone: f.parent_phone, income: f.income, ccs_pct: res.ccs.standard_pct, promotion_id: f.promotion_id, enrol_status: f.enrol_status, start_date: f.start_date, inputs: f, results: res };
			if (editId) { body.id = editId; }
			api('estimate', { method: 'POST', body: body }).then(function (r) {
				setSaving(false);
				if (r.ok && r.body && r.body.ok) {
					if (editId) { setSaveMsg('Estimate updated.'); if (props.onSaved) { props.onSaved(editId); } }
					else { setSaveMsg('Saved as lead #' + r.body.id + '.'); }
				} else { setSaveMsg((r.body && r.body.message) || 'Could not save.'); }
			});
		}

		function resetForm() { clearDraft(); setRes(null); setSaveMsg(''); setOpenIdx(0); setF(defaultForm(centre.id)); }
		var ready = estimateReady(f);
		var missing = [];
		if (!pctReady(f)) { missing.push(f.knows_ccs ? 'Known CCS %' : 'Combined family income'); }
		if (!f.not_eligible && (f.activity_hours === '' || f.activity_hours == null)) { missing.push('Activity hours per fortnight'); }
		f.children.forEach(function (c, i) {
			var lbl = 'Child ' + (i + 1);
			var dsum = (parseInt(c.days_week1, 10) || 0) + (parseInt(c.days_week2, 10) || 0);
			if (!c.dob) { missing.push(lbl + ' date of birth'); }
			if (!(dsum > 0)) { missing.push(lbl + ' attendance days'); }
			if (!((parseFloat(c.hours_per_day) || 0) > 0)) { missing.push(lbl + ' session hours'); }
		});
		var promoObj = (centre.promotions || []).filter(function (p) { return p.id === f.promotion_id; })[0];
		var g = res ? res.totals_period.fee : 0, govt = res ? res.totals_period.subsidy : 0, oop = res ? res.net_period_gap : 0;
		var wh = res ? res.totals_period.withholding : 0, promoSave = res ? res.promo_period_saving : 0;
		var subFull = res ? res.totals_period.subsidy_full : 0;
		var pctTxt = res ? (res.ccs.higher_pct > res.ccs.standard_pct ? res.ccs.standard_pct + ' to ' + res.ccs.higher_pct : res.ccs.standard_pct) : '0';
		var hours = res ? res.ccs.hours_per_fortnight : 72;
		var baseDayRate = res && res.compare && res.compare.by_days ? res.compare.by_days.reduce(function (m, d) { var pd = d.days ? d.weekly_fee / d.days : 0; return pd > m ? pd : m; }, 0) : 0;
		// Cap-aware upsell suggestion + per-row badges for Compare & choose.
		var byDays = res && res.compare && res.compare.by_days ? res.compare.by_days : [];
		var dayRate = {}; byDays.forEach(function (d) { dayRate[d.days] = d.days ? d.weekly_fee / d.days : 0; });
		var minDayRate = byDays.length ? Math.min.apply(null, byDays.map(function (d) { return d.days ? d.weekly_fee / d.days : Infinity; })) : 0;
		var capDaysWeek = sessionH > 0 ? (hours / (sessionH * 2)) : 0; // subsidised days per week
		var curDays = f.children.length ? Math.max.apply(null, f.children.map(function (c) { return Math.max(parseInt(c.days_week1, 10) || 0, parseInt(c.days_week2, 10) || 0); })) : 0;
		var suggest = null;
		if (byDays.length && curDays > 0) {
			var rowFor = function (n) { for (var k = 0; k < byDays.length; k++) { if (byDays[k].days === n) { return byDays[k]; } } return null; };
			var curRow = rowFor(curDays), maxDays = byDays[byDays.length - 1].days, capFloor = Math.floor(capDaysWeek + 1e-9);
			if (curRow && curDays < maxDays) {
				var target = 0, reason = '';
				if (curDays < capFloor) { target = Math.min(capFloor, maxDays); reason = 'ccs'; }
				else { for (var j = byDays.length - 1; j >= 0; j--) { if (byDays[j].days > curDays && dayRate[byDays[j].days] < dayRate[curDays] - 0.001) { target = byDays[j].days; reason = 'discount'; break; } } }
				var tRow = rowFor(target);
				if (target > curDays && tRow) {
					var exFee = tRow.weekly_fee - curRow.weekly_fee, exGovt = (tRow.weekly_fee - tRow.weekly_gap) - (curRow.weekly_fee - curRow.weekly_gap);
					suggest = { from: curDays, to: target, reason: reason,
						extraGap: tRow.weekly_gap - curRow.weekly_gap,
						coverage: exFee > 0 ? Math.round(exGovt / exFee * 100) : 0,
						disc: dayRate[curDays] > 0 ? Math.round((dayRate[curDays] - dayRate[target]) / dayRate[curDays] * 100) : 0,
						rate: dayRate[target], usedHrs: Math.round(curDays * sessionH * 2), capHrs: hours };
				}
			}
		}

		return html`<div class="calc-page">
			<div class="page-head"><h1 class="page-h">${editId ? 'Edit estimate #' + editId : 'New calculation'}</h1>
				<div class="ph-right">
					<button class="btn" onClick=${editId ? function () { if (props.onCancelEdit) { props.onCancelEdit(); } } : resetForm}>${editId ? 'Cancel' : 'Reset'}</button>
					<label class="calc-centre"><span>Centre</span><select value=${String(f.centre_id)} onChange=${function (e) { upCentre(e.target.value); }}>
						${centres.map(function (c) { return html`<option key=${c.id} value=${String(c.id)}>${c.brand_name + ' · ' + c.name}</option>`; })}
					</select></label>
				</div>
			</div>
			<div class="calc-cols">
					<div class="calc-input">
				<div class="card">
					<div class="subhead">Family</div>
					<div class="formgrid"><${Text} label="Parent name" value=${f.parent_name} onChange=${function (v) { up('parent_name', v); }} />
						<${Text} label="Email" type="email" value=${f.parent_email} onChange=${function (v) { up('parent_email', v); }} /></div>
					<div class="formgrid three"><${Text} label="Phone" value=${f.parent_phone} onChange=${function (v) { up('parent_phone', v); }} />
						<${Sel} label="Enrolment status" value=${f.enrol_status} onChange=${function (v) { up('enrol_status', v); }} options=${[['new', 'New enrolment'], ['existing', 'Existing family'], ['other', 'With another provider']]} />
						<${Text} label="Start date" type="date" value=${f.start_date} onChange=${function (v) { up('start_date', v); }} /></div>
				</div>
				<div class="card">
					<div class="subhead">Subsidy details</div>
					<div class="formgrid">
						<${Sel} label="CCS status" value=${f.not_eligible ? 'none' : (f.knows_ccs ? '1' : '0')} onChange=${function (v) { if (v === 'none') { setF(Object.assign({}, f, { not_eligible: true })); } else { setF(Object.assign({}, f, { not_eligible: false, knows_ccs: v === '1' })); } }} options=${[['0', 'Estimate from income'], ['1', 'I know the CCS %'], ['none', 'Not eligible for CCS']]} />
						${f.not_eligible ? html`<div class="f"><span>CCS entitlement</span><div class="static-field">Not eligible<span class="sf-note">parent pays the full fee</span></div></div>`
							: f.knows_ccs ? html`<${Text} label="Standard CCS % (first child)" req=${true} type="number" step="0.01" value=${f.known_pct} onChange=${function (v) { up('known_pct', v); }} />`
							: html`<${Text} label="Combined family income (annual)" req=${true} type="number" step="1000" value=${f.income} onChange=${function (v) { up('income', v); }} />`}
					</div>
					${f.not_eligible ? html`<p class="muted mini">This family is not eligible for CCS (for example, a temporary visa that does not meet the residency rules), so the estimate shows the full fee with no subsidy.</p>`
						: html`<${F}><div class="formgrid">
						${f.knows_ccs ? null
							: html`<${Text} label="Standard CCS % (calc)" type="number" readOnly=${true} value=${res ? res.ccs.standard_pct : ''} onChange=${function () {}} />`}
						<${Text} label="Activity hours / fortnight" req=${true} type="number" step="1" min="0" value=${f.activity_hours} onChange=${function (v) { up('activity_hours', v === '' ? '' : parseFloat(v)); }} />
					</div>
					<label class="chk calc-atsi"><input type="checkbox" checked=${!!f.is_atsi} onChange=${function (e) { up('is_atsi', e.target.checked); }} /> First Nations (ATSI) child: guarantees a base level of subsidised hours regardless of activity</label>
					<p class="muted mini">Enter hours of recognised activity per fortnight (work, study, looking for work, volunteering). 0 still receives the 3-Day Guarantee; 48+ hours reaches the maximum 100 subsidised hours.</p>
					<//>`}
				</div>
				<div class="card">
					<div class="subhead">Children</div>
					${f.children.map(function (ch, i) {
						var openThis = openIdx === i;
						var days = Math.max(parseInt(ch.days_week1, 10) || 0, parseInt(ch.days_week2, 10) || 0);
						var autoFee = resolveFee(centre, f.rate_basis, days, i);
						var basisLbl = f.rate_basis === 'weekly' ? 'weekly rate' : f.rate_basis === 'windback' ? 'WindBack rate' : (days + '-day rate');
						var totalDays = (parseInt(ch.days_week1, 10) || 0) + (parseInt(ch.days_week2, 10) || 0);
						var rc = res && res.children ? res.children[i] : null;
						var ageTxt = ch.dob ? (rc && rc.age > 0 ? rc.age + 'y' : '<1y') : null;
						var chips = html`<span class="cc-chips">
							${ageTxt ? html`<span class="cc-chip">${ageTxt}</span>` : null}
							<span class="cc-chip">${totalDays} days/ftn</span>
							${ch.hours_per_day ? html`<span class="cc-chip">${ch.hours_per_day}h/day</span>` : null}
							${rc && rc.ccs_pct != null ? html`<span class=${'cc-chip pct' + (rc.isHigher ? ' higher' : '')}>${rc.ccs_pct}% CCS</span>` : null}
							${rc && rc.feePerDay ? html`<span class="cc-chip ghost">${money(rc.feePerDay)}/day</span>` : null}
							${rc && rc.gap != null ? html`<span class="cc-chip ghost">gap ${money(rc.gap)}/ftn</span>` : null}
						</span>`;
						return html`<div class=${'calc-child' + (openThis ? ' open' : '')} key=${i}>
							<div class="calc-child-head" onClick=${function () { setOpenIdx(openThis ? -1 : i); }}>
								<div class="cc-headrow">
									<span class="cc-title"><strong>Child ${i + 1}</strong><span class="cc-sub">${ch.dob || 'No DOB'}</span></span>
									<span class="cc-right">${f.children.length > 1 ? html`<button class="xbtn" onClick=${function (e) { e.stopPropagation(); removeChild(i); }}>×</button>` : null}<span class="cc-caret">${openThis ? '▲' : '▼'}</span></span>
								</div>
								${!openThis ? html`<div class="cc-chiprow">${chips}</div>` : null}
							</div>
							${openThis ? html`<div class="calc-child-body">
								<div class="cc-detailstrip">${chips}</div>
								<div class="formgrid"><${Text} label="Date of birth" req=${true} type="date" max=${todayISO()} value=${ch.dob} onChange=${function (v) { if (v && v > todayISO()) { return; } upChild(i, 'dob', v); }} />
									<${Text} label="Session hours / day" req=${true} type="number" step="0.5" value=${ch.hours_per_day} onChange=${function (v) { upChild(i, 'hours_per_day', v); }} /></div>
								<div class="cd-row"><${Text} label="Days wk 1" req=${true} type="number" min="0" max="7" value=${ch.days_week1} onChange=${function (v) { upChild(i, 'days_week1', v); }} />
									<${Text} label="Days wk 2" req=${true} type="number" min="0" max="7" value=${ch.days_week2} onChange=${function (v) { upChild(i, 'days_week2', v); }} />
									${!ch.custom ? html`<div class="f cd-feecell"><span>Daily fee</span><div class="fee-box"><strong>${money(autoFee)}</strong><span class="fee-box-b">${basisLbl}</span><button class="linkmini" onClick=${function () { upChildMulti(i, { custom: true, fee_override: autoFee }); }}>Edit</button></div></div>`
										: html`<${Text} label="Custom fee ($)" type="number" step="0.01" value=${ch.fee_override} onChange=${function (v) { upChild(i, 'fee_override', v); }} />`}</div>
								${ch.custom ? html`<p class="muted mini">Manual rate, overriding the ${basisLbl}. <button class="linkmini" onClick=${function () { upChildMulti(i, { custom: false, fee_override: '' }); }}>Use automatic</button></p>` : null}
							</div>` : null}
						</div>`;
					})}
					<button class="btn addchild" onClick=${addChild}>+ Add another child</button>
				</div>


				</div>
					<aside class="card calc-sum">
					<div class="calc-sum-head"><span class="subhead" style=${{ margin: 0 }}>Live estimate</span>
						<select class="calc-period" value=${f.period} onChange=${function (e) { up('period', e.target.value); }}>
							<option value="week">per week</option><option value="fortnight">per fortnight</option><option value="month">per month</option><option value="year">per year</option></select></div>
					${!res || !ready ? html`<div class="calc-empty">
						<div class="ce-ic"><${Icon} name="estimates" size=${22} /></div>
						${missing.length ? html`<${F}><p class="ce-lead">To calculate CCS, add these details:</p><ul class="ce-check">${missing.map(function (m) { return html`<li key=${m}>${m}</li>`; })}</ul><//>` : html`<p>Calculating estimate…</p>`}
					</div>` : html`<${F}>
						<div class="est-top">
						<div class="est-summary">
							<div class="subhead">Summary</div>
						<div class="calc-fig"><span class="l">Gross fee</span><span class="v">${money(g)}</span></div>
						<div class="calc-fig"><span class="l">Total subsidy (CCS)</span><span class="v calc-good">${money(subFull)}</span></div>
						${wh > 0 ? html`<div class="calc-fig sub"><span class="l">Withholding held back <span class="tip" title="The government withholds a % of CCS (default 5%) and reconciles it after you lodge your tax return.">ⓘ</span></span><span class="v">${money(wh)}</span></div>` : null}
						<div class="calc-fig"><span class="l">Government pays now</span><span class="v calc-good">−${money(govt)}</span></div>
						${res.promo && promoSave > 0 ? html`<div class="calc-fig"><span class="l">${res.promo.name}</span><span class="v calc-good">−${money(promoSave)}</span></div>` : null}
						<div class="calc-fig total"><span class="l">Out of pocket</span><span class="v">${money(oop)}</span></div>
						${res.promo && res.promo.oneoff > 0 ? html`<div class="calc-fig sub"><span class="l">${res.promo.name} <em>(one-off)</em></span><span class="v calc-good">−${money(res.promo.oneoff)}</span></div>` : null}
						${res.promo ? html`<p class="promo-note">${res.promo.description}${res.promo.unit === 'weeks' ? html` <span class="promo-val">Offer value ${money(res.promo.total_value)}</span>` : null}</p>` : null}
						</div>
						${res.compare && res.compare.best ? html`<div class="best-card">
							<div class="best-top"><span class="best-star">★</span> Best value for money</div>
							<div class="best-price">${money(res.compare.best.weekly_gap)}<span> /wk</span></div>
							<div class="best-desc">${res.compare.best.basis_label}${res.compare.best.promo_id ? ' + ' + res.compare.best.promo_name : ''}${res.compare.best.weekly_saving > 0 ? ' · saves ' + money(res.compare.best.weekly_saving) + '/wk' : ''}${res.compare.best.oneoff > 0 ? ' + ' + money(res.compare.best.oneoff) + ' one-off' : ''}</div>
							${(f.rate_basis !== res.compare.best.basis || f.promotion_id !== res.compare.best.promo_id) ? html`<button class="btn best-apply" onClick=${applyBest}>Apply this offer</button>` : html`<div class="best-applied">✓ Currently applied</div>`}
						</div>` : null}
						</div>
						${res.compare ? html`<div class="calc-compare">
							<div class="cmp-title">Compare & choose <span>per week · tap a row to apply</span></div>
								${suggest ? html`<div class="cmp-suggest">
									<div class="sug-h">💡 Suggest ${suggest.to} days <span class="sug-from">currently ${suggest.from} ${suggest.from === 1 ? 'day' : 'days'}</span></div>
									<p class="sug-body">${suggest.reason === 'ccs'
										? html`This family is using ${suggest.usedHrs} of ${suggest.capHrs} subsidised hours per fortnight. The ${suggest.to - suggest.from} extra ${(suggest.to - suggest.from) === 1 ? 'day is' : 'days are'}${suggest.disc > 0 ? ' a lower daily rate and' : ''} about ${suggest.coverage}% covered by CCS, roughly ${suggest.extraGap >= 0 ? '+' : ''}${money(suggest.extraGap)}/wk more out of pocket.`
										: html`The daily rate drops to ${money(suggest.rate)} (${suggest.disc}% off). The ${suggest.to - suggest.from} extra ${(suggest.to - suggest.from) === 1 ? 'day is' : 'days are'} past the ${suggest.capHrs}-hour subsidised cap, so about ${suggest.extraGap >= 0 ? '+' : ''}${money(suggest.extraGap)}/wk more.`}</p>
									<button class="btn sug-apply" onClick=${function () { setAllDays(suggest.to); }}>Apply ${suggest.to} days</button>
								</div>` : null}
							<div class="cmp-group">
								<div class="cmp-h">Attendance packages <span>${sessionH}h/day</span></div>
									<p class="cmp-note">How many days per week the child attends.</p>
								<table class="cmp-tbl cmp-wide"><thead><tr><th>Days/wk</th><th class="r">Daily rate</th><th class="r">Full fee/wk</th><th class="r">Govt pays</th><th class="r">Day discount</th><th class="r">Family pays/wk</th></tr></thead><tbody>${res.compare.by_days.map(function (d) {
									var allD = f.children.every(function (c) { return (parseInt(c.days_week1, 10) || 0) === d.days && (parseInt(c.days_week2, 10) || 0) === d.days; });
									var perDay = d.days ? d.weekly_fee / d.days : 0;
									return html`<tr key=${d.days} class=${'cmp-row' + (allD ? ' cmp-active' : '')} onClick=${function () { setAllDays(d.days); }}>
										<td><span class=${'rdot' + (allD ? ' on' : '')}></span>${d.days} days${(capDaysWeek > 0 && d.days <= capDaysWeek + 1e-9) ? html`<span class="rbadge ccs">Within CCS</span>` : null}${(dayRate[d.days - 1] != null && Math.abs(dayRate[d.days - 1] - perDay) < 0.001) ? html`<span class="rbadge same">Same rate</span>` : null}${(Math.abs(perDay - minDayRate) < 0.001 && perDay < baseDayRate - 0.001) ? html`<span class="rbadge best">Best rate</span>` : null}</td><td class="r cmp-fee">${money(perDay)}</td><td class="r cmp-fee">${money(d.weekly_fee)}</td><td class="r cmp-ccs">−${money(d.weekly_fee - d.weekly_gap)}</td><td class="r cmp-save">${baseDayRate > 0 && perDay < baseDayRate ? Math.round((baseDayRate - perDay) / baseDayRate * 100) + '%' : '-'}</td><td class="r cmp-gap">${money(d.weekly_gap)}</td></tr>`;
								})}</tbody></table>
							</div>
							${res.compare.by_promo.length > 1 ? html`<div class="cmp-group">
								<div class="cmp-h">Special offers</div>
									<p class="cmp-note">Discounts you can apply for this family.</p>
								<table class="cmp-tbl"><thead><tr><th>Offer</th><th class="r">Saving</th><th class="r">Family pays/wk</th></tr></thead><tbody>${res.compare.by_promo.map(function (p) {
									return html`<tr key=${p.id} class=${'cmp-row' + (p.id === f.promotion_id ? ' cmp-active' : '')} onClick=${function () { up('promotion_id', p.id); }}>
										<td><span class=${'rdot' + (p.id === f.promotion_id ? ' on' : '')}></span>${p.name}</td><td class="r cmp-save">${p.weekly_saving > 0 ? '−' + money(p.weekly_saving) + '/wk' : (p.oneoff > 0 ? '−' + money(p.oneoff) + ' once' : '-')}</td><td class="r cmp-gap">${money(p.weekly_gap)}</td></tr>`;
								})}</tbody></table>
								${promoObj && promoObj.terms ? html`<details class="calc-terms"><summary>Terms & conditions: ${promoObj.name}</summary><div>${promoObj.terms}</div></details>` : null}
							</div>` : null}
						</div>` : null}
					<//>`}
					<button class="btn primary calc-save" disabled=${saving || !res || !ready} onClick=${save}>${saving ? 'Saving…' : (editId ? 'Update estimate' : 'Save estimate')}</button>
					${saveMsg ? html`<p class="calc-msg">${saveMsg}</p>` : null}
					<p class="muted mini" style=${{ marginTop: '10px' }}>Estimate only. Final CCS entitlement is determined by Services Australia.</p>
				</aside>
			</div>
			${res && ready ? html`<${CalcExplainer} res=${res} f=${f} centre=${centre} />` : null}
		</div>`;
	}

	/* ---------------- Temporary calculation explainer (remove later) ---------------- */
	function CalcExplainer(props) {
		var res = props.res, f = props.f, centre = props.centre;
		var tf = res.totals_fortnight, hrsFtn = res.ccs.hours_per_fortnight, hrsWk = hrsFtn / 2;
		var whPct = f.withholding;
		var basisLbl = f.rate_basis === 'weekly' ? 'weekly rate' : f.rate_basis === 'windback' ? 'WindBack rate' : 'standard day-tier';
		return html`<details class="calc-explain">
			<summary class="ex-head"><strong>How this estimate is calculated</strong><span class="ex-temp">Temporary · click to expand · will be removed</span></summary>
			<div class="ex-grid">
				<div class="ex-block">
					<h4>1 · Inputs & CCS %</h4>
					<ul>
						<li>Centre: <b>${centre.brand_name} · ${centre.name}</b>, fee basis: <b>${basisLbl}</b></li>
						<li>${f.knows_ccs ? html`Known CCS: <b>${f.known_pct}%</b>` : html`Family income: <b>${money(f.income)}</b> → Standard CCS <b>${res.ccs.standard_pct}%</b>${res.ccs.higher_pct > res.ccs.standard_pct ? html`, Higher CCS <b>${res.ccs.higher_pct}%</b> (2nd+ child under 6)` : null}`}</li>
						<li>Activity: <b>${f.activity_hours >= 49 ? 'more than 48 hrs' : '48 hrs or less'}</b> → subsidised hours <b>${hrsFtn}/fortnight</b> (${hrsWk}/week). The 3-Day Guarantee floors this at 72.</li>
						<li>Withholding: <b>${whPct}%</b> of the CCS is held back by the government until tax reconciliation.</li>
					</ul>
				</div>
				${res.children.map(function (c, i) {
					var days = c.daysWeek1 + c.daysWeek2;
					var attHrs = days * c.hoursPerDay, feeAboveCap = c.hourlyFee > c.hourlyCap + 0.001, overCap = attHrs > hrsFtn + 0.001;
					return html`<div class="ex-block" key=${i}>
						<h4>${i + 2} · Child ${i + 1}${c.age ? ' (' + c.age + 'y)' : ''}${c.sibling ? ' · sibling rate' : ''}</h4>
						<ol>
							<li><b>Centre's hourly rate:</b> daily fee ${money(c.feePerDay)} ÷ ${c.hoursPerDay} hrs/day = <b>${money(c.hourlyFee)}/hr</b></li>
							<li><b>Government hourly cap:</b> CCS is only paid up to <b>${money(c.hourlyCap)}/hr</b> (centre care${c.age < 6 ? ', below school age' : ''}). ${feeAboveCap ? html`Your rate is above the cap, so CCS is worked out on <b>${money(c.effRate)}/hr</b> (the lower value), not your full rate.` : html`Your rate is within the cap, so CCS uses your full <b>${money(c.effRate)}/hr</b>.`}</li>
							<li><b>Subsidy per hour:</b> ${money(c.effRate)}/hr × ${c.ccs_pct}% CCS rate = <b>${money(c.hourlyCCS)}/hr</b></li>
							<li><b>Hours the government covers:</b> attending ${c.daysWeek1} + ${c.daysWeek2} days × ${c.hoursPerDay} hrs = <b>${attHrs} hrs/fortnight</b>. CCS covers up to <b>${hrsFtn} hrs/fortnight</b>, so ${overCap ? html`only the first <b>${hrsFtn} hrs</b> are subsidised (the rest is full price).` : html`all <b>${attHrs} hrs</b> are subsidised.`}</li>
							<li><b>Gross fee:</b> ${days} days/fortnight × ${money(c.feePerDay)} = <b>${money(c.fortnightFee)}</b></li>
							<li><b>Subsidy:</b> ${money(c.hourlyCCS)}/hr × covered hours = <b>${money(c.subFull)}</b> (never more than the fee); less ${whPct}% withholding ${money(c.withholding)} = <b>${money(c.fortnightSub)}</b> paid now, the rest at tax time.</li>
							<li><b>Family pays:</b> gross fee ${money(c.fortnightFee)} − subsidy ${money(c.fortnightSub)} = <b>${money(c.gap)} / fortnight</b></li>
						</ol>
					</div>`;
				})}
				<div class="ex-block">
					<h4>${res.children.length + 2} · Family totals (per fortnight)</h4>
					<ul>
						<li>Gross fee: <b>${money(tf.fee)}</b></li>
						<li>CCS entitlement (full): <b>${money(tf.subsidy_full)}</b></li>
						<li>Withholding held back: <b>${money(tf.withholding)}</b></li>
						<li>Government pays now: <b>${money(tf.subsidy)}</b></li>
						<li>Out of pocket (before offer): <b>${money(tf.gap)}</b></li>
					</ul>
				</div>
				${res.promo ? html`<div class="ex-block ex-promo">
					<h4>Promotion · ${res.promo.name}</h4>
					<ul>
						<li>${res.promo.unit === 'weeks' ? html`"${res.promo.name}" = 1 free week every 5 weeks (5th, 10th, 15th, 20th…).` : 'Discount applied to the parent gap after subsidy.'}</li>
						<li>Weekly gap ${money(tf.gap / 2)} → effective saving <b>${money(res.promo.weekly_saving)}/week</b> (amortised).</li>
						${res.promo.unit === 'weeks' ? html`<li>Total offer value = free weeks × weekly gap = <b>${money(res.promo.total_value)}</b> over the offer.</li>` : null}
						<li>CCS is always calculated on the <b>gross fee</b>; the promotion only reduces the parent's out-of-pocket.</li>
					</ul>
				</div>` : null}
			</div>
		</details>`;
	}

	/* ---------------- Auth: login, no-access, settings ---------------- */
	function doLogout() { api('logout', { method: 'POST' }).then(function () { window.location.reload(); }); }

	function Login() {
		var us = useState(''), user = us[0], setUser = us[1];
		var ps = useState(''), pass = ps[0], setPass = ps[1];
		var es = useState(''), err = es[0], setErr = es[1];
		var bs = useState(false), busy = bs[0], setBusy = bs[1];
		function submit(e) {
			if (e) { e.preventDefault(); }
			if (!user || !pass) { setErr('Enter your email and password.'); return; }
			setBusy(true); setErr('');
			api('login', { method: 'POST', body: { username: user, password: pass } }).then(function (r) {
				if (r.ok && r.body && r.body.ok) { window.location.reload(); }
				else { setBusy(false); setErr((r.body && r.body.message) || 'Sign in failed.'); }
			});
		}
		return html`<div class="login-wrap">
			<form class="login-card" onSubmit=${submit}>
				<${Logo} className="login-logo" />
				<h1 class="login-h">Centre CCS Portal</h1>
				<p class="login-sub">Sign in to your staff account</p>
				<label class="f"><span>Email</span><input type="text" autocomplete="username" value=${user} onInput=${function (e) { setUser(e.target.value); }} placeholder="name@centre.com" /></label>
				<label class="f"><span>Password</span><input type="password" autocomplete="current-password" value=${pass} onInput=${function (e) { setPass(e.target.value); }} placeholder="••••••••" /></label>
				${err ? html`<div class="login-err">${err}</div>` : null}
				<button type="submit" class="btn primary login-btn" disabled=${busy}>${busy ? 'Signing in…' : 'Sign in'}</button>
				<p class="login-foot">Trouble signing in? Contact your administrator.</p>
			</form>
		</div>`;
	}

	function NoAccess() {
		return html`<div class="login-wrap"><div class="login-card">
			<${Logo} className="login-logo" />
			<h1 class="login-h">No portal access</h1>
			<p class="login-sub">You're signed in, but this account doesn't have access to the CCS Portal. Please contact your administrator.</p>
			<button class="btn login-btn" onClick=${doLogout}>Log out</button>
		</div></div>`;
	}

	function Settings(props) {
		var me = props.me;
		var ns = useState(me.name || ''), name = ns[0], setName = ns[1];
		var es = useState(me.email || ''), email = es[0], setEmail = es[1];
		var cs = useState(''), cur = cs[0], setCur = cs[1];
		var nps = useState(''), np = nps[0], setNp = nps[1];
		var cps = useState(''), cp = cps[0], setCp = cps[1];
		var msS = useState(''), msg = msS[0], setMsg = msS[1];
		var erS = useState(''), err = erS[0], setErr = erS[1];
		var bs = useState(false), busy = bs[0], setBusy = bs[1];
		function saveProfile() {
			setBusy(true); setMsg(''); setErr('');
			api('account', { method: 'POST', body: { display_name: name, email: email } }).then(function (r) {
				setBusy(false);
				if (r.ok && r.body.ok) { setMsg('Profile updated.'); props.onUpdated(r.body); } else { setErr((r.body && r.body.message) || 'Could not save.'); }
			});
		}
		function savePassword() {
			setMsg(''); setErr('');
			if (np !== cp) { setErr('New passwords do not match.'); return; }
			if (np.length < 8) { setErr('New password must be at least 8 characters.'); return; }
			setBusy(true);
			api('account', { method: 'POST', body: { current_password: cur, new_password: np } }).then(function (r) {
				setBusy(false);
				// Changing the password rotates the session token, which invalidates
				// the REST nonce this page was rendered with. Reload for a fresh one,
				// as login and logout do, without it every later call 403s.
				if (r.ok && r.body.ok) { setMsg('Password changed. Reloading…'); setCur(''); setNp(''); setCp(''); window.setTimeout(function () { window.location.reload(); }, 1200); } else { setErr((r.body && r.body.message) || 'Could not change password.'); }
			});
		}
		return html`<div style=${{ maxWidth: '600px' }}>
			<h1 class="page-h">Settings</h1>
			${msg ? html`<p class="calc-msg" style=${{ marginBottom: '12px' }}>${msg}</p>` : null}
			${err ? html`<p class="formerr" style=${{ marginBottom: '12px' }}>${err}</p>` : null}
			<div class="card"><h3>Profile</h3>
				<div class="formgrid">
					<${Text} label="Display name" value=${name} onChange=${setName} />
					<${Text} label="Email" type="email" value=${email} onChange=${setEmail} />
				</div>
				<div class="formactions"><button class="btn primary" disabled=${busy} onClick=${saveProfile}>Save profile</button></div>
			</div>
			<div class="card"><h3>Change password</h3>
				<${Text} label="Current password" type="password" value=${cur} onChange=${setCur} />
				<div class="formgrid">
					<${Text} label="New password" type="password" value=${np} onChange=${setNp} />
					<${Text} label="Confirm new password" type="password" value=${cp} onChange=${setCp} />
				</div>
				<div class="formactions"><button class="btn primary" disabled=${busy} onClick=${savePassword}>Change password</button></div>
			</div>
			<div class="card"><h3>Session</h3><button class="btn danger" onClick=${doLogout}>Log out</button></div>
		</div>`;
	}

	/* ---------------- Testing scenarios ---------------- */
	// badge: 'unavailable' = feature not built yet; 'setup' = needs an admin to configure it first.
	var SCENARIOS = [
		{ group: 'Family income & subsidy rate', items: [
			{ id: 'inc-low', t: 'Single child, low family income: expect a high CCS % (up to ~90% at/under the base income threshold).' },
			{ id: 'inc-med', t: 'Single child, medium family income: subsidy tapers down as income rises.' },
			{ id: 'inc-high', t: 'Single child, high family income: subsidy reduces toward 0 above the upper income limit.' },
			{ id: 'inc-taper', t: 'Income exactly on a taper threshold: the rate steps/tapers correctly at the boundary.' },
			{ id: 'inc-withhold', t: 'Withholding applied: the standard 5% is withheld from the subsidy and reflected in the parent gap.' },
		] },
		{ group: 'Children & ages', items: [
			{ id: 'kids-two', t: 'Two children both eligible for CCS.' },
			{ id: 'kids-three', t: 'Three or more children with different ages.' },
			{ id: 'kids-higher', t: 'Second/third child higher rate: younger siblings get the multiple-child higher subsidy.' },
			{ id: 'kids-underpre', t: 'Child under preschool age (age is derived from date of birth).' },
			{ id: 'kids-preschool', t: 'Child attending preschool / kindergarten (no separate preschool session type exists).', badge: 'unavailable' },
			{ id: 'kids-atsi', t: 'First Nations (ATSI) child: tick the "First Nations (ATSI) child" box; the base subsidised hours apply regardless of activity.' },
		] },
		{ group: 'Activity test', items: [
			{ id: 'act-below', t: 'Low activity: enter a small number of activity hours per fortnight (e.g. 0); the 3-Day Guarantee still applies.' },
			{ id: 'act-at', t: 'Activity hours exactly at a threshold boundary: type the precise number (e.g. 48) in the Activity hours field.' },
			{ id: 'act-above', t: 'High activity: enter 48+ activity hours per fortnight to reach the maximum subsidised hours.' },
		] },
		{ group: 'Attendance & sessions', items: [
			{ id: 'att-days', t: 'Attendance schedules from 1 to 5 days per week (Days wk 1 / Days wk 2).' },
			{ id: 'att-halfday', t: 'Full-day vs half-day session length via the "Session hours / day" field.' },
			{ id: 'att-perchild', t: 'Different hours per day set per child.' },
		] },
		{ group: 'Fees & centre configuration', items: [
			{ id: 'fee-rates', t: 'Different daily fees and hourly rates (automatic rate or a custom fee override).' },
			{ id: 'fee-cap', t: 'Different centre configurations and CCS hourly caps: subsidy is capped at the hourly cap.' },
			{ id: 'fee-abovecap', t: 'Fee above vs below the hourly cap: the gap widens when the fee exceeds the cap.' },
		] },
		{ group: 'Promotions', items: [
			{ id: 'promo-2wk', t: 'Apply a 2 Weeks Free Care promotion.', badge: 'setup' },
			{ id: 'promo-4wk', t: 'Apply a 4 Weeks Free Care promotion.', badge: 'setup' },
			{ id: 'promo-windback', t: 'Apply the Windback rate (set the centre’s windback rate; it appears in Compare & choose).', badge: 'setup' },
			{ id: 'promo-multi', t: 'Multiple promotions enabled/disabled: the best offer is chosen in Compare & choose.', badge: 'setup' },
			{ id: 'promo-expiry', t: 'Expired vs active promotion: the start/end date range is enforced.', badge: 'setup' },
		] },
		{ group: 'Saving & editing', items: [
			{ id: 'save-reopen', t: 'Save an estimate, reopen it, and confirm every value is unchanged.' },
			{ id: 'save-edit', t: 'Edit a saved estimate (the "Edit estimate" button on the detail page) and confirm the recalculated values save correctly.' },
			{ id: 'save-status', t: 'Status workflow (New → Contacted → Enrolled → Lost) persists after saving.' },
			{ id: 'save-scoping', t: 'A manager sees only their own saved leads; an admin sees all leads.' },
		] },
		{ group: 'Validation & boundaries', items: [
			{ id: 'val-bounds', t: 'Minimum / maximum supported income, fees, hours and number of children.' },
			{ id: 'val-invalid', t: 'Invalid or incomplete data shows a clear validation message.' },
			{ id: 'val-dob', t: 'A future date of birth or an invalid date is rejected.' },
		] },
		{ group: 'Accuracy & rounding', items: [
			{ id: 'acc-round', t: 'Rounding of subsidy, parent gap fee and total payable amounts.' },
			{ id: 'acc-official', t: 'Compare results against the official CCS estimate for sample cases.' },
			{ id: 'acc-currency', t: 'Currency and locale formatting (AUD, two decimal places).' },
		] },
	];
	var BADGE_LABEL = { unavailable: 'Not available yet', setup: 'Needs admin setup' };
	function scenarioFlat() {
		var out = [];
		SCENARIOS.forEach(function (g) { g.items.forEach(function (it) { out.push(Object.assign({ group: g.group }, it)); }); });
		return out;
	}
	function TestingView(props) {
		var caps = props.caps || {};
		var isAdmin = !!caps.manage_portal;
		var ss = useState(null), status = ss[0], setStatus = ss[1];
		var au = useState(null), allUsers = au[0], setAllUsers = au[1];
		var vu = useState(null), viewUser = vu[0], setViewUser = vu[1]; // null = my own checklist
		useEffect(function () { api('testing/status').then(function (r) { setStatus((r.body && r.body.status) || {}); }); }, []);
		useEffect(function () { if (isAdmin) { api('admin/testing').then(function (r) { setAllUsers((r.body && r.body.users) || []); }); } }, []);
		var flat = scenarioFlat();
		var testable = flat.filter(function (it) { return it.badge !== 'unavailable'; });
		var LABELS = {}; flat.forEach(function (it) { LABELS[it.id] = it.t; });
		function persist(id, val) { api('testing/status', { method: 'POST', body: { id: id, status: val || '', label: LABELS[id] || id } }); }
		function setOne(id, val) { setStatus(function (s) { var n = Object.assign({}, s); if (val) { n[id] = val; } else { delete n[id]; } return n; }); persist(id, val); }
		function toggle(id, val) { setOne(id, (status && status[id] === val) ? '' : val); }
		function reportIssue(it) { setOne(it.id, 'issue'); props.onReport(it.t); }
		function counts(map) { var c = { p: 0, i: 0 }; testable.forEach(function (it) { if (map[it.id] === 'pass') { c.p++; } else if (map[it.id] === 'issue') { c.i++; } }); return c; }
		if (!status) { return html`<${Loader} label="Loading scenarios…" />`; }

		// Which checklist are we showing: my own (editable) or another user's (read-only)?
		var viewed = null;
		if (viewUser != null && allUsers) { viewed = allUsers.filter(function (u) { return u.id === viewUser; })[0]; }
		var editable = !viewed;
		var vmap = editable ? status : (viewed.status || {});
		var vc = counts(vmap);
		var pct = testable.length ? Math.round((vc.p + vc.i) / testable.length * 100) : 0;

		function groups(map, canEdit) {
			return SCENARIOS.map(function (g) {
				return html`<div class="card" key=${g.group}>
					<h3>${g.group}</h3>
					<ul class="scenario-list">
						${g.items.map(function (it) {
							var st = map[it.id];
							return html`<li key=${it.id} class=${'sc-row' + (st ? ' sc-' + st : '')}>
								<div class="sc-main"><span class="sc-txt">${it.t}</span>${it.badge ? html`<span class=${'sc-badge ' + it.badge}>${BADGE_LABEL[it.badge]}</span>` : null}</div>
								${it.badge === 'unavailable' ? null : (canEdit ? html`<div class="sc-actions">
									<button class=${'sc-btn works' + (st === 'pass' ? ' on' : '')} onClick=${function () { toggle(it.id, 'pass'); }}>✓ Works</button>
									<button class=${'sc-btn issue' + (st === 'issue' ? ' on' : '')} onClick=${function () { reportIssue(it); }}>⚠ Issue</button>
								</div>` : html`<div class="sc-actions"><span class=${'sc-mark ' + (st || 'none')}>${st === 'pass' ? '✓ Works' : st === 'issue' ? '⚠ Issue' : 'Not checked'}</span></div>`)}
							</li>`;
						})}
					</ul>
				</div>`;
			});
		}

		return html`<div>
			<h1 class="page-h">Testing scenarios</h1>
			${isAdmin && allUsers ? html`<div class="card"><h3>Team testing progress</h3>
				<div class="tablewrap"><table class="tbl">
					<thead><tr><th>User</th><th>Role</th><th class="num">Passing</th><th class="num">Issues</th><th class="num">Checked</th><th></th></tr></thead>
					<tbody>${allUsers.length === 0 ? html`<tr><td colspan="6" class="empty">No portal users yet.</td></tr>` : allUsers.map(function (u) {
						var c = counts(u.status || {});
						return html`<tr key=${u.id} class=${'rowlink' + (viewUser === u.id ? ' sel' : '')} onClick=${function () { setViewUser(u.id); }}>
							<td><strong>${u.name}</strong></td><td>${u.role}</td>
							<td class="num good">${c.p}</td>
							<td class="num">${c.i ? html`<span class="tprog-iss">${c.i}</span>` : '0'}</td>
							<td class="num">${c.p + c.i} / ${testable.length}</td>
							<td><button class="btn sm" onClick=${function (e) { e.stopPropagation(); setViewUser(u.id); }}>View</button></td></tr>`;
					})}</tbody></table></div>
			</div>` : null}

			<div class="card">
				<div class="page-head" style=${{ marginBottom: '10px' }}>
					<strong>${editable ? 'My checklist' : viewed.name + ' · ' + viewed.role}</strong>
					${!editable ? html`<button class="btn sm" onClick=${function () { setViewUser(null); }}>← My checklist</button>` : null}
				</div>
				${editable ? html`<p class="muted mini" style=${{ margin: '0 0 12px' }}>Work through each scenario in New calculation. Mark it ✓ Works or ⚠ Issue. Your progress is saved.</p>` : html`<p class="muted mini" style=${{ margin: '0 0 12px' }}>Read-only view of this user's progress.</p>`}
				<div class="tprog"><div class="tprog-bar"><div class="tprog-fill" style=${{ width: pct + '%' }}></div></div>
					<div class="tprog-lab">${vc.p + vc.i} / ${testable.length} checked · <span class="good">${vc.p} passing</span>${vc.i ? html` · <span class="tprog-iss">${vc.i} issue${vc.i === 1 ? '' : 's'}</span>` : null}</div>
				</div>
			</div>
			${groups(vmap, editable)}
		</div>`;
	}

	/* ---------------- Portal welcome tour (coach-marks) ---------------- */
	function tourSteps(caps) {
		var steps = [
			{ icon: 'i9', title: 'Welcome to the CCS Portal', body: 'This is your workspace for estimating the Child Care Subsidy for families and tracking them as leads. This quick tour points out each button so you know exactly what it does.' },
			{ icon: 'dashboard', target: '[data-tour="dashboard"]', title: 'Dashboard', body: 'Your home screen. See how many estimates you have, how many families enrolled, your conversion rate and estimated annual fees, plus your lead pipeline at a glance.' },
			{ icon: 'plus', target: '[data-tour="calculator"]', title: 'New calculation', body: 'Click here to create a CCS estimate: choose your centre, enter the family income (or a known CCS %), add each child, and watch the subsidy and out-of-pocket update live. Then save it as a lead.' },
			{ icon: 'estimates', target: '[data-tour="estimates"]', title: 'Saved estimates', body: 'Every estimate you save lands here. Open one for the full breakdown, move it through the pipeline (New → Contacted → Enrolled → Lost), or use Edit estimate to change details and recalculate.' },
		];
		// Centres & Promotions are visible to everyone; the wording covers view-only
		// centre managers and editing area managers/admins alike.
		steps.push(
			{ icon: 'centres', target: '[data-tour="centres"]', title: 'Centres & fees', body: caps.manage_fees ? 'The daily fee schedule for each of your centres. You can edit a centre’s fees and details here.' : 'The daily fee schedule for your centres, shown for reference (view-only for centre managers).' },
			{ icon: 'promotions', target: '[data-tour="promotions"]', title: 'Promotions', body: caps.manage_promotions ? 'Create and edit offers like weeks-free or discounts, with start and end dates. They appear automatically in the calculator’s Compare & choose.' : 'Current offers and their dates, shown for reference (view-only for centre managers).' }
		);
		if (caps.manage_portal) {
			steps.push(
				{ icon: 'brands', target: '[data-tour="brands"]', title: 'Brands', body: 'Manage your brands (name, colour and logo) used across the portal and on branded estimates.' },
				{ icon: 'users', target: '[data-tour="users"]', title: 'Users', body: 'Add portal admins, area managers or centre managers, choose their role, assign centres and set passwords.' }
			);
		}
		steps.push(
			{ icon: 'testing', target: '[data-tour="testing"]', title: 'Testing scenarios', body: 'A checklist of situations to try in the calculator. Mark each as ✓ Works, or ⚠ Issue if something looks wrong. Your progress is saved.' },
			{ icon: 'feedback', target: '[data-tour="feedback"]', title: 'Feedback', body: 'Have a suggestion or found a bug? Send it here. The team reviews every message and you can see the status of yours.' },
			{ icon: 'settings', target: '[data-tour="settings"]', title: 'Settings & password', body: 'This is your account menu. Open it to update your name and email, or change your password.' },
			{ icon: 'check', title: 'You’re all set', body: 'That’s the tour. A good first step is to create a New calculation. You can reopen this guide any time with the “How it works” button on the Dashboard.' }
		);
		return steps;
	}
	function PortalTour(props) {
		var steps = tourSteps(props.caps || {});
		var is = useState(0), i = is[0], setI = is[1];
		var rc = useState(null), rect = rc[0], setRect = rc[1];
		var cur = steps[i], last = i === steps.length - 1;
		React.useLayoutEffect(function () {
			function measure() {
				var el = cur.target ? document.querySelector(cur.target) : null;
				if (el) {
					if (el.scrollIntoView) { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
					var r = el.getBoundingClientRect();
					setRect({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
				} else { setRect(null); }
			}
			measure();
			window.addEventListener('resize', measure);
			return function () { window.removeEventListener('resize', measure); };
		}, [i]);

		var card = html`<${F}>
			<button class="tour-x" onClick=${props.onDone} aria-label="Close">×</button>
			<div class="tour-hd">
				<div class="tour-ic">${cur.icon === 'i9' ? html`<${I9Mark} h=${22} />` : html`<${Icon} name=${cur.icon} size=${20} />`}</div>
				<div><div class="tour-step">Step ${i + 1} of ${steps.length}</div><h2 class="tour-title">${cur.title}</h2></div>
			</div>
			<p class="tour-body">${cur.body}</p>
			<div class="tour-dots">${steps.map(function (s, n) { return html`<span key=${n} class=${'tour-dot' + (n === i ? ' on' : '')} onClick=${function () { setI(n); }}></span>`; })}</div>
			<div class="tour-nav">
				<button class="btn sm" disabled=${i === 0} onClick=${function () { setI(i - 1); }}>← Back</button>
				<div class="tour-nav-r">
					${last ? null : html`<button class="link tour-skip" onClick=${props.onDone}>Skip</button>`}
					<button class="btn primary sm" onClick=${function () { if (last) { props.onDone(); } else { setI(i + 1); } }}>${last ? 'Get started' : 'Next →'}</button>
				</div>
			</div>
		<//>`;

		if (!rect) {
			return html`<div class="tour-anchor"><div class="tour-backdrop"></div><div class="tour-modal tour-centered">${card}</div></div>`;
		}
		var pad = 6;
		var spot = { left: (rect.left - pad) + 'px', top: (rect.top - pad) + 'px', width: (rect.width + pad * 2) + 'px', height: (rect.height + pad * 2) + 'px' };
		var vw = window.innerWidth, vh = window.innerHeight, W = 320, gap = 16;
		var tip = { maxWidth: W + 'px' };
		if (rect.right + gap + W <= vw) { tip.left = (rect.right + gap) + 'px'; tip.top = Math.max(12, Math.min(rect.top, vh - 280)) + 'px'; }
		else if (rect.left - gap - W >= 0) { tip.left = (rect.left - gap - W) + 'px'; tip.top = Math.max(12, Math.min(rect.top, vh - 280)) + 'px'; }
		else { tip.top = (rect.bottom + gap) + 'px'; tip.left = Math.max(12, Math.min(rect.left, vw - W - 12)) + 'px'; }
		return html`<div class="tour-anchor">
			<div class="tour-spot" style=${spot}></div>
			<div class="tour-tip" style=${tip}>${card}</div>
		</div>`;
	}

	/* ---------------- Feedback ---------------- */
	function statusClass(s) { return 'fb-status fb-' + s; }
	function FeedbackView(props) {
		var ds = useState(null), data = ds[0], setData = ds[1];
		var load = useCallback(function () { api('feedback').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		var blank = { subject: '', message: '', category: 'bug', severity: 'medium', scenario: props.initialScenario || '' };
		var fs = useState(blank), form = fs[0], setForm = fs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		var es = useState(''), err = es[0], setErr = es[1];
		var oks = useState(''), okMsg = oks[0], setOk = oks[1];
		var fus = useState(''), fbUser = fus[0], setFbUser = fus[1];
		var fss = useState(''), fbStatus = fss[0], setFbStatus = fss[1];
		useEffect(function () { if (props.initialScenario) { setForm(function (f) { return Object.assign({}, f, { scenario: props.initialScenario }); }); } }, [props.initialScenario]);
		function up(k, v) { setForm(Object.assign({}, form, kv(k, v))); }
		function submit() {
			if (!form.subject.trim() || !form.message.trim()) { setErr('Please add a subject and a description.'); return; }
			setSaving(true); setErr(''); setOk('');
			api('feedback', { method: 'POST', body: form }).then(function (r) {
				setSaving(false);
				if (r.ok && r.body && r.body.ok) { setForm(Object.assign({}, blank, { scenario: '' })); setOk('Thanks, your feedback has been sent.'); setData(r.body); }
				else { setErr((r.body && r.body.message) || 'Could not send feedback.'); }
			});
		}
		if (!data) { return html`<${Loader} label="Loading feedback…" />`; }
		var cats = data.categories, sevs = data.severities, statuses = data.statuses;
		var catOpts = Object.keys(cats).map(function (k) { return [k, cats[k]]; });
		var sevOpts = Object.keys(sevs).map(function (k) { return [k, sevs[k]]; });
		return html`<div>
			<h1 class="page-h">Feedback</h1>
			<div class="grid2">
				<div class="card"><h3>Send feedback</h3>
					<${Text} label="Subject" value=${form.subject} onChange=${function (v) { up('subject', v); }} />
					<div class="formgrid">
						<${Sel} label="Type" value=${form.category} onChange=${function (v) { up('category', v); }} options=${catOpts} />
						<${Sel} label="Severity" value=${form.severity} onChange=${function (v) { up('severity', v); }} options=${sevOpts} />
					</div>
					<${Text} label="Related scenario (optional)" value=${form.scenario} onChange=${function (v) { up('scenario', v); }} />
					<${Area} label="Describe what you did, what you expected, and what happened" rows=${5} value=${form.message} onChange=${function (v) { up('message', v); }} />
					<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${submit}>${saving ? 'Sending…' : 'Send feedback'}</button>${err ? html`<span class="formerr">${err}</span>` : null}${okMsg ? html`<span class="formok">${okMsg}</span>` : null}</div>
				</div>
				<div class="card"><h3>${data.is_super ? 'All reports' : 'Your feedback'}</h3>
					${data.is_super ? (function () {
						var submitters = [], seen = {};
						data.feedback.forEach(function (f) { if (!seen[f.user_id]) { seen[f.user_id] = { id: f.user_id, name: f.user_name, role: f.user_role, count: 0 }; submitters.push(seen[f.user_id]); } seen[f.user_id].count++; });
						var userOpts = [['', 'All users (' + data.feedback.length + ')']].concat(submitters.map(function (u) { return [String(u.id), u.name + ' · ' + (u.role || '') + ' (' + u.count + ')']; }));
						var statusOpts = [['', 'All statuses']].concat(Object.keys(statuses).map(function (k) { return [k, statuses[k]]; }));
						var filtered = data.feedback.filter(function (f) { return (!fbUser || String(f.user_id) === fbUser) && (!fbStatus || f.status === fbStatus); });
						return html`<${F}>
							<div class="fb-filters">
								<select class="ctr-filter" value=${fbUser} onChange=${function (e) { setFbUser(e.target.value); }}>${userOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}</select>
								<select class="ctr-filter" value=${fbStatus} onChange=${function (e) { setFbStatus(e.target.value); }}>${statusOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}</select>
							</div>
							${filtered.length === 0 ? html`<p class="muted">No reports match.</p>` : filtered.map(function (f) {
								return html`<${FeedbackRow} key=${f.id} f=${f} meta=${data} onSaved=${function (b) { setData(b); }} />`;
							})}
						<//>`;
					})() : (data.feedback.length === 0 ? html`<p class="muted">No feedback yet.</p>` : data.feedback.map(function (f) {
						return html`<${FeedbackRow} key=${f.id} f=${f} meta=${data} onSaved=${function (b) { setData(b); }} />`;
					}))}
				</div>
			</div>
		</div>`;
	}
	function FeedbackRow(props) {
		var f = props.f, meta = props.meta;
		var es = useState(false), open = es[0], setOpen = es[1];
		var st = useState(f.status), status = st[0], setStatus = st[1];
		var ns = useState(f.admin_note || ''), note = ns[0], setNote = ns[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		function save() {
			setSaving(true);
			api('feedback/' + f.id, { method: 'POST', body: { status: status, admin_note: note } }).then(function (r) { setSaving(false); if (r.ok && r.body && r.body.ok) { setOpen(false); props.onSaved(r.body); } });
		}
		var statusOpts = Object.keys(meta.statuses).map(function (k) { return [k, meta.statuses[k]]; });
		return html`<div class="fb-row">
			<div class="fb-head">
				<div><strong>${f.subject}</strong>${meta.is_super ? html` <span class="fb-who">${f.user_name} · ${f.user_role || ''}</span>` : null}<div class="fb-meta">${meta.categories[f.category] || f.category} · ${meta.severities[f.severity] || f.severity} · ${(f.created_at || '').substring(0, 10)}</div></div>
				<span class=${statusClass(f.status)}>${meta.statuses[f.status] || f.status}</span>
			</div>
			${f.scenario ? html`<div class="fb-scenario">Scenario: ${f.scenario}</div>` : null}
			<div class="fb-msg">${f.message}</div>
			${f.admin_note ? html`<div class="fb-note"><strong>Admin note:</strong> ${f.admin_note}</div>` : null}
			${meta.is_super ? html`<div class="fb-admin">
				${open ? html`<div class="fb-edit">
					<${Sel} label="Status" value=${status} onChange=${setStatus} options=${statusOpts} />
					<${Area} label="Admin note" rows=${2} value=${note} onChange=${setNote} />
					<div class="formactions"><button class="btn primary sm" disabled=${saving} onClick=${save}>${saving ? 'Saving…' : 'Save'}</button> <button class="btn sm" onClick=${function () { setOpen(false); }}>Cancel</button></div>
				</div>` : html`<button class="btn sm" onClick=${function () { setOpen(true); }}>Update status</button>`}
			</div>` : null}
		</div>`;
	}

	/* ---------------- Activity log ---------------- */
	var LOG_ENTITY = { session: 'Login', account: 'Account', estimate: 'Lead', feedback: 'Feedback', scenario: 'Testing', centre: 'Centre', fee_schedule: 'Fees', promotion: 'Promotion', brand: 'Brand', manager: 'User' };
	var LOG_ACTION = { login: 'Logged in', create: 'Created', update: 'Updated', delete: 'Deleted', deactivate: 'Deactivated', assign: 'Assigned', remove: 'Removed', set_password: 'Set password', status: 'Status changed', submit: 'Submitted', review: 'Reviewed', pass: 'Marked works', issue: 'Reported issue', clear: 'Unmarked' };
	function logActClass(a) {
		if (['create', 'login', 'submit', 'assign', 'pass'].indexOf(a) !== -1) { return 'st-enrolled'; }
		if (['delete', 'remove', 'deactivate', 'issue'].indexOf(a) !== -1) { return 'st-lost'; }
		if (['status', 'review', 'clear'].indexOf(a) !== -1) { return 'st-contacted'; }
		return 'st-new';
	}
	function LogView() {
		var ds = useState(null), data = ds[0], setData = ds[1];
		var fs = useState({ user_id: '', entity: '', action: '', search: '' }), flt = fs[0], setFlt = fs[1];
		var ls = useState(200), limit = ls[0], setLimit = ls[1];
		useEffect(function () {
			var q = 'admin/audit?limit=' + limit + '&user_id=' + (flt.user_id || '') + '&entity=' + encodeURIComponent(flt.entity) + '&action=' + encodeURIComponent(flt.action) + '&search=' + encodeURIComponent(flt.search);
			api(q).then(function (r) { setData(r.body); });
		}, [flt, limit]);
		if (!data) { return html`<${Loader} label="Loading activity log…" />`; }
		function upFlt(k, v) { setLimit(200); setFlt(Object.assign({}, flt, kv(k, v))); }
		var userOpts = [['', 'All users']].concat((data.actors || []).map(function (a) { return [String(a.id), a.name]; }));
		var entOpts = [['', 'All areas']].concat((data.entities || []).map(function (e) { return [e, LOG_ENTITY[e] || e]; }));
		var actOpts = [['', 'All actions']].concat((data.actions || []).map(function (a) { return [a, LOG_ACTION[a] || a]; }));
		return html`<div>
			<h1 class="page-h">Activity log</h1>
			<div class="card">
				<p class="muted mini" style=${{ margin: '0 0 12px' }}>Every action by every portal user (centre managers, area managers and admins), most recent first. Showing ${data.logs.length} of ${data.total}.</p>
				<div class="log-filters">
					<select class="ctr-filter" value=${flt.user_id} onChange=${function (e) { upFlt('user_id', e.target.value); }}>${userOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}</select>
					<select class="ctr-filter" value=${flt.entity} onChange=${function (e) { upFlt('entity', e.target.value); }}>${entOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}</select>
					<select class="ctr-filter" value=${flt.action} onChange=${function (e) { upFlt('action', e.target.value); }}>${actOpts.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}</select>
					<input class="ctr-filter log-search" type="search" placeholder="Search…" value=${flt.search} onInput=${function (e) { upFlt('search', e.target.value); }} />
				</div>
			</div>
			<div class="tablewrap"><table class="tbl">
				<thead><tr><th>When</th><th>User</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
				<tbody>${data.logs.length === 0 ? html`<tr><td colspan="5" class="empty">No activity matches.</td></tr>` : data.logs.map(function (l) {
					return html`<tr key=${l.id}>
						<td class="log-when">${(l.when || '').replace('T', ' ')}</td>
						<td><strong>${l.user}</strong></td>
						<td><span class=${'badge ' + logActClass(l.action)}>${LOG_ACTION[l.action] || l.action}</span></td>
						<td>${LOG_ENTITY[l.entity] || l.entity}${l.entity_id ? html` <code>#${l.entity_id}</code>` : null}</td>
						<td class="muted log-detail">${l.detail}</td></tr>`;
				})}</tbody></table></div>
			${data.logs.length < data.total ? html`<div class="log-more"><button class="btn" onClick=${function () { setLimit(limit + 200); }}>Load more</button></div>` : null}
		</div>`;
	}

	/* ---------------- App shell ---------------- */
	function App() {
		var ms = useState(null), me = ms[0], setMe = ms[1];
		var aS = useState('loading'), auth = aS[0], setAuth = aS[1]; // loading | login | noaccess | ok
		var initHash = (window.location.hash || '').replace(/^#/, '');
		var vs = useState({ name: ['dashboard', 'calculator', 'estimates', 'testing', 'feedback', 'settings'].indexOf(initHash) !== -1 ? initHash : 'dashboard' }), view = vs[0], setView = vs[1];
		var umS = useState(false), menuOpen = umS[0], setMenuOpen = umS[1];
		var mmS = useState(false), mobMenu = mmS[0], setMobMenu = mmS[1];
		var trS = useState(false), tourOpen = trS[0], setTourOpen = trS[1];
		useEffect(function () {
			api('me').then(function (r) {
				if (r.ok && r.body && r.body.is_super !== undefined) { setMe(r.body); setAuth('ok'); if (!r.body.tour_seen) { setTourOpen(true); } }
				else if (r.status === 403) { setAuth('noaccess'); }
				else { setAuth('login'); }
			});
		}, []);
		function markTourSeen() { setMe(function (m) { return Object.assign({}, m, { tour_seen: true }); }); api('onboarding/seen', { method: 'POST' }); }
		// The tour auto-opens only for a first-time user; once closed it is marked
		// seen and never auto-opens again (it can still be replayed via "How it works").
		function closeTour() { setTourOpen(false); markTourSeen(); }
		if (auth === 'loading') { return html`<${Loader} label="Loading portal…" />`; }
		if (auth === 'login') { return html`<${Login} />`; }
		if (auth === 'noaccess') { return html`<${NoAccess} />`; }
		if (!me) { return html`<${Loader} label="Loading…" />`; }

		var caps = me.caps || {};
		var groups = [{ title: 'Overview', items: [{ k: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { k: 'calculator', label: 'New calculation', icon: 'plus' }, { k: 'estimates', label: 'Saved estimates', icon: 'estimates' }] }];
		groups.push({ title: 'Quality', items: [{ k: 'testing', label: 'Testing scenarios', icon: 'testing' }, { k: 'feedback', label: 'Feedback', icon: 'feedback' }] });
		// Centres & fees and Promotions are visible to everyone (read-only for centre
		// managers). Brands and Users stay portal-admin only.
		var manage = [{ k: 'centres', label: 'Centres & fees', icon: 'centres' }, { k: 'promotions', label: 'Promotions', icon: 'promotions' }];
		if (caps.manage_portal) { manage.push({ k: 'brands', label: 'Brands', icon: 'brands' }, { k: 'users', label: 'Users', icon: 'users' }, { k: 'log', label: 'Activity log', icon: 'log' }); }
		groups.push({ title: 'Manage', items: manage });

		var body;
		switch (view.name) {
			case 'calculator': body = html`<${Calculator} editId=${view.editId || 0} onSaved=${function (id) { setView({ name: 'detail', id: id }); }} onCancelEdit=${function () { setView(view.editId ? { name: 'detail', id: view.editId } : { name: 'estimates' }); }} />`; break;
			case 'detail': body = html`<${Detail} id=${view.id} onBack=${function () { setView({ name: 'estimates' }); }} onEdit=${function () { setView({ name: 'calculator', editId: view.id }); }} />`; break;
			case 'estimates': body = html`<${Estimates} onOpen=${function (id) { setView({ name: 'detail', id: id }); }} />`; break;
			case 'centres': body = html`<${CentresView} caps=${caps} />`; break;
			case 'promotions': body = html`<${PromotionsView} caps=${caps} />`; break;
			case 'brands': body = html`<${BrandsView} />`; break;
			case 'users': body = html`<${UsersView} />`; break;
			case 'log': body = html`<${LogView} />`; break;
			case 'testing': body = html`<${TestingView} caps=${caps} onReport=${function (s) { setView({ name: 'feedback', scenario: s }); }} />`; break;
			case 'feedback': body = html`<${FeedbackView} initialScenario=${view.scenario || ''} />`; break;
			case 'settings': body = html`<${Settings} me=${me} onUpdated=${function (u) { setMe(Object.assign({}, me, { name: u.name, email: u.email })); }} />`; break;
			default: body = html`<${Dashboard} onStartTour=${function () { setTourOpen(true); }} />`;
		}
		var activeKey = view.name === 'detail' ? 'estimates' : view.name;
		var initials = (me.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();

		return html`<div class="shell">
			<aside class="side">
				<div class="brand"><span class="mark"><${I9Mark} h=${22} /></span><div><strong>CCS Portal</strong><span>${me.role_label || (me.is_super ? 'Portal admin' : 'Centre manager')}</span></div></div>
				<div class="navscroll">
				${groups.map(function (g) {
					return html`<div class="navgroup" key=${g.title}><span class="navtitle">${g.title}</span>
						${g.items.map(function (n) { return html`<button key=${n.k} data-tour=${n.k} class=${'navbtn' + (activeKey === n.k ? ' active' : '')} onClick=${function () { setView({ name: n.k }); }}><span class="navi"><${Icon} name=${n.icon} size=${17} /></span>${n.label}</button>`; })}
					</div>`;
				})}
				</div>
				<div class="who"><span class="uc-avatar dark">${initials}</span><div><strong>${me.name}</strong><span>${me.centres.length} centre${me.centres.length === 1 ? '' : 's'}</span></div></div>
			</aside>
			<div class="main">
				<header class="topbar">
					<h2 class="topbar-title">${view.name === 'calculator' && view.editId ? 'Edit estimate' : (SECTION_TITLE[view.name] || 'Portal')}</h2>
					<div class="topbar-actions">
						<button class="btn primary" onClick=${function () { setView({ name: 'calculator' }); }}><span class="btni"><${Icon} name="plus" size=${16} /></span> New calculation</button>
						<div class="userchip-wrap" data-tour="settings">
							<button class="userchip" onClick=${function () { setMenuOpen(!menuOpen); }}>
								<span class="uc-avatar">${initials}</span>
								<div class="uc-meta"><strong>${me.name}</strong><span>${me.role_label || (me.is_super ? 'Portal admin' : 'Manager')}</span></div>
								<span class="uc-caret">▾</span>
							</button>
							${menuOpen ? html`<${F}>
								<div class="um-overlay" onClick=${function () { setMenuOpen(false); }}></div>
								<div class="usermenu">
									<div class="um-head"><strong>${me.name}</strong><span>${me.email}</span></div>
									<button class="um-item" onClick=${function () { setMenuOpen(false); setView({ name: 'settings' }); }}>Settings & password</button>
									<button class="um-item danger" onClick=${doLogout}>Log out</button>
								</div>
							<//>` : null}
						</div>
					</div>
				</header>
				<div class="content">${body}</div>
			</div>
			${tourOpen ? html`<${PortalTour} caps=${me.caps || {}} onDone=${closeTour} />` : null}
			<nav class="mobnav">
				${[{ k: 'dashboard', label: 'Home', icon: 'dashboard' }, { k: 'estimates', label: 'Leads', icon: 'estimates' }, { k: 'calculator', label: 'New', icon: 'plus' }, { k: 'testing', label: 'Testing', icon: 'testing' }].map(function (n) {
					return html`<button key=${n.k} class=${'mobtab' + (activeKey === n.k ? ' active' : '')} onClick=${function () { setMobMenu(false); setView({ name: n.k }); }}><span class="mobtab-i"><${Icon} name=${n.icon} size=${21} /></span><span class="mobtab-l">${n.label}</span></button>`;
				})}
				<button class=${'mobtab' + (mobMenu ? ' active' : '')} onClick=${function () { setMobMenu(!mobMenu); }}><span class="mobtab-i"><${Icon} name="menu" size=${21} /></span><span class="mobtab-l">More</span></button>
			</nav>
			${mobMenu ? html`<${F}>
				<div class="mobsheet-overlay" onClick=${function () { setMobMenu(false); }}></div>
				<div class="mobsheet">
					<div class="mobsheet-grip"></div>
					<div class="mobsheet-user"><span class="uc-avatar">${initials}</span><div><strong>${me.name}</strong><span>${me.role_label || (me.is_super ? 'Portal admin' : 'Manager')}</span></div></div>
					${groups.map(function (g) {
						return html`<div class="mobsheet-group" key=${g.title}><span class="mobsheet-title">${g.title}</span>
							${g.items.map(function (n) { return html`<button key=${n.k} class=${'mobsheet-item' + (activeKey === n.k ? ' active' : '')} onClick=${function () { setMobMenu(false); setView({ name: n.k }); }}><${Icon} name=${n.icon} size=${18} /> ${n.label}</button>`; })}
						</div>`;
					})}
					<div class="mobsheet-group">
						<button class="mobsheet-item" onClick=${function () { setMobMenu(false); setView({ name: 'settings' }); }}><${Icon} name="settings" size=${18} /> Settings & password</button>
						<button class="mobsheet-item danger" onClick=${doLogout}><${Icon} name="log" size=${18} /> Log out</button>
					</div>
				</div>
			<//>` : null}
		</div>`;
	}

	function boot() { var root = document.getElementById('ccsp-app-root'); if (root) { ReactDOM.createRoot(root).render(html`<${App} />`); } }
	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
