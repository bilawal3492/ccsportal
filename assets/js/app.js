/* Centre CCS Portal: standalone React admin (React 18 + htm, no build step).
 * Managers: Dashboard + Saved estimates (scoped).
 * Super admins: also Centres & fees, Promotions, Brands, Users, full CRUD.
 * All data via the WordPress REST API, scoped server-side by role. */
(function () {
	'use strict';
	var CFG = window.CCSP_APP || {};
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
		return html`<svg width=${p.size || 18} height=${p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">${inner}</svg>`;
	}
	var SECTION_TITLE = { dashboard: 'Dashboard', calculator: 'New calculation', estimates: 'Saved estimates', detail: 'Estimate', centres: 'Centres & fees', promotions: 'Promotions', brands: 'Brands', users: 'Users', settings: 'Settings' };

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
	function Dashboard() {
		var s = useState(null), data = s[0], setData = s[1];
		useEffect(function () { api('reports/summary').then(function (r) { setData(r.body); }); }, []);
		if (!data) { return html`<div class="loading">Loading dashboard…</div>`; }
		var c = data.counts || {};
		return html`<div>
			<h1 class="page-h">Dashboard</h1>
			<div class="kpi-row">
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Estimates</span><span class="kpi-ic ic-blue"><${Icon} name="doc" /></span></div><span class="kpi-n">${data.total}</span></div>
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Enrolled</span><span class="kpi-ic ic-green"><${Icon} name="check" /></span></div><span class="kpi-n">${c.enrolled || 0}</span></div>
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Conversion</span><span class="kpi-ic ic-amber"><${Icon} name="percent" /></span></div><span class="kpi-n">${data.conversion}%</span></div>
				<div class="kpi"><div class="kpi-top"><span class="kpi-l">Est. annual fees</span><span class="kpi-ic ic-violet"><${Icon} name="dollar" /></span></div><span class="kpi-n">${money(data.annual_fees)}</span></div>
			</div>
			<div class="grid2">
				<div class="card"><h3>Lead pipeline</h3>
					${['new', 'contacted', 'enrolled', 'lost'].map(function (k) {
						return html`<div class="pipe-row" key=${k}><span class=${'dot ' + STC[k]}></span><span class="pipe-lab">${k}</span><span class="pipe-n">${c[k] || 0}</span></div>`;
					})}
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
			${loading ? html`<div class="loading">Loading…</div>` : html`<div class="tablewrap"><table class="tbl">
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
		if (!d) { return html`<div class="loading">Loading…</div>`; }
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
			<button class="link" onClick=${props.onBack}>← Back to estimates</button>

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
	function CentresView() {
		var s = useState(null), data = s[0], setData = s[1];
		var es = useState(null), editing = es[0], setEditing = es[1]; // id | 'new' | null
		var load = useCallback(function () { api('admin/centres').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<div class="loading">Loading centres…</div>`; }
		if (editing !== null) {
			return html`<${CentreForm} id=${editing === 'new' ? null : editing} brands=${data.brands}
				onSaved=${function (b) { setData(Object.assign({}, data, { centres: b.centres })); setEditing(null); }}
				onCancel=${function () { setEditing(null); }} />`;
		}
		return html`<div>
			<div class="page-head"><h1 class="page-h">Centres & fees</h1><button class="btn primary" onClick=${function () { setEditing('new'); }}>+ Add centre</button></div>
			<div class="tablewrap"><table class="tbl">
				<thead><tr><th>Brand</th><th>Code</th><th>Centre</th><th class="num">Full daily</th><th>Status</th><th></th></tr></thead>
				<tbody>${data.centres.map(function (c) {
					return html`<tr key=${c.id}>
						<td><span class="cdot" style=${{ background: c.accent }}></span>${c.brand_name}</td>
						<td><code>${c.code}</code></td><td>${c.name}</td>
						<td class="num">${money(c.full_daily_fee)}</td>
						<td><span class=${'badge ' + (c.status === 'active' ? 'st-enrolled' : 'st-lost')}>${c.status}</span></td>
						<td><button class="btn sm" onClick=${function () { setEditing(c.id); }}>Edit</button></td></tr>`;
				})}</tbody></table></div>
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
		if (!form) { return html`<div class="loading">Loading…</div>`; }
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
	function PromotionsView() {
		var s = useState(null), data = s[0], setData = s[1];
		var es = useState(null), editing = es[0], setEditing = es[1];
		var load = useCallback(function () { api('admin/promotions').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<div class="loading">Loading promotions…</div>`; }
		if (editing !== null) {
			var current = editing === 'new' ? null : data.promotions.filter(function (p) { return p.id === editing; })[0];
			return html`<${PromotionForm} promo=${current} brands=${data.brands} centres=${data.centres} types=${data.promo_types}
				onSaved=${function (b) { setData(Object.assign({}, data, { promotions: b.promotions })); setEditing(null); }} onCancel=${function () { setEditing(null); }} />`;
		}
		return html`<div>
			<div class="page-head"><h1 class="page-h">Promotions</h1><button class="btn primary" onClick=${function () { setEditing('new'); }}>+ Add promotion</button></div>
			<div class="tablewrap"><table class="tbl">
				<thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Window</th><th>Status</th><th></th></tr></thead>
				<tbody>${data.promotions.length === 0 ? html`<tr><td colspan="6" class="empty">No promotions yet.</td></tr>` : data.promotions.map(function (p) {
					var val = p.unit === 'percent' ? p.value + '%' : p.unit === 'amount' ? money(p.value) : p.value + ' wks';
					var win = (p.start_date || '…') + ' → ' + (p.end_date || '…');
					return html`<tr key=${p.id}><td><strong>${p.name}</strong></td><td>${(data.promo_types[p.type] || p.type)}</td><td>${val}</td>
						<td class="muted">${(p.start_date || p.end_date) ? win : 'Always'}</td>
						<td><span class=${'badge ' + (p.status === 'active' ? 'st-enrolled' : 'st-lost')}>${p.status}</span></td>
						<td><button class="btn sm" onClick=${function () { setEditing(p.id); }}>Edit</button></td></tr>`;
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
		if (!list) { return html`<div class="loading">Loading brands…</div>`; }
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
	function UsersView() {
		var s = useState(null), data = s[0], setData = s[1];
		var load = useCallback(function () { api('admin/users').then(function (r) { setData(r.body); }); }, []);
		useEffect(function () { load(); }, []);
		if (!data) { return html`<div class="loading">Loading users…</div>`; }
		var centreItems = data.centres.map(function (c) { return { id: c.id, label: c.code }; });
		function remove(id) { if (confirm('Remove Centre Manager access for this user?')) { api('admin/managers/' + id, { method: 'DELETE' }).then(function (r) { setData(Object.assign({}, data, r.body)); }); } }
		return html`<div>
			<h1 class="page-h">Users</h1>
			<div class="grid2">
				<div class="card"><h3>Centre managers</h3>
					${data.managers.length === 0 ? html`<p class="muted">No managers yet.</p>` : data.managers.map(function (m) {
						return html`<${ManagerRow} key=${m.id} m=${m} centreItems=${centreItems} onSaved=${function (b) { setData(Object.assign({}, data, b)); }} onRemove=${function () { remove(m.id); }} />`;
					})}
				</div>
				<div><${AssignForm} data=${data} centreItems=${centreItems} onSaved=${function (b) { setData(Object.assign({}, data, b)); }} /></div>
			</div>
		</div>`;
	}
	function ManagerRow(props) {
		var m = props.m;
		var es = useState(false), open = es[0], setOpen = es[1];
		var cs = useState(m.centre_ids), sel = cs[0], setSel = cs[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		function save() { setSaving(true); api('admin/managers', { method: 'POST', body: { user_id: m.id, centre_ids: sel } }).then(function (r) { setSaving(false); setOpen(false); if (r.ok) { props.onSaved(r.body); } }); }
		var codes = props.centreItems.filter(function (c) { return m.centre_ids.indexOf(c.id) !== -1; }).map(function (c) { return c.label; }).join(', ');
		return html`<div class="mrow">
			<div class="mrow-top"><div><strong>${m.name}</strong><br/><span class="muted">${m.email}</span></div>
				<div><button class="btn sm" onClick=${function () { setOpen(!open); }}>${open ? 'Close' : 'Edit'}</button> <button class="btn sm danger" onClick=${props.onRemove}>Remove</button></div></div>
			<div class="muted mrow-centres">${codes || 'No centres'}</div>
			${open ? html`<div class="mrow-edit"><${Checks} value=${sel} onChange=${setSel} items=${props.centreItems} />
				<button class="btn primary sm" disabled=${saving} onClick=${save}>${saving ? 'Saving…' : 'Save centres'}</button></div>` : null}
		</div>`;
	}
	function AssignForm(props) {
		var mode = useState('assign'), tab = mode[0], setTab = mode[1];
		// Assign existing
		var us = useState(0), userId = us[0], setUserId = us[1];
		var cs = useState([]), sel = cs[0], setSel = cs[1];
		// Create new
		var ns = useState({ name: '', email: '', centre_ids: [] }), nf = ns[0], setNf = ns[1];
		var ss = useState(false), saving = ss[0], setSaving = ss[1];
		var errs = useState(''), err = errs[0], setErr = errs[1];
		var existingIds = props.data.managers.map(function (m) { return m.id; });
		var userOpts = [[0, 'Select a user…']].concat(props.data.assignable.filter(function (u) { return existingIds.indexOf(u.id) === -1; }).map(function (u) { return [u.id, u.name + ' (' + u.email + ')']; }));
		function assign() {
			if (!userId) { setErr('Choose a user.'); return; }
			setSaving(true); setErr('');
			api('admin/managers', { method: 'POST', body: { user_id: userId, centre_ids: sel } }).then(function (r) { setSaving(false); if (r.ok) { setUserId(0); setSel([]); props.onSaved(r.body); } });
		}
		function create() {
			if (!nf.email) { setErr('Email is required.'); return; }
			setSaving(true); setErr('');
			api('admin/users/create', { method: 'POST', body: nf }).then(function (r) { setSaving(false); if (r.ok && r.body.ok) { setNf({ name: '', email: '', centre_ids: [] }); props.onSaved(r.body); } else { setErr((r.body && r.body.message) || 'Could not create user.'); } });
		}
		return html`<div class="card"><h3>Add a manager</h3>
			<div class="tabs mini2"><button class=${'tab' + (tab === 'assign' ? ' active' : '')} onClick=${function () { setTab('assign'); }}>Existing user</button><button class=${'tab' + (tab === 'create' ? ' active' : '')} onClick=${function () { setTab('create'); }}>New user</button></div>
			${tab === 'assign' ? html`<div>
				<${Sel} label="User" value=${userId} onChange=${function (v) { setUserId(parseInt(v, 10)); }} options=${userOpts} />
				<strong class="mini">Centres</strong><div class="scrollbox"><${Checks} value=${sel} onChange=${setSel} items=${props.centreItems} /></div>
				<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${assign}>${saving ? 'Saving…' : 'Assign manager'}</button>${err ? html`<span class="formerr">${err}</span>` : null}</div>
			</div>` : html`<div>
				<${Text} label="Full name" value=${nf.name} onChange=${function (v) { setNf(Object.assign({}, nf, { name: v })); }} />
				<${Text} label="Email" type="email" value=${nf.email} onChange=${function (v) { setNf(Object.assign({}, nf, { email: v })); }} />
				<strong class="mini">Centres</strong><div class="scrollbox"><${Checks} value=${nf.centre_ids} onChange=${function (v) { setNf(Object.assign({}, nf, { centre_ids: v })); }} items=${props.centreItems} /></div>
				<p class="muted mini">The new user receives an email to set their password.</p>
				<div class="formactions"><button class="btn primary" disabled=${saving} onClick=${create}>${saving ? 'Creating…' : 'Create manager'}</button>${err ? html`<span class="formerr">${err}</span>` : null}</div>
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

	function Calculator() {
		var cs = useState(null), centres = cs[0], setCentres = cs[1];
		var fst = useState(null), f = fst[0], setF = fst[1];
		var rs = useState(null), res = rs[0], setRes = rs[1];
		var msgS = useState(''), saveMsg = msgS[0], setSaveMsg = msgS[1];
		var savS = useState(false), saving = savS[0], setSaving = savS[1];
		var ocS = useState(0), openIdx = ocS[0], setOpenIdx = ocS[1];

		useEffect(function () { api('calc/centres').then(function (r) { var list = (r.body && r.body.centres) || []; setCentres(list); if (list.length) { var d = loadDraft(); if (d && d.centre_id && list.some(function (c) { return c.id === d.centre_id; })) { setF(d); } else { setF(defaultForm(list[0].id)); } } }); }, []);
		useEffect(function () {
			if (!f || !f.centre_id) { return; }
			if (!pctReady(f)) { setRes(null); return; }
			var payload = f.not_eligible ? Object.assign({}, f, { knows_ccs: true, known_pct: 0 }) : f;
			var t = setTimeout(function () { api('calculate', { method: 'POST', body: payload }).then(function (r) { if (r.ok && r.body && r.body.ok) { setRes(r.body); } }); }, 300);
			return function () { clearTimeout(t); };
		}, [f]);
		useEffect(function () { if (f) { saveDraft(f); } }, [f]);

		if (!centres) { return html`<div class="loading">Loading calculator…</div>`; }
		if (!centres.length) { return html`<div class="card">No centre is assigned to your account.</div>`; }
		if (!f) { return html`<div class="loading">…</div>`; }

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
			api('estimate', { method: 'POST', body: { centre_id: f.centre_id, parent_name: f.parent_name, parent_email: f.parent_email, parent_phone: f.parent_phone, income: f.income, ccs_pct: res.ccs.standard_pct, promotion_id: f.promotion_id, enrol_status: f.enrol_status, start_date: f.start_date, inputs: f, results: res } })
				.then(function (r) { setSaving(false); setSaveMsg(r.ok && r.body.ok ? 'Saved as lead #' + r.body.id + '.' : 'Could not save.'); });
		}

		function resetForm() { clearDraft(); setRes(null); setSaveMsg(''); setOpenIdx(0); setF(defaultForm(centre.id)); }
		var ready = estimateReady(f);
		var missing = [];
		if (!pctReady(f)) { missing.push(f.knows_ccs ? 'Known CCS %' : 'Combined family income'); }
		if (!f.not_eligible && (f.activity_hours === '' || f.activity_hours == null)) { missing.push('Eligible hours per fortnight'); }
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
			<div class="page-head"><h1 class="page-h">New calculation</h1>
				<div class="ph-right">
					<button class="btn" onClick=${resetForm}>Reset</button>
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
						: html`<div class="formgrid">
						${f.knows_ccs ? null
							: html`<${Text} label="Standard CCS % (calc)" type="number" readOnly=${true} value=${res ? res.ccs.standard_pct : ''} onChange=${function () {}} />`}
						<${Sel} label="Eligible hours / fortnight" req=${true} value=${f.activity_hours} onChange=${function (v) { up('activity_hours', v === '' ? '' : parseFloat(v)); }} options=${[['', 'Select…'], ['0', '72 hrs (3-Day Guarantee)'], ['49', '100 hrs (48+ hrs activity / exemption)']]} />
					</div>`}
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
					<button class="btn primary calc-save" disabled=${saving || !res || !ready} onClick=${save}>${saving ? 'Saving…' : 'Save estimate'}</button>
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
				<span class="login-mark"><${Icon} name="centres" size=${26} /></span>
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
			<span class="login-mark"><${Icon} name="users" size=${26} /></span>
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

	/* ---------------- App shell ---------------- */
	function App() {
		var ms = useState(null), me = ms[0], setMe = ms[1];
		var aS = useState('loading'), auth = aS[0], setAuth = aS[1]; // loading | login | noaccess | ok
		var vs = useState({ name: 'dashboard' }), view = vs[0], setView = vs[1];
		var umS = useState(false), menuOpen = umS[0], setMenuOpen = umS[1];
		useEffect(function () {
			api('me').then(function (r) {
				if (r.ok && r.body && r.body.is_super !== undefined) { setMe(r.body); setAuth('ok'); }
				else if (r.status === 403) { setAuth('noaccess'); }
				else { setAuth('login'); }
			});
		}, []);
		if (auth === 'loading') { return html`<div class="ccsp-app-loading">Loading portal…</div>`; }
		if (auth === 'login') { return html`<${Login} />`; }
		if (auth === 'noaccess') { return html`<${NoAccess} />`; }
		if (!me) { return html`<div class="ccsp-app-loading">Loading…</div>`; }

		var groups = [{ title: 'Overview', items: [{ k: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { k: 'calculator', label: 'New calculation', icon: 'plus' }, { k: 'estimates', label: 'Saved estimates', icon: 'estimates' }] }];
		if (me.is_super) {
			groups.push({ title: 'Manage', items: [{ k: 'centres', label: 'Centres & fees', icon: 'centres' }, { k: 'promotions', label: 'Promotions', icon: 'promotions' }, { k: 'brands', label: 'Brands', icon: 'brands' }, { k: 'users', label: 'Users', icon: 'users' }] });
		}

		var body;
		switch (view.name) {
			case 'calculator': body = html`<${Calculator} />`; break;
			case 'detail': body = html`<${Detail} id=${view.id} onBack=${function () { setView({ name: 'estimates' }); }} />`; break;
			case 'estimates': body = html`<${Estimates} onOpen=${function (id) { setView({ name: 'detail', id: id }); }} />`; break;
			case 'centres': body = html`<${CentresView} />`; break;
			case 'promotions': body = html`<${PromotionsView} />`; break;
			case 'brands': body = html`<${BrandsView} />`; break;
			case 'users': body = html`<${UsersView} />`; break;
			case 'settings': body = html`<${Settings} me=${me} onUpdated=${function (u) { setMe(Object.assign({}, me, { name: u.name, email: u.email })); }} />`; break;
			default: body = html`<${Dashboard} />`;
		}
		var activeKey = view.name === 'detail' ? 'estimates' : view.name;
		var initials = (me.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();

		return html`<div class="shell">
			<aside class="side">
				<div class="brand"><span class="mark"><${Icon} name="centres" size=${18} /></span><div><strong>CCS Portal</strong><span>${me.is_super ? 'Super admin' : 'Centre manager'}</span></div></div>
				<div class="navscroll">
				${groups.map(function (g) {
					return html`<div class="navgroup" key=${g.title}><span class="navtitle">${g.title}</span>
						${g.items.map(function (n) { return html`<button key=${n.k} class=${'navbtn' + (activeKey === n.k ? ' active' : '')} onClick=${function () { setView({ name: n.k }); }}><span class="navi"><${Icon} name=${n.icon} size=${17} /></span>${n.label}</button>`; })}
					</div>`;
				})}
				</div>
				<div class="who"><span class="uc-avatar dark">${initials}</span><div><strong>${me.name}</strong><span>${me.centres.length} centre${me.centres.length === 1 ? '' : 's'}</span></div></div>
			</aside>
			<div class="main">
				<header class="topbar">
					<h2 class="topbar-title">${SECTION_TITLE[view.name] || 'Portal'}</h2>
					<div class="topbar-actions">
						<button class="btn primary" onClick=${function () { setView({ name: 'calculator' }); }}><span class="btni"><${Icon} name="plus" size=${16} /></span> New calculation</button>
						<div class="userchip-wrap">
							<button class="userchip" onClick=${function () { setMenuOpen(!menuOpen); }}>
								<span class="uc-avatar">${initials}</span>
								<div class="uc-meta"><strong>${me.name}</strong><span>${me.is_super ? 'Super admin' : 'Manager'}</span></div>
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
		</div>`;
	}

	function boot() { var root = document.getElementById('ccsp-app-root'); if (root) { ReactDOM.createRoot(root).render(html`<${App} />`); } }
	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
