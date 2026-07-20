<?php
namespace CCSPortal\Rest;

use CCSPortal\Install;
use CCSPortal\Data\Repo;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * REST API for the manager calculator.
 *
 * All subsidy maths is delegated to the shared CCS engine
 * (CCSCalculator\Includes\Calculator\CCSEngine) so the portal and the public
 * calculator can never diverge. This layer only resolves centre fees, prices
 * promotions on top of the engine result, and persists estimates.
 */
class Api {

    const NS = 'ccsp/v1';

    public function register() {
        add_action('rest_api_init', [$this, 'routes']);
    }

    public function routes() {
        register_rest_route(self::NS, '/calculate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'calculate'],
            'permission_callback' => [$this, 'can_use'],
        ]);
        register_rest_route(self::NS, '/estimate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'save_estimate'],
            'permission_callback' => [$this, 'can_use'],
        ]);
    }

    public function can_use() {
        return is_user_logged_in() && current_user_can('ccsp_use_portal');
    }

    /* ------------------------------------------------------------------ */

    public function calculate(WP_REST_Request $req) {
        if (!class_exists(CCSP_ENGINE_CLASS)) {
            return new WP_Error('ccsp_no_engine', 'The CCS calculation engine is unavailable. Activate the Child Care Subsidy Calculator plugin.', ['status' => 500]);
        }

        $centre_id = (int) $req->get_param('centre_id');
        if (!$centre_id || !Repo::can_access_centre($centre_id)) {
            return new WP_Error('ccsp_forbidden_centre', 'You do not have access to that centre.', ['status' => 403]);
        }
        $centre = Repo::centre($centre_id);
        $schedule = Repo::current_schedule($centre_id);
        $tiers = $schedule ? Repo::tiers($schedule->id) : [];
        $tier_rate = [];
        foreach ($tiers as $t) {
            $tier_rate[(int) $t->days] = (float) $t->daily_rate;
        }

        $rate_basis = in_array($req->get_param('rate_basis'), ['standard', 'weekly', 'windback'], true)
            ? $req->get_param('rate_basis') : 'standard';
        $period = in_array($req->get_param('period'), ['week', 'fortnight', 'month', 'year'], true)
            ? $req->get_param('period') : 'week';

        $knows_ccs = (bool) $req->get_param('knows_ccs');
        $income    = (float) $req->get_param('income');
        $activity  = (float) $req->get_param('activity_hours');
        $is_atsi   = (bool) $req->get_param('is_atsi');
        // Withholding is sent as a whole percent (5, 4 … 0); default 5%.
        $withhold_whole = $req->get_param('withholding');
        $withhold = ($withhold_whole === null || $withhold_whole === '') ? 0.05 : ((float) $withhold_whole) / 100;

        // A "sibling discount" promotion reduces the daily fee for the 2nd+
        // child before subsidy, so CCS is recalculated on the reduced fee.
        $sibling_pct = $this->sibling_pct_for((int) $req->get_param('promotion_id'), $centre_id);

        // Build per-child engine input, resolving each child's daily fee.
        $children_in = [];
        $sibling_flags = [];
        $index = 0;
        foreach ((array) $req->get_param('children') as $child) {
            $days1 = max(0, (int) ($child['days_week1'] ?? 0));
            $days2 = max(0, (int) ($child['days_week2'] ?? 0));
            $hours = (float) ($child['hours_per_day'] ?? 0);
            $dob   = sanitize_text_field($child['dob'] ?? '');

            $override = isset($child['fee_override']) && $child['fee_override'] !== '' ? (float) $child['fee_override'] : null;
            $fee = $override !== null
                ? $override
                : $this->resolve_daily_fee($schedule, $tier_rate, $rate_basis, max($days1, $days2), $index);

            $is_sibling = ($sibling_pct > 0 && $index >= 1 && $override === null);
            if ($is_sibling) {
                $fee = round($fee * (1 - $sibling_pct / 100), 2);
            }

            $children_in[] = [
                'dob'           => $dob,
                'care_type'     => 'cbdc',
                'hours_per_day' => $hours,
                'fee_per_day'   => $fee,
                'days_week1'    => $days1,
                'days_week2'    => $days2,
            ];
            $sibling_flags[] = $is_sibling;
            $index++;
        }

        $engine_class = CCSP_ENGINE_CLASS;
        $engine = new $engine_class(get_option('childcare_ccs_policy', []));

        $engine_input = [
            'knows_ccs'       => $knows_ccs,
            'income'          => $income,
            'activity_hours'  => $activity,
            'withholding_pct' => $withhold,
            'is_atsi'         => $is_atsi,
            'children'        => $children_in,
        ];
        if ($knows_ccs) {
            $known = (float) $req->get_param('known_pct'); // whole percent (first child)
            // Higher rate is auto-derived from the standard, exactly as the
            // public calculator does (readonly "additional children" field).
            $engine_input['standard_pct'] = $known / 100;
            $engine_input['higher_pct']   = $engine->calculate_higher_from_standard($known) / 100;
        }

        $result = $engine->calculate($engine_input);

        $tf = $result['totals'];
        $totals_fortnight = [
            'fee'          => (float) $tf['fortnightFee'],
            'subsidy'      => (float) $tf['fortnightSub'],
            'subsidy_full' => (float) $tf['fortnightSubBeforeWithholding'],
            'gap'          => (float) $tf['outPocket'],
            'withholding'  => (float) $tf['withholding'],
        ];

        // Promotion pricing, applied to the parent GAP, after subsidy.
        $promo = $this->price_promotion(
            (int) $req->get_param('promotion_id'),
            $centre_id,
            $totals_fortnight['gap']
        );

        // Scale to the requested display period.
        $mult = ['week' => 0.5, 'fortnight' => 1, 'month' => 26 / 12, 'year' => 26][$period];
        $totals_period = [
            'fee'          => $totals_fortnight['fee'] * $mult,
            'subsidy'      => $totals_fortnight['subsidy'] * $mult,
            'subsidy_full' => $totals_fortnight['subsidy_full'] * $mult,
            'gap'          => $totals_fortnight['gap'] * $mult,
            'withholding'  => $totals_fortnight['withholding'] * $mult,
        ];
        // Ongoing promo saving scaled to the display period, and total offer value.
        $promo_period_saving = 0.0;
        if ($promo && $promo['ongoing']) {
            $promo_period_saving = $promo['weekly_saving'] / 0.5 * $mult; // weekly → period
        }
        $gap_after_period = max(0, $totals_period['gap'] - $promo_period_saving);

        // Per-child summary for the breakdown panel.
        $children_out = [];
        foreach ($result['children'] as $i => $c) {
            $children_out[] = [
                'age'          => (int) $c['age'],
                'feePerDay'    => (float) $c['feePerDay'],
                'hoursPerDay'  => (float) $c['hoursPerDay'],
                'daysWeek1'    => (int) $c['daysWeek1'],
                'daysWeek2'    => (int) $c['daysWeek2'],
                'fortnightFee' => (float) $c['fortnightFee'],
                'fortnightSub' => (float) $c['fortnightSub'],
                'subFull'      => (float) $c['fortnightSubBeforeWithholding'],
                'withholding'  => (float) ($c['week1Withholding'] + $c['week2Withholding']),
                'gap'          => (float) $c['outPocket'],
                'ccs_pct'      => round($c['ccs_pct'] * 100, 2),
                'isHigher'     => (bool) $c['isHigherCCS'],
                'sibling'      => !empty($sibling_flags[$i]),
                'hourlyFee'    => (float) $c['hourlyFee'],
                'hourlyCap'    => (float) $c['hourlyCap'],
                'effRate'      => (float) min($c['hourlyFee'], $c['hourlyCap']),
                'hourlyCCS'    => (float) $c['hourlyCCSAmount'],
            ];
        }

        return new WP_REST_Response([
            'ok'     => true,
            'centre' => [
                'id'     => (int) $centre->id,
                'name'   => $centre->name,
                'code'   => $centre->code,
            ],
            'ccs' => [
                'standard_pct'          => round($result['standard_pct'] * 100, 2),
                'higher_pct'            => round($result['higher_pct'] * 100, 2),
                'hours_per_fortnight'   => (int) $result['ccs_hours_per_fortnight'],
            ],
            'children'            => $children_out,
            'totals_fortnight'    => $totals_fortnight,
            'period'              => $period,
            'totals_period'       => $totals_period,
            'promo'               => $promo,
            'promo_period_saving' => round($promo_period_saving, 2),
            'net_period_gap'      => $gap_after_period,
            'compare'             => $this->build_compare(
                $engine, $schedule, $tier_rate, $rate_basis,
                [
                    'knows'    => $knows_ccs,
                    'income'   => $income,
                    'known'    => (float) $req->get_param('known_pct'),
                    'activity' => $activity,
                    'withhold' => $withhold,
                    'atsi'     => $is_atsi,
                ],
                (array) $req->get_param('children'),
                $centre_id
            ),
        ], 200);
    }

    /**
     * Resolve a single day's fee from the centre schedule.
     */
    private function resolve_daily_fee($schedule, array $tier_rate, $basis, $days, $index = 0) {
        if (!$schedule) {
            return 0.0;
        }
        if ($basis === 'weekly')   { return (float) $schedule->weekly_rate; }
        if ($basis === 'windback') { return (float) $schedule->windback_rate; }
        // Standard basis: the exact daily fee for this attendance-day count
        // (1–5 day fee). Falls back to the full (1-day) fee if not configured.
        if ($days >= 1 && isset($tier_rate[$days])) {
            return (float) $tier_rate[$days];
        }
        return (float) $schedule->full_daily_fee;
    }

    /**
     * Run one what-if scenario through the shared engine and return weekly
     * figures. Used to build the on-screen comparison of attendance patterns
     * and promotions so a parent can see every option at once.
     */
    private function run_scenario($engine, $schedule, $tier_rate, $rate_basis, array $flags, array $children_param, $promo_id, $centre_id) {
        $sibling_pct = $this->sibling_pct_for($promo_id, $centre_id);
        $children_in = [];
        $index = 0;
        foreach ($children_param as $child) {
            $days1 = max(0, (int) ($child['days_week1'] ?? 0));
            $days2 = max(0, (int) ($child['days_week2'] ?? 0));
            $hours = (float) ($child['hours_per_day'] ?? 0);
            $dob   = sanitize_text_field($child['dob'] ?? '');
            $override = isset($child['fee_override']) && $child['fee_override'] !== '' ? (float) $child['fee_override'] : null;
            $fee = $override !== null ? $override : $this->resolve_daily_fee($schedule, $tier_rate, $rate_basis, max($days1, $days2), $index);
            if ($sibling_pct > 0 && $index >= 1 && $override === null) { $fee = round($fee * (1 - $sibling_pct / 100), 2); }
            $children_in[] = ['dob' => $dob, 'care_type' => 'cbdc', 'hours_per_day' => $hours, 'fee_per_day' => $fee, 'days_week1' => $days1, 'days_week2' => $days2];
            $index++;
        }
        $input = ['knows_ccs' => $flags['knows'], 'income' => $flags['income'], 'activity_hours' => $flags['activity'], 'withholding_pct' => $flags['withhold'], 'is_atsi' => $flags['atsi'], 'children' => $children_in];
        if ($flags['knows']) {
            $input['standard_pct'] = $flags['known'] / 100;
            $input['higher_pct']   = $engine->calculate_higher_from_standard($flags['known']) / 100;
        }
        $r = $engine->calculate($input);
        $t = $r['totals'];
        $weekly_fee = $t['fortnightFee'] / 2;
        $weekly_gap = $t['outPocket'] / 2;
        $promo = $this->price_promotion($promo_id, $centre_id, (float) $t['outPocket']);
        $weekly_after = $weekly_gap - ($promo && $promo['ongoing'] ? $promo['weekly_saving'] : 0);
        return [
            'weekly_fee'       => round($weekly_fee, 2),
            'weekly_gap'       => round($weekly_gap, 2),
            'weekly_gap_after' => round(max(0, $weekly_after), 2),
            'promo'            => $promo,
        ];
    }

    /**
     * Build the comparison + best-value data. Each pricing structure is
     * evaluated INDEPENDENTLY:
     *   - by_days:  attendance packages (2/3/4/5), always the standard/package
     *               day-rates, never affected by the selected fee basis.
     *   - by_basis: standard daily vs weekly vs WindBack, each on its own rate.
     *   - by_promo: every offer on the currently-selected basis.
     *   - best:     the single cheapest (basis × promo) combination.
     */
    private function build_compare($engine, $schedule, $tier_rate, $rate_basis, array $flags, array $children_param, $centre_id) {
        if (empty($children_param)) {
            return ['by_days' => [], 'by_basis' => [], 'by_promo' => [], 'best' => null];
        }

        // Attendance packages, ALWAYS standard/package pricing (independent of basis).
        $by_days = [];
        foreach ([1, 2, 3, 4, 5] as $d) {
            $cp = array_map(function ($c) use ($d) {
                $c['days_week1'] = $d; $c['days_week2'] = $d; $c['fee_override'] = '';
                return $c;
            }, $children_param);
            $s = $this->run_scenario($engine, $schedule, $tier_rate, 'standard', $flags, $cp, 0, $centre_id);
            $by_days[] = ['days' => $d, 'weekly_fee' => $s['weekly_fee'], 'weekly_gap' => $s['weekly_gap']];
        }

        // Grid: fee basis × each promotion (incl. none) at the actual attendance.
        // Only the day-tier ("standard") basis is offered; weekly/WindBack pricing
        // was retired, so those bases are no longer computed or compared.
        $bases = ['standard' => 'Standard daily'];
        $promo_list = Repo::promotions_for_centre($centre_id);
        $grid = [];
        foreach ($bases as $b => $bl) {
            $none = $this->run_scenario($engine, $schedule, $tier_rate, $b, $flags, $children_param, 0, $centre_id);
            $grid[$b][0] = ['promo_id' => 0, 'promo_name' => 'No offer', 'weekly_fee' => $none['weekly_fee'], 'weekly_gap' => $none['weekly_gap_after'], 'oneoff' => 0];
            foreach ($promo_list as $p) {
                $s = $this->run_scenario($engine, $schedule, $tier_rate, $b, $flags, $children_param, (int) $p->id, $centre_id);
                $grid[$b][(int) $p->id] = ['promo_id' => (int) $p->id, 'promo_name' => $p->name, 'weekly_fee' => $s['weekly_fee'], 'weekly_gap' => $s['weekly_gap_after'], 'oneoff' => $s['promo'] ? ($s['promo']['oneoff'] ?? 0) : 0];
            }
        }

        $by_basis = [];
        foreach ($bases as $b => $bl) {
            $by_basis[] = ['basis' => $b, 'label' => $bl, 'weekly_fee' => $grid[$b][0]['weekly_fee'], 'weekly_gap' => $grid[$b][0]['weekly_gap']];
        }

        $sel = isset($grid[$rate_basis]) ? $rate_basis : 'standard';
        $ref_sel = $grid[$sel][0]['weekly_gap'];
        $by_promo = [];
        foreach ($grid[$sel] as $pid => $g) {
            $by_promo[] = ['id' => $pid, 'name' => $g['promo_name'], 'weekly_gap' => $g['weekly_gap'], 'weekly_saving' => round(max(0, $ref_sel - $g['weekly_gap']), 2), 'oneoff' => $g['oneoff']];
        }

        // Best value across every basis × promo combo (lowest recurring gap; tie → bigger one-off).
        $best = null;
        $reference = $grid['standard'][0]['weekly_gap'];
        foreach ($bases as $b => $bl) {
            foreach ($grid[$b] as $g) {
                $better = $best === null
                    || $g['weekly_gap'] < $best['weekly_gap'] - 0.001
                    || (abs($g['weekly_gap'] - $best['weekly_gap']) < 0.001 && $g['oneoff'] > $best['oneoff']);
                if ($better) {
                    $best = ['basis' => $b, 'basis_label' => $bl, 'promo_id' => $g['promo_id'], 'promo_name' => $g['promo_name'], 'weekly_gap' => $g['weekly_gap'], 'oneoff' => $g['oneoff']];
                }
            }
        }
        if ($best !== null) {
            $best['weekly_saving'] = round(max(0, $reference - $best['weekly_gap']), 2);
        }

        return ['by_days' => $by_days, 'by_basis' => $by_basis, 'by_promo' => $by_promo, 'best' => $best];
    }

    /** Sibling-discount percentage of the selected promotion (0 if not a sibling promo). */
    private function sibling_pct_for($promo_id, $centre_id) {
        if (!$promo_id) {
            return 0.0;
        }
        foreach (Repo::promotions_for_centre($centre_id) as $p) {
            if ((int) $p->id === (int) $promo_id && $p->unit === 'sibling') {
                return max(0, (float) $p->value);
            }
        }
        return 0.0;
    }

    /** How often a "weeks free" offer grants a free week (every Nth week). */
    const FREE_WEEK_INTERVAL = 5;

    private static function money($n) {
        return '$' . number_format((float) $n, 2);
    }

    /**
     * Price a promotion against the fortnightly gap.
     * CCS is always computed on the gross fee; promotions only reduce the gap.
     *
     * @return array|null
     */
    private function price_promotion($promo_id, $centre_id, $fortnight_gap) {
        if (!$promo_id) {
            return null;
        }
        // Only allow promotions actually valid for this centre.
        $valid = false;
        foreach (Repo::promotions_for_centre($centre_id) as $p) {
            if ((int) $p->id === (int) $promo_id) {
                $promo = $p;
                $valid = true;
                break;
            }
        }
        if (!$valid) {
            return null;
        }

        $weekly_gap = $fortnight_gap / 2;
        $value = (float) $promo->value;
        $ongoing = false;
        $weekly_saving = 0.0;
        $total_value = 0.0;
        $oneoff = 0.0;
        $desc = '';

        $n = rtrim(rtrim(number_format($value, 2), '0'), '.');
        switch ($promo->unit) {
            case 'weeks':
                // "N weeks free" delivered as one free week every Nth week
                // (e.g. the 5th, 10th, 15th, 20th week). Amortised, that is an
                // ongoing reduction of the gap of 1/INTERVAL per week; the total
                // offer value is N free weeks of the gap.
                $ongoing = true;
                $weekly_saving = $weekly_gap / self::FREE_WEEK_INTERVAL;
                $total_value = $value * $weekly_gap;
                $desc = $n . ' weeks free, 1 free week every ' . self::FREE_WEEK_INTERVAL
                    . ' weeks (' . self::money($weekly_saving) . '/wk effective, ' . self::money($total_value) . ' total value)';
                break;
            case 'percent':
                $ongoing = true;
                $weekly_saving = $weekly_gap * ($value / 100);
                $total_value = $weekly_saving * 52;
                $desc = $n . '% off the parent gap (' . self::money($weekly_saving) . '/wk)';
                break;
            case 'amount':
                $ongoing = true;
                $weekly_saving = min($weekly_gap, $value);
                $total_value = $weekly_saving * 52;
                $desc = self::money($value) . ' off the weekly gap';
                break;
            case 'sibling':
                // Applied at fee level before subsidy (see sibling_pct_for). The
                // saving is already reflected in the lower gap, so no gap deduction.
                $desc = $n . '% off each additional child\'s daily fee (applied before CCS).';
                break;
            case 'oneoff':
                // One-off credit (e.g. refer a friend), subtracted once from the total.
                $oneoff = $value;
                $total_value = $value;
                $desc = self::money($value) . ' one-off credit.';
                break;
        }

        return [
            'id'            => (int) $promo->id,
            'name'          => $promo->name,
            'type'          => $promo->type,
            'unit'          => $promo->unit,
            'description'   => $desc,
            'ongoing'       => $ongoing,
            'weekly_saving' => round($weekly_saving, 2),
            'total_value'   => round($total_value, 2),
            'oneoff'        => round($oneoff, 2),
        ];
    }

    /* ------------------------------------------------------------------ */

    public function save_estimate(WP_REST_Request $req) {
        global $wpdb;
        $centre_id = (int) $req->get_param('centre_id');
        if (!$centre_id || !Repo::can_access_centre($centre_id)) {
            return new WP_Error('ccsp_forbidden_centre', 'You do not have access to that centre.', ['status' => 403]);
        }
        $inputs  = $req->get_param('inputs');
        $results = $req->get_param('results');

        $wpdb->insert(Install::table('calculations'), [
            'centre_id'    => $centre_id,
            'manager_id'   => get_current_user_id(),
            'parent_name'  => sanitize_text_field($req->get_param('parent_name')),
            'parent_email' => sanitize_email($req->get_param('parent_email')),
            'parent_phone' => sanitize_text_field($req->get_param('parent_phone')),
            'income'       => (float) $req->get_param('income'),
            'ccs_pct'      => (float) $req->get_param('ccs_pct'),
            'promotion_id' => (int) $req->get_param('promotion_id'),
            'inputs_json'  => wp_json_encode($inputs),
            'results_json' => wp_json_encode($results),
            'status'       => 'new',
            'created_at'   => current_time('mysql'),
        ]);

        return new WP_REST_Response(['ok' => true, 'id' => (int) $wpdb->insert_id], 201);
    }
}
