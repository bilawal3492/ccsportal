/* Centre CCS Portal, front-end app.
 * No subsidy maths here: every figure comes from the shared PHP engine via
 * POST /ccsp/v1/calculate. This file only gathers input, calls the API, and
 * renders the result. */
(function () {
	'use strict';

	var CFG = window.CCSP_PORTAL || {};
	var $ = function (id) { return document.getElementById(id); };
	var centresById = {};
	(CFG.centres || []).forEach(function (c) { centresById[c.id] = c; });

	var money = function (n) {
		return '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	};

	/* ---------------- Children ---------------- */
	var childSeq = 0;
	function childTemplate(i) {
		return '' +
		'<div class="ccsp-child" data-i="' + i + '">' +
			'<div class="ccsp-child-head"><strong>Child ' + (i + 1) + '</strong>' +
				'<button type="button" class="ccsp-remove" data-remove="' + i + '" title="Remove">&times;</button></div>' +
			'<label class="fld">Date of birth<input type="date" class="c_dob"></label>' +
			'<div class="fld-row">' +
				'<label class="fld">Hours / day<input type="number" class="c_hours" min="0" max="12" step="0.5" value="10"></label>' +
				'<label class="fld">Fee override<input type="number" class="c_fee" min="0" step="0.01" placeholder="auto"></label>' +
			'</div>' +
			'<div class="fld-row">' +
				'<label class="fld">Days, week 1<input type="number" class="c_d1" min="0" max="7" step="1" value="0"></label>' +
				'<label class="fld">Days, week 2<input type="number" class="c_d2" min="0" max="7" step="1" value="0"></label>' +
			'</div>' +
		'</div>';
	}
	function addChild() {
		var wrap = document.createElement('div');
		wrap.innerHTML = childTemplate(childSeq++);
		$('ccsp-children').appendChild(wrap.firstChild);
		renumber();
		bindInputs();
	}
	function renumber() {
		var rows = $('ccsp-children').querySelectorAll('.ccsp-child');
		rows.forEach(function (row, idx) {
			row.querySelector('.ccsp-child-head strong').textContent = 'Child ' + (idx + 1);
			var rm = row.querySelector('.ccsp-remove');
			rm.style.display = rows.length > 1 ? '' : 'none';
		});
	}

	/* ---------------- Gather state ---------------- */
	function gather() {
		var children = [];
		$('ccsp-children').querySelectorAll('.ccsp-child').forEach(function (row) {
			children.push({
				dob: row.querySelector('.c_dob').value,
				hours_per_day: parseFloat(row.querySelector('.c_hours').value) || 0,
				fee_override: row.querySelector('.c_fee').value,
				days_week1: parseInt(row.querySelector('.c_d1').value, 10) || 0,
				days_week2: parseInt(row.querySelector('.c_d2').value, 10) || 0
			});
		});
		return {
			centre_id: parseInt($('ccsp-centre').value, 10) || 0,
			knows_ccs: $('knows_ccs').value === '1',
			income: parseFloat($('income').value) || 0,
			known_pct: parseFloat($('known_pct').value) || 0,
			activity_hours: parseFloat($('activity').value) || 0,
			withholding: parseFloat($('withholding').value),
			is_atsi: $('is_atsi').checked,
			rate_basis: $('rate_basis').value,
			promotion_id: parseInt($('promotion').value, 10) || 0,
			enrol_status: $('enrol_status').value,
			start_date: $('start_date').value,
			period: $('period').value,
			children: children
		};
	}

	/* ---------------- API ---------------- */
	var lastResult = null;
	function api(path, body) {
		return fetch(CFG.root + path, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
			body: JSON.stringify(body)
		}).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
	}

	var timer = null;
	function recompute() {
		clearTimeout(timer);
		timer = setTimeout(function () {
			var state = gather();
			if (!state.centre_id || !state.children.length) { return; }
			api('calculate', state).then(function (res) {
				if (!res.ok || !res.body || !res.body.ok) { return; }
				lastResult = res.body;
				render(res.body);
			});
		}, 250);
	}

	/* ---------------- Render ---------------- */
	function render(d) {
		$('sum_fee').textContent = money(d.totals_period.fee);
		$('sum_sub').textContent = '−' + money(d.totals_period.subsidy);
		$('sum_net').textContent = money(d.net_period_gap);
		$('sum_pct').textContent = (d.ccs.higher_pct > d.ccs.standard_pct ? d.ccs.standard_pct + '-' + d.ccs.higher_pct : d.ccs.standard_pct) + '%';
		$('sum_hours').textContent = d.ccs.hours_per_fortnight;
		if ($('knows_ccs').value === '1') { $('higher_display').value = d.ccs.higher_pct; }

		var promoRow = $('sum_promo_row'), chip = $('sum_promo_chip');
		if (d.promo) {
			promoRow.classList.remove('hidden');
			$('sum_promo_lab').textContent = d.promo.name;
			$('sum_promo').textContent = d.promo.ongoing ? '−' + money(d.promo.weekly_saving) + '/wk' : 'incl.';
			chip.style.display = '';
			$('sum_promo_total').textContent = money(d.promo.total_value) + (d.promo.ongoing ? '/wk' : '');
		} else {
			promoRow.classList.add('hidden');
			chip.style.display = 'none';
		}

		var html = '';
		d.children.forEach(function (c, i) {
			html += '<div class="ccsp-bd-row"><span>Child ' + (i + 1) + (c.age ? ' · ' + c.age + 'y' : '') +
				' <em>' + c.ccs_pct + '%' + (c.isHigher ? ' higher' : '') + '</em></span>' +
				'<span>' + money(c.feePerDay) + '/day → gap ' + money(c.gap) + '/ftn</span></div>';
		});
		$('sum_children').innerHTML = html;
	}

	/* ---------------- Centre / promo binding ---------------- */
	function applyCentre() {
		var c = centresById[parseInt($('ccsp-centre').value, 10)];
		if (!c) { return; }
		document.getElementById('ccsp-app').style.setProperty('--ccsp-accent', c.accent);
		$('ccsp-brand-dot').style.background = c.accent;
		$('ccsp-centre-title').textContent = c.name;
		$('ccsp-brand-name').textContent = c.brand_name;

		var sel = $('promotion');
		sel.innerHTML = '<option value="0">None</option>';
		(c.promotions || []).forEach(function (p) {
			var o = document.createElement('option');
			o.value = p.id; o.textContent = p.name;
			sel.appendChild(o);
		});
		updatePromoHint();
		recompute();
	}
	function updatePromoHint() {
		var c = centresById[parseInt($('ccsp-centre').value, 10)];
		var id = parseInt($('promotion').value, 10);
		var hint = '', terms = '';
		if (c && id) {
			(c.promotions || []).forEach(function (p) {
				if (p.id === id) {
					hint = p.unit === 'weeks' ? p.value + ' weeks free' :
						p.unit === 'percent' ? p.value + '% off the parent gap' :
						'$' + p.value + ' off the weekly gap';
					terms = p.terms || '';
				}
			});
		}
		$('promo-hint').textContent = hint;
		var wrap = $('promo-terms-wrap');
		if (terms) {
			$('promo-terms').textContent = terms;
			wrap.classList.remove('hidden');
		} else {
			$('promo-terms').textContent = '';
			wrap.classList.add('hidden');
		}
	}

	/* ---------------- Save ---------------- */
	function save() {
		var state = gather();
		if (!lastResult) { return; }
		var btn = $('ccsp-save'); btn.disabled = true;
		api('estimate', {
			centre_id: state.centre_id,
			parent_name: $('p_name').value,
			parent_email: $('p_email').value,
			parent_phone: $('p_phone').value,
			income: state.income,
			ccs_pct: lastResult.ccs.standard_pct,
			promotion_id: state.promotion_id,
			enrol_status: state.enrol_status,
			start_date: state.start_date,
			inputs: state,
			results: lastResult
		}).then(function (res) {
			btn.disabled = false;
			$('ccsp-savemsg').textContent = (res.ok && res.body.ok)
				? 'Saved as lead #' + res.body.id + '.'
				: 'Could not save. Please try again.';
		});
	}

	/* ---------------- Wiring ---------------- */
	function bindInputs() {
		document.querySelectorAll('#ccsp-app input, #ccsp-app select').forEach(function (el) {
			if (el.dataset.bound) { return; }
			el.dataset.bound = '1';
			el.addEventListener('input', onChange);
			el.addEventListener('change', onChange);
		});
	}
	function onChange(e) {
		var t = e.target;
		if (t.id === 'ccsp-centre') { applyCentre(); return; }
		if (t.id === 'knows_ccs') {
			$('income_wrap').classList.toggle('hidden', t.value === '1');
			$('known_wrap').classList.toggle('hidden', t.value !== '1');
		}
		if (t.id === 'promotion') { updatePromoHint(); }
		recompute();
	}

	function init() {
		if (!CFG.centres) { return; }
		var sel = $('ccsp-centre');
		CFG.centres.forEach(function (c) {
			var o = document.createElement('option');
			o.value = c.id; o.textContent = c.brand_name + ' · ' + c.name;
			sel.appendChild(o);
		});
		addChild();
		bindInputs();
		$('ccsp-add-child').addEventListener('click', addChild);
		$('ccsp-children').addEventListener('click', function (e) {
			if (e.target.matches('.ccsp-remove')) {
				var row = e.target.closest('.ccsp-child');
				if ($('ccsp-children').querySelectorAll('.ccsp-child').length > 1) { row.remove(); renumber(); recompute(); }
			}
		});
		$('ccsp-save').addEventListener('click', save);
		applyCentre();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
