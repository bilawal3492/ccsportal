<?php
namespace CCSPortal\Data;

use CCSPortal\Install;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Read helpers for portal data. Keeps SQL in one place so the controllers
 * and (later) the REST layer share exactly the same queries.
 */
class Repo {

    const MANAGER_META = 'ccsp_centre_ids';

    /* ---------------- Brands ---------------- */

    public static function brands() {
        global $wpdb;
        $t = Install::table('brands');
        return $wpdb->get_results("SELECT * FROM $t ORDER BY name");
    }

    public static function brand($id) {
        global $wpdb;
        $t = Install::table('brands');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id = %d", $id));
    }

    /** [id => name] for select boxes. */
    public static function brand_options() {
        $out = [];
        foreach (self::brands() as $b) {
            $out[(int) $b->id] = $b->name;
        }
        return $out;
    }

    /* ---------------- Centres ---------------- */

    public static function centres($only_active = false) {
        global $wpdb;
        $c = Install::table('centres');
        $b = Install::table('brands');
        $where = $only_active ? "WHERE c.status = 'active'" : '';
        return $wpdb->get_results(
            "SELECT c.*, b.name AS brand_name, b.accent_color
             FROM $c c LEFT JOIN $b b ON b.id = c.brand_id
             $where ORDER BY b.name, c.code"
        );
    }

    public static function centre($id) {
        global $wpdb;
        $t = Install::table('centres');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id = %d", $id));
    }

    /** [id => "Brand, Centre"] for select boxes. */
    public static function centre_options($only_active = false) {
        $out = [];
        foreach (self::centres($only_active) as $c) {
            $out[(int) $c->id] = trim(($c->brand_name ? $c->brand_name . ' · ' : '') . $c->name);
        }
        return $out;
    }

    /* ---------------- Fees ---------------- */

