<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;
use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Centres & Fees. A centre and its current fee schedule (full daily / weekly /
 * WindBack / casual) plus the 3/4/5-day discount tiers are edited together on
 * one screen and saved atomically.
 */
class CentresController {

    const PAGE = 'ccs-portal-centres';
    const CAP_VIEW = 'ccsp_view_records';
    const CAP_EDIT = 'ccsp_manage_fees';

    public function register() {
        add_action('admin_post_ccsp_save_centre', [$this, 'handle_save']);
    }

    public function render() {
        if (!current_user_can(self::CAP_VIEW)) {
            wp_die('Access denied.');
        }
        $action = isset($_GET['action']) ? sanitize_key($_GET['action']) : 'list';
        if ($action === 'edit') {
            $this->render_edit();
        } else {
            $this->render_list();
        }
    }

    private function render_list() {
        $rows = Repo::centres();
        $can_edit = current_user_can(self::CAP_EDIT);
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Centres &amp; Fees</h1>
            <?php UI::notice(); ?>
            <p class="ccsp-sub">Each centre's current daily, weekly and WindBack rates plus the day-attendance discount tiers.</p>
            <table class="widefat striped ccsp-table">
                <thead><tr>
                    <th>Brand</th><th>Code</th><th>Centre</th>
                    <th class="num">Full daily</th><th class="num">Weekly (day)</th><th class="num">WindBack</th>
                    <th>Status</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($rows as $c) :
                    $s = Repo::current_schedule($c->id); ?>
                    <tr>
                        <td><span class="ccsp-dot" style="background:<?php echo esc_attr($c->accent_color); ?>"></span><?php echo esc_html($c->brand_name); ?></td>
                        <td><code><?php echo esc_html($c->code); ?></code></td>
                        <td><?php echo esc_html($c->name); ?></td>
                        <td class="num"><?php echo $s ? '$' . number_format((float) $s->full_daily_fee, 2) : '—'; ?></td>
                        <td class="num"><?php echo $s ? '$' . number_format((float) $s->weekly_rate, 2) : '—'; ?></td>
                        <td class="num"><?php echo $s ? '$' . number_format((float) $s->windback_rate, 2) : '—'; ?></td>
                        <td><span class="ccsp-badge <?php echo $c->status === 'active' ? 'ok' : 'bad'; ?>"><?php echo esc_html(ucfirst($c->status)); ?></span></td>
                        <td><?php if ($can_edit) : ?><a class="button button-small" href="<?php echo esc_url(UI::url(self::PAGE, ['action' => 'edit', 'id' => $c->id])); ?>">Edit</a><?php endif; ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    private function render_edit() {
        if (!current_user_can(self::CAP_EDIT)) {
            wp_die('Access denied.');
        }
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        $c = Repo::centre($id);
        if (!$c) {
            echo '<div class="wrap"><p>Centre not found.</p></div>';
            return;
        }
        $s = Repo::current_schedule($id);
        $tiers = $s ? Repo::tiers($s->id) : [];
        $rate_by_days = [];
        foreach ($tiers as $t) {
            $rate_by_days[(int) $t->days] = (float) $t->daily_rate;
        }
        $full_fee = $s ? (float) $s->full_daily_fee : 0;
        $day_fee = static function ($d) use ($rate_by_days, $full_fee) {
            return isset($rate_by_days[$d]) ? $rate_by_days[$d] : $full_fee;
        };
        $val = static function ($v) { return esc_attr($v); };
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Edit Centre <span class="ccsp-ver"><?php echo esc_html($c->code); ?></span></h1>
            <?php UI::notice(); ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="ccsp-form">
                <input type="hidden" name="action" value="ccsp_save_centre">
                <input type="hidden" name="id" value="<?php echo (int) $c->id; ?>">
                <?php wp_nonce_field('ccsp_save_centre'); ?>

                <div class="ccsp-card">
                    <h2>Centre details</h2>
                    <div class="ccsp-grid2">
                        <label>Brand<?php echo UI::select('brand_id', Repo::brand_options(), $c->brand_id); ?></label>
                        <label>Code<input type="text" name="code" value="<?php echo $val($c->code); ?>"></label>
                        <label>Centre name<input type="text" name="name" value="<?php echo $val($c->name); ?>"></label>
                        <label>Status<?php echo UI::select('status', ['active' => 'Active', 'inactive' => 'Inactive'], $c->status); ?></label>
                        <label>Phone<input type="text" name="phone" value="<?php echo $val($c->phone); ?>"></label>
                        <label>Email<input type="email" name="email" value="<?php echo $val($c->email); ?>"></label>
                        <label class="wide">Address<input type="text" name="address" value="<?php echo $val($c->address); ?>"></label>
                        <label class="wide">Book-a-tour URL<input type="url" name="book_tour_url" value="<?php echo $val($c->book_tour_url); ?>"></label>
                    </div>
                </div>

                <div class="ccsp-card">
                    <h2>Current fee schedule</h2>
                    <div class="ccsp-grid2">
                        <label>Effective from<input type="date" name="effective_from" value="<?php echo $val($s ? $s->effective_from : gmdate('Y-m-d')); ?>"></label>
                        <label>Weekly fee ($)<input type="number" step="0.01" min="0" name="weekly_rate" value="<?php echo $val($s ? $s->weekly_rate : ''); ?>"></label>
                        <label>WindBack fee ($)<input type="number" step="0.01" min="0" name="windback_rate" value="<?php echo $val($s ? $s->windback_rate : ''); ?>"></label>
                    </div>
                </div>

                <div class="ccsp-card">
                    <h2>Daily fee by attendance days</h2>
                    <p class="ccsp-hint">The exact per-day fee a child pays based on how many days per week they attend.</p>
                    <div class="ccsp-grid3">
                        <?php foreach ([1, 2, 3, 4, 5] as $d) : ?>
                            <label><?php echo $d; ?>-day fee ($)<input type="number" step="0.01" min="0" name="day_<?php echo $d; ?>" value="<?php echo $val($day_fee($d)); ?>"></label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <p>
                    <button type="submit" class="button button-primary">Save centre</button>
                    <a class="button" href="<?php echo esc_url(UI::url(self::PAGE)); ?>">Cancel</a>
                </p>
            </form>
        </div>
        <?php
    }

    public function handle_save() {
        UI::guard('ccsp_save_centre', self::CAP_EDIT);
        global $wpdb;

        $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
        $before = Repo::centre($id);
        if (!$before) {
            UI::redirect(self::PAGE, 'error');
        }

        // --- Centre ---
        $centre_data = [
            'brand_id'      => isset($_POST['brand_id']) ? (int) $_POST['brand_id'] : 0,
            'code'          => sanitize_text_field(wp_unslash($_POST['code'] ?? '')),
            'name'          => sanitize_text_field(wp_unslash($_POST['name'] ?? '')),
            'status'        => (($_POST['status'] ?? 'active') === 'inactive') ? 'inactive' : 'active',
            'phone'         => sanitize_text_field(wp_unslash($_POST['phone'] ?? '')),
            'email'         => sanitize_email(wp_unslash($_POST['email'] ?? '')),
            'address'       => sanitize_text_field(wp_unslash($_POST['address'] ?? '')),
            'book_tour_url' => esc_url_raw(wp_unslash($_POST['book_tour_url'] ?? '')),
        ];
        $wpdb->update(Install::table('centres'), $centre_data, ['id' => $id]);

        // --- Fee schedule: exact daily rates per attendance-day count (1–5) ---
        $day = function ($d) { return round((float) ($_POST['day_' . $d] ?? 0), 2); };
        $full     = $day(1);
        $weekly   = round((float) ($_POST['weekly_rate'] ?? 0), 2);
        $windback = round((float) ($_POST['windback_rate'] ?? 0), 2);
        $eff      = sanitize_text_field(wp_unslash($_POST['effective_from'] ?? gmdate('Y-m-d')));

        $sched = Repo::current_schedule($id);
        $sched_data = [
            'centre_id'      => $id,
            'effective_from' => $eff,
            'full_daily_fee' => $full,
            'weekly_rate'    => $weekly,
            'windback_rate'  => $windback,
            'casual_rate'    => $full,
            'is_current'     => 1,
        ];
        if ($sched) {
            $wpdb->update(Install::table('fee_schedules'), $sched_data, ['id' => $sched->id]);
            $schedule_id = (int) $sched->id;
        } else {
            $sched_data['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('fee_schedules'), $sched_data);
            $schedule_id = (int) $wpdb->insert_id;
        }

        $wpdb->delete(Install::table('fee_tiers'), ['schedule_id' => $schedule_id]);
        foreach ([1, 2, 3, 4, 5] as $d) {
            $wpdb->insert(Install::table('fee_tiers'), [
                'schedule_id'          => $schedule_id,
                'days'                 => $d,
                'discount_pct'         => 0,
                'daily_rate'           => $day($d),
                'sibling_discount_pct' => 0,
            ]);
        }

        Audit::log('centre', $id, 'update', (array) $before, $centre_data + $sched_data);
        UI::redirect(self::PAGE, 'saved', ['action' => 'edit', 'id' => $id]);
    }
}
