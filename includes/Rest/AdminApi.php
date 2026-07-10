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
 * Management REST API powering the standalone React admin. Super-admin only:
 * full CRUD for brands, centres + fees, promotions and manager accounts.
 * Mirrors the wp-admin controllers so both surfaces stay consistent, and every
 * write is audit-logged.
 */
class AdminApi {

    const NS = 'ccsp/v1';

    public function routes() {
        $cap = [$this, 'can_manage'];

        register_rest_route(self::NS, '/admin/bootstrap', ['methods' => 'GET', 'callback' => [$this, 'bootstrap'], 'permission_callback' => $cap]);

        register_rest_route(self::NS, '/admin/brands', ['methods' => 'GET', 'callback' => [$this, 'list_brands'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/brands', ['methods' => 'POST', 'callback' => [$this, 'save_brand'], 'permission_callback' => $cap]);

        register_rest_route(self::NS, '/admin/centres', ['methods' => 'GET', 'callback' => [$this, 'list_centres'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/centres/(?P<id>\d+)', ['methods' => 'GET', 'callback' => [$this, 'get_centre'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/centres', ['methods' => 'POST', 'callback' => [$this, 'save_centre'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/centres/(?P<id>\d+)', ['methods' => 'DELETE', 'callback' => [$this, 'delete_centre'], 'permission_callback' => $cap]);

        register_rest_route(self::NS, '/admin/promotions', ['methods' => 'GET', 'callback' => [$this, 'list_promotions'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/promotions', ['methods' => 'POST', 'callback' => [$this, 'save_promotion'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/promotions/(?P<id>\d+)', ['methods' => 'DELETE', 'callback' => [$this, 'delete_promotion'], 'permission_callback' => $cap]);

        register_rest_route(self::NS, '/admin/users', ['methods' => 'GET', 'callback' => [$this, 'list_users'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/users/create', ['methods' => 'POST', 'callback' => [$this, 'create_user'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/managers', ['methods' => 'POST', 'callback' => [$this, 'save_manager'], 'permission_callback' => $cap]);
        register_rest_route(self::NS, '/admin/managers/(?P<id>\d+)', ['methods' => 'DELETE', 'callback' => [$this, 'remove_manager'], 'permission_callback' => $cap]);
    }

    public function can_manage() {
        return is_user_logged_in() && (current_user_can('ccsp_manage_portal') || current_user_can('manage_options'));
    }

    /* ------------------------------------------------------------------ *
     *  Bootstrap
     * ------------------------------------------------------------------ */

    public function bootstrap() {
        return new WP_REST_Response([
            'brands'     => $this->brands_payload(),
            'centres'    => $this->centres_payload(),
            'promotions' => $this->promotions_payload(),
            'promo_types'=> Repo::promo_types(),
        ], 200);
    }

    /* ------------------------------------------------------------------ *
     *  Brands
     * ------------------------------------------------------------------ */

    private function brands_payload() {
        $out = [];
        foreach (Repo::brands() as $b) {
            $out[] = [
                'id' => (int) $b->id, 'code' => $b->code, 'name' => $b->name,
                'accent_color' => $b->accent_color, 'logo_url' => $b->logo_url,
                'email_from_name' => $b->email_from_name, 'email_from_address' => $b->email_from_address,
                'status' => $b->status,
            ];
        }
        return $out;
    }

    public function list_brands() {
        return new WP_REST_Response(['brands' => $this->brands_payload()], 200);
    }

    public function save_brand(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req->get_param('id');
        $color = sanitize_text_field($req->get_param('accent_color'));
        if ($color && !preg_match('/^#[0-9a-fA-F]{3,8}$/', $color)) { $color = ''; }
        $data = [
            'name'               => sanitize_text_field($req->get_param('name')),
            'code'               => sanitize_text_field($req->get_param('code')),
            'accent_color'       => $color,
            'logo_url'           => esc_url_raw($req->get_param('logo_url')),
            'email_from_name'    => sanitize_text_field($req->get_param('email_from_name')),
            'email_from_address' => sanitize_email($req->get_param('email_from_address')),
            'status'             => $req->get_param('status') === 'inactive' ? 'inactive' : 'active',
        ];
        if ($id) {
            $before = (array) Repo::brand($id);
            $wpdb->update(Install::table('brands'), $data, ['id' => $id]);
            Audit::log('brand', $id, 'update', $before, $data);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('brands'), $data);
            $id = (int) $wpdb->insert_id;
            Audit::log('brand', $id, 'create', null, $data);
        }
        return new WP_REST_Response(['ok' => true, 'id' => $id, 'brands' => $this->brands_payload()], 200);
    }

    /* ------------------------------------------------------------------ *
     *  Centres + fees
     * ------------------------------------------------------------------ */

    private function centres_payload() {
        $out = [];
        foreach (Repo::centres() as $c) {
            $s = Repo::current_schedule($c->id);
            $out[] = [
                'id' => (int) $c->id, 'brand_id' => (int) $c->brand_id, 'brand_name' => $c->brand_name,
                'accent' => $c->accent_color, 'code' => $c->code, 'name' => $c->name, 'status' => $c->status,
                'full_daily_fee' => $s ? (float) $s->full_daily_fee : 0,
                'weekly_rate'    => $s ? (float) $s->weekly_rate : 0,
                'windback_rate'  => $s ? (float) $s->windback_rate : 0,
            ];
        }
        return $out;
    }

    public function list_centres() {
        return new WP_REST_Response(['centres' => $this->centres_payload(), 'brands' => $this->brands_payload()], 200);
    }

    public function get_centre(WP_REST_Request $req) {
        $id = (int) $req['id'];
        $c = Repo::centre($id);
        if (!$c) { return new WP_Error('ccsp_not_found', 'Centre not found.', ['status' => 404]); }
        $s = Repo::current_schedule($id);
        $rate = [];
        if ($s) { foreach (Repo::tiers($s->id) as $t) { $rate[(int) $t->days] = (float) $t->daily_rate; } }
        $full = $s ? (float) $s->full_daily_fee : 0;
        return new WP_REST_Response([
            'id' => (int) $c->id, 'brand_id' => (int) $c->brand_id, 'code' => $c->code, 'name' => $c->name,
            'status' => $c->status, 'phone' => $c->phone, 'email' => $c->email, 'address' => $c->address,
            'book_tour_url' => $c->book_tour_url,
            'weekly_rate'    => $s ? (float) $s->weekly_rate : 0,
            'windback_rate'  => $s ? (float) $s->windback_rate : 0,
            'effective_from' => $s ? $s->effective_from : gmdate('Y-m-d'),
            'day_fees'       => [
                '1' => $rate[1] ?? $full,
                '2' => $rate[2] ?? $full,
                '3' => $rate[3] ?? $full,
                '4' => $rate[4] ?? $full,
                '5' => $rate[5] ?? $full,
            ],
            'brands'         => $this->brands_payload(),
        ], 200);
    }

    public function save_centre(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req->get_param('id');

        $centre = [
            'brand_id'      => (int) $req->get_param('brand_id'),
            'code'          => sanitize_text_field($req->get_param('code')),
            'name'          => sanitize_text_field($req->get_param('name')),
            'status'        => $req->get_param('status') === 'inactive' ? 'inactive' : 'active',
            'phone'         => sanitize_text_field($req->get_param('phone')),
            'email'         => sanitize_email($req->get_param('email')),
            'address'       => sanitize_text_field($req->get_param('address')),
            'book_tour_url' => esc_url_raw($req->get_param('book_tour_url')),
        ];

        if ($id) {
            $before = (array) Repo::centre($id);
            $wpdb->update(Install::table('centres'), $centre, ['id' => $id]);
            Audit::log('centre', $id, 'update', $before, $centre);
        } else {
            $centre['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('centres'), $centre);
            $id = (int) $wpdb->insert_id;
            Audit::log('centre', $id, 'create', null, $centre);
        }

        // Exact daily rates entered directly per attendance-day count (1–5).
        $day_fees = (array) $req->get_param('day_fees');
        $day = function ($d) use ($day_fees) {
            return round((float) ($day_fees[(string) $d] ?? $day_fees[$d] ?? 0), 2);
        };
        $full = $day(1);

        $sched = [
            'centre_id'      => $id,
            'effective_from' => $this->clean_date($req->get_param('effective_from')) ?: gmdate('Y-m-d'),
            'full_daily_fee' => $full,
            'weekly_rate'    => round((float) $req->get_param('weekly_rate'), 2),
            'windback_rate'  => round((float) $req->get_param('windback_rate'), 2),
            'casual_rate'    => $full,
            'is_current'     => 1,
        ];
        $current = Repo::current_schedule($id);
        if ($current) {
            $wpdb->update(Install::table('fee_schedules'), $sched, ['id' => $current->id]);
            $schedule_id = (int) $current->id;
        } else {
            $sched['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('fee_schedules'), $sched);
            $schedule_id = (int) $wpdb->insert_id;
        }

        $wpdb->delete(Install::table('fee_tiers'), ['schedule_id' => $schedule_id]);
        foreach ([1, 2, 3, 4, 5] as $d) {
            $wpdb->insert(Install::table('fee_tiers'), [
                'schedule_id' => $schedule_id, 'days' => $d, 'discount_pct' => 0,
                'daily_rate' => $day($d), 'sibling_discount_pct' => 0,
            ]);
        }

        return new WP_REST_Response(['ok' => true, 'id' => $id, 'centres' => $this->centres_payload()], 200);
    }

    public function delete_centre(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req['id'];
        $before = (array) Repo::centre($id);
        $wpdb->update(Install::table('centres'), ['status' => 'inactive'], ['id' => $id]);
        Audit::log('centre', $id, 'deactivate', $before, null);
        return new WP_REST_Response(['ok' => true, 'centres' => $this->centres_payload()], 200);
    }

    /* ------------------------------------------------------------------ *
     *  Promotions
     * ------------------------------------------------------------------ */

    private function promotions_payload() {
        $out = [];
        foreach (Repo::promotions() as $p) {
            $out[] = [
                'id' => (int) $p->id, 'name' => $p->name, 'type' => $p->type, 'value' => (float) $p->value,
                'unit' => $p->unit, 'start_date' => $p->start_date, 'end_date' => $p->end_date,
                'eligibility' => $p->eligibility, 'terms' => isset($p->terms) ? $p->terms : '',
                'stackable' => (int) $p->stackable, 'status' => $p->status,
                'brand_ids' => Repo::promotion_brand_ids($p->id),
                'centre_ids' => Repo::promotion_centre_ids($p->id),
            ];
        }
        return $out;
    }

    public function list_promotions() {
        return new WP_REST_Response([
            'promotions' => $this->promotions_payload(),
            'brands'     => $this->brands_payload(),
            'centres'    => $this->centres_payload(),
            'promo_types'=> Repo::promo_types(),
        ], 200);
    }

    public function save_promotion(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req->get_param('id');
        $types = Repo::promo_types();
        $type = sanitize_key($req->get_param('type'));
        $unit = $req->get_param('unit');
        $data = [
            'name'        => sanitize_text_field($req->get_param('name')),
            'type'        => isset($types[$type]) ? $type : 'weeks_free',
            'value'       => round((float) $req->get_param('value'), 2),
            'unit'        => in_array($unit, ['weeks', 'percent', 'amount', 'sibling', 'oneoff'], true) ? $unit : 'weeks',
            'start_date'  => $this->clean_date($req->get_param('start_date')),
            'end_date'    => $this->clean_date($req->get_param('end_date')),
            'eligibility' => sanitize_textarea_field($req->get_param('eligibility')),
            'terms'       => sanitize_textarea_field($req->get_param('terms')),
            'stackable'   => $req->get_param('stackable') ? 1 : 0,
            'status'      => $req->get_param('status') === 'inactive' ? 'inactive' : 'active',
        ];
        $before = $id ? (array) Repo::promotion($id) : null;
        if ($id) {
            $wpdb->update(Install::table('promotions'), $data, ['id' => $id]);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('promotions'), $data);
            $id = (int) $wpdb->insert_id;
        }

        $map = Install::table('promotion_map');
        $wpdb->delete($map, ['promotion_id' => $id]);
        foreach (array_map('intval', (array) $req->get_param('brand_ids')) as $bid) {
            if ($bid > 0) { $wpdb->insert($map, ['promotion_id' => $id, 'brand_id' => $bid, 'centre_id' => 0]); }
        }
        foreach (array_map('intval', (array) $req->get_param('centre_ids')) as $cid) {
            if ($cid > 0) { $wpdb->insert($map, ['promotion_id' => $id, 'brand_id' => 0, 'centre_id' => $cid]); }
        }

        Audit::log('promotion', $id, $before ? 'update' : 'create', $before, $data);
        return new WP_REST_Response(['ok' => true, 'id' => $id, 'promotions' => $this->promotions_payload()], 200);
    }

    public function delete_promotion(WP_REST_Request $req) {
        global $wpdb;
        $id = (int) $req['id'];
        $before = (array) Repo::promotion($id);
        $wpdb->delete(Install::table('promotions'), ['id' => $id]);
        $wpdb->delete(Install::table('promotion_map'), ['promotion_id' => $id]);
        Audit::log('promotion', $id, 'delete', $before, null);
        return new WP_REST_Response(['ok' => true, 'promotions' => $this->promotions_payload()], 200);
    }

    /* ------------------------------------------------------------------ *
     *  Users / managers
     * ------------------------------------------------------------------ */

    private function users_payload() {
        $managers = [];
        foreach (Repo::managers() as $u) {
            $managers[] = [
                'id' => (int) $u->ID, 'name' => $u->display_name, 'email' => $u->user_email,
                'centre_ids' => Repo::manager_centre_ids($u->ID),
            ];
        }
        $assignable = [];
        foreach (Repo::assignable_users() as $u) {
            $assignable[] = ['id' => (int) $u->ID, 'name' => $u->display_name, 'email' => $u->user_email];
        }
        return ['managers' => $managers, 'assignable' => $assignable];
    }

    public function list_users() {
        $p = $this->users_payload();
        $p['centres'] = $this->centres_payload();
        return new WP_REST_Response($p, 200);
    }

    public function create_user(WP_REST_Request $req) {
        $email = sanitize_email($req->get_param('email'));
        $name  = sanitize_text_field($req->get_param('name'));
        if (!is_email($email)) {
            return new WP_Error('ccsp_bad_email', 'A valid email is required.', ['status' => 400]);
        }
        if (email_exists($email)) {
            return new WP_Error('ccsp_email_exists', 'A user with that email already exists — assign them below instead.', ['status' => 409]);
        }
        $username = sanitize_user(current(explode('@', $email)), true);
        if (username_exists($username)) { $username .= '_' . wp_generate_password(4, false); }

        $user_id = wp_insert_user([
            'user_login'   => $username,
            'user_email'   => $email,
            'display_name' => $name ?: $username,
            'first_name'   => $name,
            'user_pass'    => wp_generate_password(20),
            'role'         => Install::ROLE_MANAGER,
        ]);
        if (is_wp_error($user_id)) {
            return new WP_Error('ccsp_user_failed', $user_id->get_error_message(), ['status' => 400]);
        }

        $centres = array_values(array_unique(array_filter(array_map('intval', (array) $req->get_param('centre_ids')))));
        update_user_meta($user_id, Repo::MANAGER_META, $centres);
        // Send the set-password / welcome email.
        wp_new_user_notification($user_id, null, 'user');

        Audit::log('manager', $user_id, 'create', null, ['email' => $email, 'centres' => $centres]);
        return new WP_REST_Response(array_merge(['ok' => true, 'id' => $user_id], $this->users_payload()), 200);
    }

    public function save_manager(WP_REST_Request $req) {
        $user_id = (int) $req->get_param('user_id');
        $user = $user_id ? get_userdata($user_id) : null;
        if (!$user) { return new WP_Error('ccsp_no_user', 'User not found.', ['status' => 404]); }
        if (!in_array(Install::ROLE_MANAGER, (array) $user->roles, true)) {
            $user->add_role(Install::ROLE_MANAGER);
        }
        $centres = array_values(array_unique(array_filter(array_map('intval', (array) $req->get_param('centre_ids')))));
        update_user_meta($user_id, Repo::MANAGER_META, $centres);
        Audit::log('manager', $user_id, 'assign', null, ['centres' => $centres]);
        return new WP_REST_Response(array_merge(['ok' => true], $this->users_payload()), 200);
    }

    public function remove_manager(WP_REST_Request $req) {
        $user_id = (int) $req['id'];
        $user = get_userdata($user_id);
        if ($user) {
            $user->remove_role(Install::ROLE_MANAGER);
            delete_user_meta($user_id, Repo::MANAGER_META);
            Audit::log('manager', $user_id, 'remove', null, null);
        }
        return new WP_REST_Response(array_merge(['ok' => true], $this->users_payload()), 200);
    }

    /* -------- helpers -------- */

    private function clean_date($v) {
        $v = sanitize_text_field((string) $v);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }
}