    public static function current_schedule($centre_id) {
        global $wpdb;
        $t = Install::table('fee_schedules');
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $t WHERE centre_id = %d AND is_current = 1 ORDER BY effective_from DESC LIMIT 1",
            $centre_id
        ));
    }

    public static function tiers($schedule_id) {
        global $wpdb;
        $t = Install::table('fee_tiers');
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $t WHERE schedule_id = %d ORDER BY days",
            $schedule_id
        ));
    }

    /* ---------------- Promotions ---------------- */

    public static function promotions() {
        global $wpdb;
        $t = Install::table('promotions');
        return $wpdb->get_results("SELECT * FROM $t ORDER BY status, name");
    }

    public static function promotion($id) {
        global $wpdb;
        $t = Install::table('promotions');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id = %d", $id));
    }

    /** Centre IDs a promotion is mapped to (empty = all centres in scope). */
    public static function promotion_centre_ids($promo_id) {
        global $wpdb;
        $t = Install::table('promotion_map');
        $rows = $wpdb->get_col($wpdb->prepare(
            "SELECT centre_id FROM $t WHERE promotion_id = %d AND centre_id > 0",
            $promo_id
        ));
        return array_map('intval', $rows);
    }

    public static function promotion_brand_ids($promo_id) {
        global $wpdb;
        $t = Install::table('promotion_map');
        $rows = $wpdb->get_col($wpdb->prepare(
            "SELECT brand_id FROM $t WHERE promotion_id = %d AND brand_id > 0",
            $promo_id
        ));
        return array_map('intval', $rows);
    }

    /** Human labels for promotion types. */
    public static function promo_types() {
        return [
            'weeks_free'       => 'Weeks Free',
            'sibling_discount' => 'Sibling discount',
            'referral'         => 'Refer a friend (one-off)',
            'returning_family' => 'Returning Family discount',
            'new_enrolment'    => 'New Enrolment discount',
            'custom'           => 'Custom / other',
        ];
    }

    /* ---------------- Managers ---------------- */

    /** WP users holding the Centre Manager role. */
    public static function managers() {
        return get_users(['role' => Install::ROLE_MANAGER, 'orderby' => 'display_name']);
    }

    /** Centre IDs assigned to a user. */
    public static function manager_centre_ids($user_id) {
        $ids = get_user_meta($user_id, self::MANAGER_META, true);
        return is_array($ids) ? array_map('intval', $ids) : [];
    }

    /** Users who could be assigned as managers (not already managers/admins excluded). */
    public static function assignable_users() {
        return get_users(['orderby' => 'display_name', 'number' => 500]);
    }

    /* ---------------- Access control ---------------- */

    /**
     * Centre IDs the current user may access.
     * @return int[]|null Null means "all centres" (super admin).
     */
    public static function user_centre_ids() {
        if (current_user_can('ccsp_manage_portal') || current_user_can('manage_options')) {
            return null;
        }
        return self::manager_centre_ids(get_current_user_id());
    }

    public static function can_access_centre($centre_id) {
        $ids = self::user_centre_ids();
        return $ids === null || in_array((int) $centre_id, $ids, true);
    }

    /** Active centres the current user may use, scoped to their assignment. */
    public static function accessible_centres() {
        $ids = self::user_centre_ids();
        $all = self::centres(true);
        if ($ids === null) {
            return $all;
        }
        $out = [];
        foreach ($all as $c) {
            if (in_array((int) $c->id, $ids, true)) {
                $out[] = $c;
            }
        }
        return $out;
    }

    /* ---------------- Promotion resolution ---------------- */

    /**
     * Active, in-window promotions that apply to a centre: global (unmapped),
     * mapped to the centre, or mapped to the centre's brand.
     */
    public static function promotions_for_centre($centre_id) {
        global $wpdb;
        $centre = self::centre($centre_id);
        if (!$centre) {
            return [];
        }
        $p   = Install::table('promotions');
        $map = Install::table('promotion_map');
        $today = current_time('Y-m-d');
        $brand_id = (int) $centre->brand_id;
        $centre_id = (int) $centre_id;

        $sql = $wpdb->prepare(
            "SELECT p.* FROM $p p
             WHERE p.status = 'active'
               AND (p.start_date IS NULL OR p.start_date <= %s)
               AND (p.end_date IS NULL OR p.end_date >= %s)
               AND (
                    NOT EXISTS (SELECT 1 FROM $map m WHERE m.promotion_id = p.id)
                 OR EXISTS (SELECT 1 FROM $map m WHERE m.promotion_id = p.id AND m.centre_id = %d)
                 OR EXISTS (SELECT 1 FROM $map m WHERE m.promotion_id = p.id AND m.brand_id = %d)
               )
             ORDER BY p.name",
            $today, $today, $centre_id, $brand_id
        );
        return $wpdb->get_results($sql);
    }

    /**
     * Compact per-centre payload for the front-end app (fees, tiers, promos).
     */
    public static function centre_bootstrap($centre) {
        $s = self::current_schedule($centre->id);
        $tiers = [];
        if ($s) {
            foreach (self::tiers($s->id) as $t) {
                $tiers[(int) $t->days] = (float) $t->daily_rate;
            }
        }
        $promos = [];
        foreach (self::promotions_for_centre($centre->id) as $p) {
            $promos[] = [
                'id'    => (int) $p->id,
                'name'  => $p->name,
                'type'  => $p->type,
                'unit'  => $p->unit,
                'value' => (float) $p->value,
                'terms' => isset($p->terms) ? (string) $p->terms : '',
            ];
        }
        return [
            'id'             => (int) $centre->id,
            'code'           => $centre->code,
            'name'           => $centre->name,
            'brand_name'     => $centre->brand_name ?? '',
            'accent'         => $centre->accent_color ?? '#cf6a26',
            'full_daily_fee' => $s ? (float) $s->full_daily_fee : 0,
            'weekly_rate'    => $s ? (float) $s->weekly_rate : 0,
            'windback_rate'  => $s ? (float) $s->windback_rate : 0,
            'casual_rate'    => $s ? (float) $s->casual_rate : 0,
            'tiers'          => $tiers,
            'promotions'     => $promos,
        ];
    }
}
