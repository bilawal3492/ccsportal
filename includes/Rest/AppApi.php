<?php
namespace CCSPortal\Rest;

use CCSPortal\Install;
use CCSPortal\Data\Repo;
use CCSPortal\Admin\Audit;
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
    const SCENARIO_META = 'ccsp_scenario_status';

    public function routes() {
        $auth = [$this, 'can_use'];

        register_rest_route(self::NS, '/me', [
            'methods' => 'GET', 'callback' => [$this, 'me'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/onboarding/seen', [
            'methods' => 'POST', 'callback' => [$this, 'tour_seen'], 'permission_callback' => $auth,
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

        // Feedback: any portal user can submit and see their own; admins see + manage all.
        register_rest_route(self::NS, '/feedback', [
            'methods' => 'GET', 'callback' => [$this, 'list_feedback'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/feedback', [
            'methods' => 'POST', 'callback' => [$this, 'submit_feedback'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/feedback/(?P<id>\d+)', [
            'methods' => 'POST', 'callback' => [$this, 'update_feedback'], 'permission_callback' => $auth,
        ]);

        // Per-user testing-scenario progress (works / issue), stored in user meta.
        register_rest_route(self::NS, '/testing/status', [
            'methods' => 'GET', 'callback' => [$this, 'get_scenario_status'], 'permission_callback' => $auth,
        ]);
        register_rest_route(self::NS, '/testing/status', [
            'methods' => 'POST', 'callback' => [$this, 'set_scenario_status'], 'permission_callback' => $auth,
        ]);
        // Admin-only: every portal user's testing progress.
        register_rest_route(self::NS, '/admin/testing', [
            'methods' => 'GET', 'callback' => [$this, 'all_scenario_status'], 'permission_callback' => [$this, 'can_admin'],
        ]);
    }

    public function can_admin() {
        return is_user_logged_in() && $this->is_super();
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
        $caps = [
            'manage_fees'       => current_user_can('ccsp_manage_fees'),
            'manage_promotions' => current_user_can('ccsp_manage_promotions'),
            'manage_centres'    => current_user_can('ccsp_manage_centres'),
            'manage_portal'     => $this->is_super(),
        ];
        if ($this->is_super()) { $role_label = 'Portal admin'; }
        elseif ($caps['manage_fees'] || $caps['manage_promotions']) { $role_label = 'Area manager'; }
        else { $role_label = 'Centre manager'; }
        return new WP_REST_Response([
            'name'          => $user->display_name,
            'email'         => $user->user_email,
            'is_super'      => $this->is_super(),
            'caps'          => $caps,
            'role_label'    => $role_label,
            'centres'       => $centres,
            'calculator_url'=> $page_id ? get_permalink($page_id) : '',
            'logout_url'    => wp_logout_url($app_url),
            'profile_url'   => admin_url('profile.php'),
            'statuses'      => ['new' => 'New', 'contacted' => 'Contacted', 'enrolled' => 'Enrolled', 'lost' => 'Lost'],
            // True only once the user has explicitly opted out; otherwise the
            // welcome tour opens automatically on every login.
            'tour_seen'     => (bool) get_user_meta($user->ID, 'ccsp_tour_optout', true),
        ], 200);
    }

    /** Remember that this user opted out of the welcome tour opening on login. */
    public function tour_seen() {
        update_user_meta(get_current_user_id(), 'ccsp_tour_optout', 1);
        return new WP_REST_Response(['ok' => true], 200);
    }

    /**
     * WHERE clause fragment scoping saved estimates to the caller.
     * Super admins / portal managers see every lead ('' = no restriction).
     * A centre manager only ever sees the leads they personally saved, so
     * managers sharing a centre never see each other's leads.
     */
    private function scope_sql() {
        global $wpdb;
        if ($this->is_super()) {
            return '';
        }
        return $wpdb->prepare(' AND c.manager_id = %d', get_current_user_id());
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
        Audit::log('estimate', $id, 'status', ['status' => $row->status], ['status' => $status]);
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
            'promotions_used'  => array_map(function ($p) { return ['name' => $p->name ?: '-', 'count' => (int) $p->n]; }, $promo),
        ], 200);
    }

    /* ------------------------------------------------------------------ *
     *  Feedback
     * ------------------------------------------------------------------ */

    private function feedback_categories() {
        return ['bug' => 'Bug', 'calculation' => 'Incorrect calculation', 'validation' => 'Validation issue', 'ui' => 'UI / UX', 'suggestion' => 'Suggestion', 'other' => 'Other'];
    }
    private function feedback_severities() {
        return ['critical' => 'Critical', 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low'];
    }
    private function feedback_statuses() {
        return ['new' => 'New', 'reviewing' => 'Reviewing', 'resolved' => 'Resolved', 'wontfix' => 'Won\'t fix'];
    }

    /** Human role label for a user id (for grouping feedback by who sent it). */
    private function user_role_label($uid) {
        $u = get_userdata($uid);
        if (!$u) { return 'Unknown'; }
        if (user_can($u, 'manage_options') || user_can($u, 'ccsp_manage_portal')) { return 'Portal admin'; }
        if (user_can($u, 'ccsp_manage_fees') || user_can($u, 'ccsp_manage_promotions')) { return 'Area manager'; }
        if (user_can($u, 'ccsp_use_portal')) { return 'Centre manager'; }
        return 'Other';
    }

    private function feedback_row($r) {
        return [
            'id'         => (int) $r->id,
            'user_id'    => (int) $r->user_id,
            'user_name'  => $r->user_name,
            'user_role'  => $this->user_role_label((int) $r->user_id),
            'scenario'   => $r->scenario,
            'category'   => $r->category,
            'severity'   => $r->severity,
            'subject'    => $r->subject,
            'message'    => $r->message,
            'status'     => $r->status,
            'admin_note' => $r->admin_note,
            'created_at' => $r->created_at,
            'updated_at' => $r->updated_at,
        ];
    }

    public function list_feedback() {
        global $wpdb;
        $t = Install::table('feedback');
        if ($this->is_super()) {
            $rows = $wpdb->get_results("SELECT * FROM $t ORDER BY id DESC LIMIT 500");
        } else {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE user_id = %d ORDER BY id DESC LIMIT 200", get_current_user_id()));
        }
        return new WP_REST_Response([
            'feedback'   => array_map([$this, 'feedback_row'], $rows ?: []),
            'is_super'   => $this->is_super(),
            'categories' => $this->feedback_categories(),
            'severities' => $this->feedback_severities(),
            'statuses'   => $this->feedback_statuses(),
        ], 200);
    }

    public function submit_feedback(WP_REST_Request $req) {
        global $wpdb;
        $subject = sanitize_text_field($req->get_param('subject'));
        $message = sanitize_textarea_field($req->get_param('message'));
        if ($subject === '' || $message === '') {
            return new WP_Error('ccsp_feedback', 'Please add a subject and a description.', ['status' => 400]);
        }
        $cats = $this->feedback_categories();
        $sevs = $this->feedback_severities();
        $category = sanitize_key($req->get_param('category'));
        $severity = sanitize_key($req->get_param('severity'));
        $user = wp_get_current_user();
        $now = current_time('mysql');
        $wpdb->insert(Install::table('feedback'), [
            'user_id'    => get_current_user_id(),
            'user_name'  => $user->display_name,
            'scenario'   => sanitize_text_field($req->get_param('scenario')),
            'category'   => isset($cats[$category]) ? $category : 'other',
            'severity'   => isset($sevs[$severity]) ? $severity : 'medium',
            'subject'    => $subject,
            'message'    => $message,
            'status'     => 'new',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        Audit::log('feedback', (int) $wpdb->insert_id, 'submit', null, ['subject' => $subject, 'severity' => isset($sevs[$severity]) ? $severity : 'medium']);
        return new WP_REST_Response(array_merge(['ok' => true, 'id' => (int) $wpdb->insert_id], (array) $this->list_feedback()->get_data()), 200);
    }

    public function update_feedback(WP_REST_Request $req) {
        global $wpdb;
        if (!$this->is_super()) {
            return new WP_Error('ccsp_forbidden', 'Only administrators can update feedback.', ['status' => 403]);
        }
        $id = (int) $req['id'];
        $t = Install::table('feedback');
        $row = $wpdb->get_row($wpdb->prepare("SELECT id FROM $t WHERE id = %d", $id));
        if (!$row) { return new WP_Error('ccsp_not_found', 'Feedback not found.', ['status' => 404]); }
        $statuses = $this->feedback_statuses();
        $status = sanitize_key($req->get_param('status'));
        $data = ['updated_at' => current_time('mysql')];
        if (isset($statuses[$status])) { $data['status'] = $status; }
        if ($req->get_param('admin_note') !== null) { $data['admin_note'] = sanitize_textarea_field($req->get_param('admin_note')); }
        $wpdb->update($t, $data, ['id' => $id]);
        Audit::log('feedback', $id, 'review', null, ['status' => isset($data['status']) ? $data['status'] : '']);
        return new WP_REST_Response(array_merge(['ok' => true], (array) $this->list_feedback()->get_data()), 200);
    }

    /* ------------------------------------------------------------------ *
     *  Testing-scenario progress (per user)
     * ------------------------------------------------------------------ */

    public function get_scenario_status() {
        $map = get_user_meta(get_current_user_id(), self::SCENARIO_META, true);
        return new WP_REST_Response(['status' => is_array($map) && $map ? $map : (object) []], 200);
    }

    /** Admin view: every portal user with their scenario status map. */
    public function all_scenario_status() {
        $out = [];
        foreach (get_users(['orderby' => 'display_name', 'number' => 1000]) as $u) {
            if (!user_can($u, 'ccsp_use_portal')) { continue; }
            $map = get_user_meta($u->ID, self::SCENARIO_META, true);
            if (!is_array($map)) { $map = []; }
            $out[] = [
                'id'     => (int) $u->ID,
                'name'   => $u->display_name,
                'role'   => $this->user_role_label($u->ID),
                'status' => $map ? $map : (object) [],
            ];
        }
        return new WP_REST_Response(['users' => $out], 200);
    }

    public function set_scenario_status(WP_REST_Request $req) {
        $id = sanitize_key((string) $req->get_param('id'));
        if ($id === '') {
            return new WP_Error('ccsp_bad', 'Missing scenario id.', ['status' => 400]);
        }
        $status = sanitize_key((string) $req->get_param('status'));
        if (!in_array($status, ['pass', 'issue', ''], true)) { $status = ''; }
        $uid = get_current_user_id();
        $map = get_user_meta($uid, self::SCENARIO_META, true);
        if (!is_array($map)) { $map = []; }
        if ($status === '') { unset($map[$id]); } else { $map[$id] = $status; }
        update_user_meta($uid, self::SCENARIO_META, $map);
        // Record the mark so admins can track testing progress in the Activity log.
        $label = sanitize_text_field((string) $req->get_param('label'));
        Audit::log('scenario', 0, $status === '' ? 'clear' : $status, null, ['scenario' => $label ?: $id]);
        return new WP_REST_Response(['ok' => true, 'status' => $map ? $map : (object) []], 200);
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
