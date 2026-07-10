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
 * REST API for the React SaaS app: identity, saved estimates (leads) and
 * reporting. All data is scoped server-side to the caller's assigned centres.
 */
class AppApi {

    const NS = 'ccsp/v1';

    public function routes() {
        $auth = [$this, 'can_use'];

        register_rest_route(self::NS, '/me', [
            'methods' => 'GET', 'callback' => [$this, 'me'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/estimates', [
            'methods' => 'GET', 'callback' => [$this, 'list_estimates'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/estimates/(?P<id>\d+)', [
            'methods' => 'GET', 'callback' => [$this, 'get_estimate'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/estimates/(?P<id>\d+)/status', [
            'methods' => 'POST', 'callback' => [$this, 'update_status'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/reports/summary', [
            'methods' => 'GET', 'callback' => [$this, 'summary'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/calc/centres', [
            'methods' => 'GET', 'callback' => [$this, 'calc_centres'], 'permission_callback' => $auth,
        ]);
    }

    /** Accessible centres with fees + promotions for the in-app calculator. */
    public function calc_centres() {
        $out = [];
        foreach (Repo::accessible_centres() as $c) {
            $out[] = Repo::centre_bootstrap($c);
        }
        return new WP_REST_Response(['centres' => $out], 200);
    }

    public function can_use() {
        return is_user_logged_in() && current_user_can('ccsp_use_portal');
    }

    private function is_super() {
        return current_user_can('ccsp_manage_portal') || current_user_can('manage_options');
    }

    /* ------------------------------------------------------------------ */

    public function me() {
        $centres = [];
        foreach (Repo::accessible_centres() as $c) {
            $centres[] = ['id' => (int) $c->id, 'code' => $c->code, 'name' => $c->name, 'brand' => $c->brand_name, 'accent' => $c->accent_color];
        }
        $page_id = (int) get_option('ccsp_portal_page_id');
        $app_id  = (int) get_option('ccsp_app_page_id');
        $app_url = $app_id ? get_permalink($app_id) : home_url('/');
        $user = wp_get_current_user();
        return new WP_REST_Response([
            'name'          => $user->display_name,
            'email'         => $user->user_email,
            'is_super'      => $this->is_super(),
            'centres'       => $centres,
            'calculator_url'=> $page_id ? get_permalink($page_id) : '',
            'logout_url'    => wp_logout_url($app_url),
            'profile_url'   => admin_url('profile.php'),
            'statuses'      => ['new' => 'New', 'contacted' => 'Contacted', 'enrolled' => 'Enrolled', 'lost' => 'Lost'],
        ], 200);
    }

    /** WHERE clause fragment scoping calculations to the caller. Returns '' for all. */
    private function scope_sql() {
        $ids = Repo::user_centre_ids();
        if ($ids === null) {
            return '';
        }
        if (empty($ids)) {
            return ' AND 0=1';
        }
        $in = implode(',', array_map('intval', $ids));
        return " AND c.centre_id IN ($in)";
    }

    public function list_estimates(WP_REST_Request $req) {
        global $wpdb;
        $t = Install::table('calculations');
        $centres = Install::table('centres');

        $where = '1=1' . $this->scope_sql();

        $status = sanitize_key($req->get_param('status'));
        if ($status && $status !== 'all') {
            $where .= $wpdb->prepare(' AND c.status = %s', $status);
        }
        $centre = (int) $req->get_param('centre_id');
        if ($centre) {
            $where .= $wpdb->prepare(' AND c.centre_id = %d', $centre);
        }
        $search = sanitize_text_field($req->get_param('search'));
        if ($search) {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where .= $wpdb->prepare(' AND (c.parent_name LIKE %s OR c.parent_email LIKE %s)', $like, $like);
        }

        $rows = $wpdb->get_results(
            "SELECT c.id, c.parent_name, c.parent_email, c.parent_phone, c.income, c.ccs_pct,
                    c.status, c.created_at, c.results_json, ce.name AS centre_name, ce.code AS centre_code
             FROM $t c LEFT JOIN $centres ce ON ce.id = c.centre_id
             WHERE $where ORDER BY c.id DESC LIMIT 300"
        );

        $out = [];
        foreach ($rows as $r) {
            $res = json_decode($r->results_json, true);
            $out[] = [
                'id'          => (int) $r->id,
                'parent_name' => $r->parent_name,
                'parent_email'=> $r->parent_email,
                'parent_phone'=> $r->parent_phone,
                'centre'      => $r->centre_name,
                'centre_code' => $r->centre_code,
                'income'      => (float) $r->income,
                'ccs_pct'     => (float) $r->ccs_pct,
                'status'      => $r->status,
                'created_at'  => $r->created_at,
                'weekly_gap'  => $this->weekly_gap($res),
            ];
        }
        return new WP_REST_Response(['estimates' => $out], 200);
    }

    public function get_estimate(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req['id'];
        $row = $this->fetch_scoped($id);
        if (!$row) {
            return new WP_Error('ccsp_not_found', 'Estimate not found or out of scope.', ['status' => 404]);
        }
        return new WP_REST_Response([
            'id'          => (int) $row->id,
            'parent_name' => $row->parent_name,
            'parent_email'=> $row->parent_email,
            'parent_phone'=> $row->parent_phone,
            'centre'      => $row->centre_name,
            'income'      => (float) $row->income,
            'ccs_pct'     => (float) $row->ccs_pct,
            'status'      => $row->status,
            'created_at'  => $row->created_at,
            'inputs'      => json_decode($row->inputs_json, true),
            'results'     => json_decode($row->results_json, true),
        ], 200);
    }

    public function update_status(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req['id'];
        $row = $this->fetch_scoped($id);
        if (!$row) {
            return new WP_Error('ccsp_not_found', 'Estimate not found or out of scope.', ['status' => 404]);
        }
        $status = sanitize_key($req->get_param('status'));
        $allowed = ['new', 'contacted', 'enrolled', 'lost'];
        if (!in_array($status, $allowed, true)) {
            return new WP_Error('ccsp_bad_status', 'Invalid status.', ['status' => 400]);
        }
        $wpdb->update(Install::table('calculations'), ['status' => $status], ['id' => $id]);
        return new WP_REST_Response(['ok' => true, 'status' => $status], 200);
    }

    public function summary() {
        global $wpdb;
        $t = Install::table('calculations');
        $centres = Install::table('centres');
        $scope = $this->scope_sql();

        $rows = $wpdb->get_results(
            "SELECT c.status, c.results_json FROM $t c LEFT JOIN $centres ce ON ce.id = c.centre_id
             WHERE 1=1 $scope"
        );
        $counts = ['new' => 0, 'contacted' => 0, 'enrolled' => 0, 'lost' => 0];
        $total = 0;
        $weekly_fee_sum = 0.0;
        foreach ($rows as $r) {
            $total++;
            if (isset($counts[$r->status])) { $counts[$r->status]++; }
            $res = json_decode($r->results_json, true);
            $weekly_fee_sum += $this->weekly_fee($res);
        }
        $conversion = $total > 0 ? round(($counts['enrolled'] / $total) * 100, 1) : 0;

        // Promotions used (by name), scoped.
        $promo = $wpdb->get_results(
            "SELECT p.name, COUNT(*) AS n FROM $t c
             LEFT JOIN $centres ce ON ce.id = c.centre_id
             LEFT JOIN " . Install::table('promotions') . " p ON p.id = c.promotion_id
             WHERE c.promotion_id > 0 $scope GROUP BY c.promotion_id ORDER BY n DESC LIMIT 6"
        );

        return new WP_REST_Response([
            'total'            => $total,
            'counts'           => $counts,
            'conversion'       => $conversion,
            'weekly_fees'      => round($weekly_fee_sum, 2),
            'annual_fees'      => round($weekly_fee_sum * 52, 2),
            'promotions_used'  => array_map(function ($p) { return ['name' => $p->name ?: '—', 'count' => (int) $p->n]; }, $promo),
        ], 200);
    }

    /* -------- helpers -------- */

    private function fetch_scoped($id) {
        global $wpdb;
        $t = Install::table('calculations');
        $centres = Install::table('centres');
        $where = $wpdb->prepare('c.id = %d', $id) . $this->scope_sql();
        return $wpdb->get_row(
            "SELECT c.*, ce.name AS centre_name FROM $t c LEFT JOIN $centres ce ON ce.id = c.centre_id WHERE $where"
        );
    }

    private function weekly_gap($res) {
        if (!is_array($res)) { return 0.0; }
        if (isset($res['net_period_gap'], $res['period'])) {
            $mult = ['week' => 1, 'fortnight' => 0.5, 'month' => 12 / 52, 'year' => 1 / 52];
            return round(((float) $res['net_period_gap']) * ($mult[$res['period']] ?? 1), 2);
        }
        if (isset($res['totals_fortnight']['gap'])) { return round(((float) $res['totals_fortnight']['gap']) / 2, 2); }
        return 0.0;
    }

    private function weekly_fee($res) {
        if (is_array($res) && isset($res['totals_fortnight']['fee'])) {
            return ((float) $res['totals_fortnight']['fee']) / 2;
        }
        return 0.0;
    }
}
