<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;
use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Managers screen, assign WordPress users to the Centre Manager role and
 * scope them to one or more centres. Scoping is stored in user meta and
 * enforced server-side wherever centre data is read.
 */
class ManagersController {

    const PAGE = 'ccs-portal-managers';
    const CAP  = 'ccsp_manage_portal';

    public function register() {
        add_action('admin_post_ccsp_save_manager', [$this, 'handle_save']);
        add_action('admin_post_ccsp_remove_manager', [$this, 'handle_remove']);
    }

    public function render() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        $centre_labels = Repo::centre_options();
        $managers = Repo::managers();
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Managers</h1>
            <?php UI::notice(); ?>
            <p class="ccsp-sub">Give a person the <strong>Centre Manager</strong> role and choose the centre(s) they may use in the portal. They will only ever see their own centre's fees, promotions and estimates.</p>

            <div class="ccsp-grid-managers">
                <div class="ccsp-card">
                    <h2>Assigned managers</h2>
                    <table class="widefat striped ccsp-table">
                        <thead><tr><th>Manager</th><th>Centres</th><th></th></tr></thead>
                        <tbody>
                        <?php if (!$managers) : ?>
                            <tr><td colspan="3">No managers assigned yet.</td></tr>
                        <?php endif; ?>
                        <?php foreach ($managers as $u) :
                            $ids = Repo::manager_centre_ids($u->ID);
                            $names = array_map(static function ($cid) use ($centre_labels) {
                                return $centre_labels[$cid] ?? ('#' . $cid);
                            }, $ids);
                            ?>
                            <tr>
                                <td><strong><?php echo esc_html($u->display_name); ?></strong><br><span class="ccsp-muted"><?php echo esc_html($u->user_email); ?></span></td>
                                <td><?php echo $names ? esc_html(implode(', ', $names)) : '<em>none</em>'; ?></td>
                                <td>
                                    <a class="button button-small" href="#" onclick="document.getElementById('assign-<?php echo (int) $u->ID; ?>').scrollIntoView();return false;">Edit below</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <div class="ccsp-card">
                    <h2>Assign / update a manager</h2>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="ccsp_save_manager">
                        <?php wp_nonce_field('ccsp_save_manager'); ?>
                        <label class="ccsp-block">User
                            <?php echo UI::select('user_id', $this->user_options($managers), 0, ['required' => 'required']); ?>
                        </label>
                        <div class="ccsp-block">
                            <strong>Centres</strong>
                            <div class="ccsp-scroll">
                            <?php foreach (Repo::centres() as $c) : ?>
                                <label class="ccsp-check"><input type="checkbox" name="centres[]" value="<?php echo (int) $c->id; ?>"> <?php echo esc_html($c->brand_name . ' · ' . $c->name); ?></label>
                            <?php endforeach; ?>
                            </div>
                            <p class="ccsp-hint">For an existing manager, ticking centres replaces their current assignment.</p>
                        </div>
                        <button type="submit" class="button button-primary">Save assignment</button>
                    </form>
                </div>
            </div>

            <?php if ($managers) : ?>
            <div class="ccsp-card">
                <h2>Update existing assignments</h2>
                <?php foreach ($managers as $u) :
                    $ids = Repo::manager_centre_ids($u->ID); ?>
                    <form id="assign-<?php echo (int) $u->ID; ?>" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="ccsp-manager-row">
                        <input type="hidden" name="action" value="ccsp_save_manager">
                        <input type="hidden" name="user_id" value="<?php echo (int) $u->ID; ?>">
                        <?php wp_nonce_field('ccsp_save_manager'); ?>
                        <div class="ccsp-manager-name"><strong><?php echo esc_html($u->display_name); ?></strong></div>
                        <div class="ccsp-manager-centres">
                            <?php foreach (Repo::centres() as $c) : ?>
                                <label class="ccsp-check inline"><input type="checkbox" name="centres[]" value="<?php echo (int) $c->id; ?>" <?php checked(in_array((int) $c->id, $ids, true)); ?>> <?php echo esc_html($c->code); ?></label>
                            <?php endforeach; ?>
                        </div>
                        <div class="ccsp-manager-actions">
                            <button type="submit" class="button button-small button-primary">Save</button>
                            <a class="button button-small ccsp-danger" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=ccsp_remove_manager&user_id=' . $u->ID), 'ccsp_remove_manager')); ?>" onclick="return confirm('Remove Centre Manager access for this user?');">Remove</a>
                        </div>
                    </form>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /** Users available to assign (exclude existing managers from the "add" picker). */
    private function user_options($managers) {
        $existing = array_map(static function ($u) { return (int) $u->ID; }, $managers);
        $out = [0 => 'Select a user…'];
        foreach (Repo::assignable_users() as $u) {
            if (in_array((int) $u->ID, $existing, true)) {
                continue;
            }
            $out[(int) $u->ID] = $u->display_name . ' (' . $u->user_email . ')';
        }
        return $out;
    }

    public function handle_save() {
        UI::guard('ccsp_save_manager', self::CAP);
        $user_id = isset($_POST['user_id']) ? (int) $_POST['user_id'] : 0;
        $user = $user_id ? get_userdata($user_id) : null;
        if (!$user) {
            UI::redirect(self::PAGE, 'error');
        }

        // Ensure the Centre Manager role (add it without stripping other roles).
        if (!in_array(Install::ROLE_MANAGER, (array) $user->roles, true)) {
            $user->add_role(Install::ROLE_MANAGER);
        }

        $centres = array_values(array_unique(array_filter(array_map('intval', (array) ($_POST['centres'] ?? [])))));
        update_user_meta($user_id, Repo::MANAGER_META, $centres);

        Audit::log('manager', $user_id, 'assign', null, ['centres' => $centres]);
        UI::redirect(self::PAGE, 'assigned');
    }

    public function handle_remove() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        check_admin_referer('ccsp_remove_manager');
        $user_id = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
        $user = $user_id ? get_userdata($user_id) : null;
        if ($user) {
            $user->remove_role(Install::ROLE_MANAGER);
            delete_user_meta($user_id, Repo::MANAGER_META);
            Audit::log('manager', $user_id, 'remove', null, null);
        }
        UI::redirect(self::PAGE, 'deleted');
    }
}
