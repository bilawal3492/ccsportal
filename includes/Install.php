<?php
namespace CCSPortal;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Installation, schema, seed data and roles for the Centre CCS Portal.
 *
 * All portal tables are prefixed `{$wpdb->prefix}ccsp_`. The existing
 * WordPress users/options tables are reused for auth and configuration.
 */
class Install {

    /** Table basenames (without the WP prefix). */
    const TABLES = [
        'brands',
        'centres',
        'fee_schedules',
        'fee_tiers',
        'promotions',
        'promotion_map',
        'calculations',
        'audit_log',
    ];

    /** Custom role for a centre-scoped manager. */
    const ROLE_MANAGER = 'ccsp_centre_manager';

    /** Portal capabilities. */
    const CAPS_MANAGER = ['read', 'ccsp_use_portal', 'ccsp_view_records'];
    const CAPS_ADMIN   = ['ccsp_use_portal', 'ccsp_view_records', 'ccsp_manage_fees', 'ccsp_manage_promotions', 'ccsp_manage_centres', 'ccsp_view_reports', 'ccsp_manage_portal'];

    /** Fully-qualified table name. */
    public static function table($basename) {
        global $wpdb;
        return $wpdb->prefix . 'ccsp_' . $basename;
    }

    /** Canonical centre display names keyed by centre code. */
    const CENTRE_NAMES = [
        'CKH AD' => 'Ardeer',
        'CKH GB' => 'Greensborough',
        'CKH HS' => 'Hillside',
        'CKH KX' => 'Knoxfield',
        'CKH RD' => 'Redan',
        'TFE CL' => 'Cheltenham',
        'TFE HP' => 'Hampton Park',
    ];

    /** Activation entry point. */
    public static function activate() {
        $prev = get_option('ccsp_db_version'); // false on a fresh install.
        self::create_tables();
        self::add_roles();
        self::seed_data();
        // Legacy repair only. v1 seeded placeholder centre names; every seed
        // since writes the real suburb, so running this on a current install
        // would only overwrite names an admin has since edited.
        if ($prev === '1') {
            self::sync_centre_names();
        }
        self::ensure_portal_page();
        update_option('ccsp_db_version', CCSP_DB_VERSION);
        update_option('ccsp_activated_at', current_time('mysql'));
    }

    /**
     * Ensure a WordPress page hosting the [ccs_portal] shortcode exists.
     * Managers visit this page to use the calculator. Idempotent.
     */
    public static function ensure_portal_page() {
        if (!function_exists('wp_insert_post')) {
            return 0; // pluggable API not ready — try again on a later admin_init.
        }
        self::ensure_shortcode_page('ccs_portal', 'Centre CCS Portal', 'centre-ccs-portal', 'ccsp_portal_page_id');
        self::ensure_shortcode_page('ccs_portal_app', 'Centre CCS Portal — App', 'centre-ccs-portal-app', 'ccsp_app_page_id');
        return (int) get_option('ccsp_portal_page_id');
    }

    /**
     * Ensure exactly one published page hosts a given shortcode. Dedupes any
     * duplicates from earlier runs and records the surviving page ID.
     */
    private static function ensure_shortcode_page($shortcode, $title, $slug, $option_key) {
        global $wpdb;
        $like = '%[' . $wpdb->esc_like($shortcode) . ']%';
        $ids = $wpdb->get_col($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_type = 'page' AND post_status = 'publish'
               AND post_content LIKE %s
             ORDER BY ID ASC",
            $like
        ));
        $ids = array_map('intval', (array) $ids);

        if (!empty($ids)) {
            $keep = array_shift($ids);
            foreach ($ids as $dupe) {
                wp_trash_post($dupe);
            }
            update_option($option_key, $keep);
            return $keep;
        }

