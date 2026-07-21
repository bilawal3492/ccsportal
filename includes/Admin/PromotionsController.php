<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;
use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Promotions: weeks-free, WindBack, returning-family, new-enrolment, custom.
 * Each promotion is date-bounded and assignable to whole brands and/or
 * specific centres.
 */
class PromotionsController {

    const PAGE = 'ccs-portal-promotions';
    const CAP  = 'ccsp_manage_promotions';

    public function register() {
        add_action('admin_post_ccsp_save_promotion', [$this, 'handle_save']);
        add_action('admin_post_ccsp_delete_promotion', [$this, 'handle_delete']);
    }

    public function render() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        $action = isset($_GET['action']) ? sanitize_key($_GET['action']) : 'list';
        if ($action === 'edit' || $action === 'new') {
            $this->render_edit();
        } else {
            $this->render_list();
        }
    }

    private function render_list() {
        $promos = Repo::promotions();
        $types = Repo::promo_types();
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Promotions
                <a class="page-title-action" href="<?php echo esc_url(UI::url(self::PAGE, ['action' => 'new'])); ?>">Add new</a>
            </h1>
            <?php UI::notice(); ?>
            <table class="widefat striped ccsp-table">
                <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Window</th><th>Scope</th><th>Status</th><th></th></tr></thead>
                <tbody>
                <?php if (!$promos) : ?>
                    <tr><td colspan="7">No promotions yet. <a href="<?php echo esc_url(UI::url(self::PAGE, ['action' => 'new'])); ?>">Create one</a>.</td></tr>
                <?php endif; ?>
                <?php foreach ($promos as $p) :
                    $centre_ids = Repo::promotion_centre_ids($p->id);
                    $brand_ids  = Repo::promotion_brand_ids($p->id);
                    $scope = 'All centres';
                    if ($centre_ids) { $scope = count($centre_ids) . ' centre(s)'; }
                    elseif ($brand_ids) { $scope = count($brand_ids) . ' brand(s)'; }
                    ?>
                    <tr>
                        <td><strong><?php echo esc_html($p->name); ?></strong></td>
                        <td><?php echo esc_html($types[$p->type] ?? $p->type); ?></td>
                        <td><?php echo esc_html(self::format_value($p)); ?></td>
                        <td><?php echo esc_html(self::format_window($p)); ?></td>
                        <td><?php echo esc_html($scope); ?></td>
                        <td><span class="ccsp-badge <?php echo $p->status === 'active' ? 'ok' : 'bad'; ?>"><?php echo esc_html(ucfirst($p->status)); ?></span></td>
                        <td>
                            <a class="button button-small" href="<?php echo esc_url(UI::url(self::PAGE, ['action' => 'edit', 'id' => $p->id])); ?>">Edit</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    private function render_edit() {
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        $p = $id ? Repo::promotion($id) : null;
        $is_new = !$p;
        if ($id && !$p) {
            echo '<div class="wrap"><p>Promotion not found.</p></div>';
            return;
        }
        $sel_centres = $p ? Repo::promotion_centre_ids($p->id) : [];
        $sel_brands  = $p ? Repo::promotion_brand_ids($p->id) : [];
        $val = static function ($v) { return esc_attr($v); };
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title"><?php echo $is_new ? 'Add promotion' : 'Edit promotion'; ?></h1>
            <?php UI::notice(); ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="ccsp-form">
                <input type="hidden" name="action" value="ccsp_save_promotion">
                <input type="hidden" name="id" value="<?php echo (int) $id; ?>">
                <?php wp_nonce_field('ccsp_save_promotion'); ?>

                <div class="ccsp-card">
                    <h2>Offer</h2>
                    <div class="ccsp-grid2">
                        <label class="wide">Name<input type="text" name="name" required value="<?php echo $val($p->name ?? ''); ?>" placeholder="e.g. 4 Weeks Free, Winter"></label>
                        <label>Type<?php echo UI::select('type', Repo::promo_types(), $p->type ?? 'weeks_free'); ?></label>
                        <label>Value<input type="number" step="0.01" min="0" name="value" value="<?php echo $val($p->value ?? ''); ?>"></label>
                        <label>How it applies<?php echo UI::select('unit', ['weeks' => 'Weeks free (1 free / 5 weeks)', 'percent' => '% off parent gap', 'amount' => '$ off weekly gap', 'sibling' => 'Sibling discount (% off 2nd+ child fee)', 'oneoff' => 'One-off credit ($)'], $p->unit ?? 'weeks'); ?></label>
                        <label>Status<?php echo UI::select('status', ['active' => 'Active', 'inactive' => 'Inactive'], $p->status ?? 'active'); ?></label>
                        <label>Start date<input type="date" name="start_date" value="<?php echo $val($p->start_date ?? ''); ?>"></label>
                        <label>End date<input type="date" name="end_date" value="<?php echo $val($p->end_date ?? ''); ?>"></label>
                        <label class="ccsp-check"><input type="checkbox" name="stackable" value="1" <?php checked(!empty($p->stackable)); ?>> Can combine with other promotions</label>
                        <label class="wide">Eligibility notes (internal)<textarea name="eligibility" rows="2" placeholder="Short internal note on who qualifies…"><?php echo esc_textarea($p->eligibility ?? ''); ?></textarea></label>
                        <label class="wide">Terms &amp; conditions (shown to the family on the estimate)<textarea name="terms" rows="8" placeholder="Full T&amp;Cs, e.g. eligibility, free-week schedule (5th/10th/15th/20th week), direct debit, consecutive weeks…"><?php echo esc_textarea($p->terms ?? ''); ?></textarea></label>
                    </div>
                </div>

                <div class="ccsp-card">
                    <h2>Where it applies</h2>
                    <p class="ccsp-hint">Leave everything unticked for a group-wide promotion. Tick brands to cover all their centres, or pick individual centres.</p>
                    <div class="ccsp-grid2">
                        <div>
                            <strong>Brands</strong>
                            <?php foreach (Repo::brands() as $b) : ?>
                                <label class="ccsp-check"><input type="checkbox" name="brands[]" value="<?php echo (int) $b->id; ?>" <?php checked(in_array((int) $b->id, $sel_brands, true)); ?>> <?php echo esc_html($b->name); ?></label>
                            <?php endforeach; ?>
                        </div>
                        <div>
                            <strong>Centres</strong>
                            <div class="ccsp-scroll">
                            <?php foreach (Repo::centres() as $c) : ?>
                                <label class="ccsp-check"><input type="checkbox" name="centres[]" value="<?php echo (int) $c->id; ?>" <?php checked(in_array((int) $c->id, $sel_centres, true)); ?>> <?php echo esc_html($c->brand_name . ' · ' . $c->name); ?></label>
                            <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <p>
                    <button type="submit" class="button button-primary"><?php echo $is_new ? 'Create promotion' : 'Save promotion'; ?></button>
                    <a class="button" href="<?php echo esc_url(UI::url(self::PAGE)); ?>">Cancel</a>
                    <?php if (!$is_new) : ?>
                        <a class="button ccsp-danger" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=ccsp_delete_promotion&id=' . $id), 'ccsp_delete_promotion')); ?>" onclick="return confirm('Delete this promotion?');">Delete</a>
                    <?php endif; ?>
                </p>
            </form>
        </div>
        <?php
    }

    public function handle_save() {
        UI::guard('ccsp_save_promotion', self::CAP);
        global $wpdb;

        $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
        $before = $id ? (array) Repo::promotion($id) : null;

        $types = Repo::promo_types();
        $type = sanitize_key($_POST['type'] ?? 'weeks_free');
        $data = [
            'name'        => sanitize_text_field(wp_unslash($_POST['name'] ?? '')),
            'type'        => isset($types[$type]) ? $type : 'weeks_free',
            'value'       => round((float) ($_POST['value'] ?? 0), 2),
            'unit'        => in_array(($_POST['unit'] ?? ''), ['weeks', 'percent', 'amount', 'sibling', 'oneoff'], true) ? $_POST['unit'] : 'weeks',
            'start_date'  => self::clean_date($_POST['start_date'] ?? ''),
            'end_date'    => self::clean_date($_POST['end_date'] ?? ''),
            'eligibility' => sanitize_textarea_field(wp_unslash($_POST['eligibility'] ?? '')),
            'terms'       => sanitize_textarea_field(wp_unslash($_POST['terms'] ?? '')),
            'stackable'   => empty($_POST['stackable']) ? 0 : 1,
            'status'      => (($_POST['status'] ?? 'active') === 'inactive') ? 'inactive' : 'active',
        ];

        if ($id) {
            $wpdb->update(Install::table('promotions'), $data, ['id' => $id]);
        } else {
            $data['created_at'] = current_time('mysql');
            $wpdb->insert(Install::table('promotions'), $data);
            $id = (int) $wpdb->insert_id;
        }

        // Rebuild assignment map.
        $map = Install::table('promotion_map');
        $wpdb->delete($map, ['promotion_id' => $id]);
        $brands  = array_map('intval', (array) ($_POST['brands'] ?? []));
        $centres = array_map('intval', (array) ($_POST['centres'] ?? []));
        foreach ($brands as $bid) {
            if ($bid > 0) {
                $wpdb->insert($map, ['promotion_id' => $id, 'brand_id' => $bid, 'centre_id' => 0]);
            }
        }
        foreach ($centres as $cid) {
            if ($cid > 0) {
                $wpdb->insert($map, ['promotion_id' => $id, 'brand_id' => 0, 'centre_id' => $cid]);
            }
        }

        Audit::log('promotion', $id, $before ? 'update' : 'create', $before, $data);
        UI::redirect(self::PAGE, $before ? 'saved' : 'created', ['action' => 'edit', 'id' => $id]);
    }

    public function handle_delete() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        check_admin_referer('ccsp_delete_promotion');
        global $wpdb;
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        if ($id) {
            $before = (array) Repo::promotion($id);
            $wpdb->delete(Install::table('promotions'), ['id' => $id]);
            $wpdb->delete(Install::table('promotion_map'), ['promotion_id' => $id]);
            Audit::log('promotion', $id, 'delete', $before, null);
        }
        UI::redirect(self::PAGE, 'deleted');
    }

    /* -------- formatting helpers -------- */

    private static function format_value($p) {
        switch ($p->unit) {
            case 'percent': return rtrim(rtrim((string) $p->value, '0'), '.') . '%';
            case 'amount':  return '$' . number_format((float) $p->value, 2);
            default:        return rtrim(rtrim((string) $p->value, '0'), '.') . ' weeks';
        }
    }

    private static function format_window($p) {
        if ($p->start_date && $p->end_date) {
            return $p->start_date . ' → ' . $p->end_date;
        }
        if ($p->end_date)   { return 'until ' . $p->end_date; }
        if ($p->start_date) { return 'from ' . $p->start_date; }
        return 'Always';
    }

    private static function clean_date($v) {
        $v = sanitize_text_field(wp_unslash($v));
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }
}