        $page_id = wp_insert_post([
            'post_title'   => $title,
            'post_name'    => $slug,
            'post_content' => '[' . $shortcode . ']',
            'post_status'  => 'publish',
            'post_type'    => 'page',
        ]);
        if ($page_id && !is_wp_error($page_id)) {
            update_option($option_key, (int) $page_id);
            return (int) $page_id;
        }
        return 0;
    }

    public static function deactivate() {
        // Intentionally keep tables, seed data and roles so nothing is lost.
    }

    /** Run migrations when the plugin file is updated in place. */
    public static function maybe_upgrade() {
        $prev = get_option('ccsp_db_version');
        if ($prev !== CCSP_DB_VERSION) {
            self::create_tables();
            self::add_roles();
            if ($prev === '1') {
                self::sync_centre_names();
            }
            self::ensure_portal_page();
            update_option('ccsp_db_version', CCSP_DB_VERSION);
        }
    }

    /**
     * Correct the v1 placeholder centre names to their real suburbs.
     *
     * Only for upgrades from db_version 1 — call sites must gate on that.
     * It overwrites `name` by `code`, so running it on a current install
     * silently reverts any centre an admin has renamed.
     */
    public static function sync_centre_names() {
        global $wpdb;
        $centres = self::table('centres');
        foreach (self::CENTRE_NAMES as $code => $name) {
            $wpdb->update($centres, ['name' => $name], ['code' => $code]);
        }
    }

    /** Create/upgrade all tables via dbDelta. */
    public static function create_tables() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        $brands   = self::table('brands');
        $centres  = self::table('centres');
        $sched    = self::table('fee_schedules');
        $tiers    = self::table('fee_tiers');
        $promos   = self::table('promotions');
        $promomap = self::table('promotion_map');
        $calcs    = self::table('calculations');
        $audit    = self::table('audit_log');

        $sql = [];

        $sql[] = "CREATE TABLE $brands (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            code VARCHAR(16) NOT NULL,
            name VARCHAR(191) NOT NULL,
            accent_color VARCHAR(9) DEFAULT '',
            logo_url VARCHAR(255) DEFAULT '',
            email_from_name VARCHAR(191) DEFAULT '',
            email_from_address VARCHAR(191) DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            UNIQUE KEY code (code)
        ) $charset;";

        $sql[] = "CREATE TABLE $centres (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            brand_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            code VARCHAR(24) NOT NULL,
            name VARCHAR(191) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            phone VARCHAR(40) DEFAULT '',
            email VARCHAR(191) DEFAULT '',
            address VARCHAR(255) DEFAULT '',
            book_tour_url VARCHAR(255) DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            UNIQUE KEY code (code),
            KEY brand_id (brand_id)
        ) $charset;";

        $sql[] = "CREATE TABLE $sched (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            centre_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            effective_from DATE NOT NULL DEFAULT '2025-01-01',
            full_daily_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            weekly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            casual_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            windback_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            is_current TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            KEY centre_id (centre_id),
            KEY is_current (is_current)
        ) $charset;";

        $sql[] = "CREATE TABLE $tiers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            schedule_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            days TINYINT UNSIGNED NOT NULL DEFAULT 0,
            discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            sibling_discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            PRIMARY KEY  (id),
            KEY schedule_id (schedule_id)
        ) $charset;";

        $sql[] = "CREATE TABLE $promos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(191) NOT NULL,
            type VARCHAR(40) NOT NULL DEFAULT 'weeks_free',
            value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            unit VARCHAR(20) NOT NULL DEFAULT 'weeks',
            start_date DATE DEFAULT NULL,
            end_date DATE DEFAULT NULL,
            eligibility TEXT,
            terms LONGTEXT,
            stackable TINYINT(1) NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE $promomap (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            promotion_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            brand_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            centre_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY  (id),
            KEY promotion_id (promotion_id),
            KEY centre_id (centre_id)
        ) $charset;";

        $sql[] = "CREATE TABLE $calcs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            centre_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            manager_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            parent_name VARCHAR(191) DEFAULT '',
            parent_email VARCHAR(191) DEFAULT '',
            parent_phone VARCHAR(40) DEFAULT '',
            income DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            ccs_pct DECIMAL(6,2) NOT NULL DEFAULT 0.00,
            promotion_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            inputs_json LONGTEXT,
            results_json LONGTEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            KEY centre_id (centre_id),
            KEY manager_id (manager_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset;";

        $sql[] = "CREATE TABLE $audit (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            entity VARCHAR(40) NOT NULL DEFAULT '',
            entity_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            action VARCHAR(40) NOT NULL DEFAULT '',
            before_json LONGTEXT,
            after_json LONGTEXT,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            PRIMARY KEY  (id),
            KEY entity (entity),
            KEY user_id (user_id)
        ) $charset;";

        foreach ($sql as $statement) {
            dbDelta($statement);
        }
    }

    /** Register the Centre Manager role and grant portal caps to admins. */
    public static function add_roles() {
        add_role(
            self::ROLE_MANAGER,
            'Centre Manager',
            array_fill_keys(self::CAPS_MANAGER, true)
        );
        $admin = get_role('administrator');
        if ($admin) {
            foreach (self::CAPS_ADMIN as $cap) {
                $admin->add_cap($cap);
            }
        }
        $manager = get_role(self::ROLE_MANAGER);
        if ($manager) {
            foreach (self::CAPS_MANAGER as $cap) {
                $manager->add_cap($cap);
            }
        }
    }

    /**
     * Seed the 3 brands, 14 centres and their fee schedules.
     * Idempotent: only seeds when the brands table is empty.
     */
    public static function seed_data() {
        global $wpdb;
        $brands_table = self::table('brands');
        $existing = (int) $wpdb->get_var("SELECT COUNT(*) FROM $brands_table");
        if ($existing > 0) {
            return;
        }
        $now = current_time('mysql');

        $brands = [
            'THE' => ['name' => 'The Hive Early Learning Centres',  'color' => '#df7a2c'],
            'TFE' => ['name' => 'The Fern Early Learning Centres',   'color' => '#3f9250'],
            'CKH' => ['name' => 'Community Kids Haven',              'color' => '#3773c6'],
        ];
        $brand_ids = [];
        foreach ($brands as $code => $b) {
            $wpdb->insert($brands_table, [
                'code'               => $code,
                'name'               => $b['name'],
                'accent_color'       => $b['color'],
                'email_from_name'    => $b['name'],
                'status'             => 'active',
                'created_at'         => $now,
            ]);
            $brand_ids[$code] = (int) $wpdb->insert_id;
        }

        // brand_code, centre_code, suburb name, full daily, weekly rate, windback, [3-day %, 4-day %, 5-day %]
        $centres = [
            ['THE', 'THE AB', 'Ashburton',  182.64, 175.00, 164.64, [5, 5, 10]],
            ['THE', 'THE BT', 'Brighton',   199.50, 190.00, 179.50, [5, 5, 10]],
            ['THE', 'THE FF', 'Fairfield',  187.88, 180.00, 167.88, [5, 5, 10]],
            ['THE', 'THE GL', 'Geelong',    172.20, 165.00, 152.20, [5, 5, 10]],
            ['THE', 'THE KV', 'Kingsville', 192.58, 185.00, 172.58, [0, 0, 5]],
            ['THE', 'THE SS', 'Sunshine',   177.44, 170.00, 152.00, [5, 5, 10]],
            ['THE', 'THE TQ', 'Torquay',    167.00, 160.00, 152.00, [5, 5, 10]],
            ['TFE', 'TFE CL', 'Cheltenham',   167.18, 160.00, 152.00, [5, 5, 10]],
            ['TFE', 'TFE HP', 'Hampton Park', 167.00, 157.00, 152.00, [5, 5, 10]],
            ['CKH', 'CKH AD', 'Ardeer',       167.00, 160.00, 152.00, [5, 5, 10]],
            ['CKH', 'CKH GB', 'Greensborough', 177.44, 170.00, 157.44, [0, 0, 5]],
            ['CKH', 'CKH HS', 'Hillside',     172.20, 165.00, 152.20, [0, 0, 5]],
            ['CKH', 'CKH KX', 'Knoxfield',    177.44, 170.00, 157.44, [5, 5, 10]],
            ['CKH', 'CKH RD', 'Redan',        167.00, 160.00, 152.00, [5, 5, 10]],
        ];

        $centres_table = self::table('centres');
        $sched_table   = self::table('fee_schedules');
        $tiers_table   = self::table('fee_tiers');

        foreach ($centres as $c) {
            list($brand_code, $centre_code, $name, $full, $weekly, $windback, $tier_pcts) = $c;
            $wpdb->insert($centres_table, [
                'brand_id'   => $brand_ids[$brand_code] ?? 0,
                'code'       => $centre_code,
                'name'       => $name,
                'status'     => 'active',
                'created_at' => $now,
            ]);
            $centre_id = (int) $wpdb->insert_id;

            $wpdb->insert($sched_table, [
                'centre_id'      => $centre_id,
                'effective_from' => '2025-01-01',
                'full_daily_fee' => $full,
                'weekly_rate'    => $weekly,
                'casual_rate'    => $full,
                'windback_rate'  => $windback,
                'is_current'     => 1,
                'created_at'     => $now,
            ]);
            $schedule_id = (int) $wpdb->insert_id;

            // Exact daily rate per attendance-day count (1–5 days).
            $day_rates = [
                1 => $full,
                2 => $full,
                3 => round($full * (1 - ($tier_pcts[0] / 100)), 2),
                4 => round($full * (1 - ($tier_pcts[1] / 100)), 2),
                5 => round($full * (1 - ($tier_pcts[2] / 100)), 2),
            ];
            foreach ($day_rates as $days => $rate) {
                $wpdb->insert($tiers_table, [
                    'schedule_id'          => $schedule_id,
                    'days'                 => $days,
                    'discount_pct'         => 0,
                    'daily_rate'           => $rate,
                    'sibling_discount_pct' => 0,
                ]);
            }
        }
    }
}
