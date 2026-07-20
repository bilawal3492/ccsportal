<?php
namespace CCSPortal\Admin;

use CCSPortal\Install;
use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Brands, name, accent colour, logo and the email identity used on branded
 * estimates. Three brands ship seeded; this screen keeps them editable.
 */
class BrandsController {

    const PAGE = 'ccs-portal-brands';
    const CAP  = 'ccsp_manage_centres';

    public function register() {
        add_action('admin_post_ccsp_save_brand', [$this, 'handle_save']);
    }

    public function render() {
        if (!current_user_can(self::CAP)) {
            wp_die('Access denied.');
        }
        $brands = Repo::brands();
        ?>
        <div class="wrap ccsp-wrap">
            <h1 class="ccsp-title">Brands</h1>
            <?php UI::notice(); ?>
            <p class="ccsp-sub">Branding and email identity applied to estimates for each brand's centres.</p>
            <?php foreach ($brands as $b) : ?>
                <div class="ccsp-card">
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="ccsp_save_brand">
                        <input type="hidden" name="id" value="<?php echo (int) $b->id; ?>">
                        <?php wp_nonce_field('ccsp_save_brand'); ?>
                        <h2><span class="ccsp-dot" style="background:<?php echo esc_attr($b->accent_color); ?>"></span><?php echo esc_html($b->name); ?> <span class="ccsp-ver"><?php echo esc_html($b->code); ?></span></h2>
                        <div class="ccsp-grid2">
                            <label>Name<input type="text" name="name" value="<?php echo esc_attr($b->name); ?>"></label>
                            <label>Accent colour<input type="text" name="accent_color" value="<?php echo esc_attr($b->accent_color); ?>" placeholder="#df7a2c"></label>
                            <label class="wide">Logo URL<input type="url" name="logo_url" value="<?php echo esc_attr($b->logo_url); ?>"></label>
                            <label>Email “from” name<input type="text" name="email_from_name" value="<?php echo esc_attr($b->email_from_name); ?>"></label>
                            <label>Email “from” address<input type="email" name="email_from_address" value="<?php echo esc_attr($b->email_from_address); ?>"></label>
                        </div>
                        <button type="submit" class="button button-primary">Save <?php echo esc_html($b->code); ?></button>
                    </form>
                </div>
            <?php endforeach; ?>
        </div>
        <?php
    }

    public function handle_save() {
        UI::guard('ccsp_save_brand', self::CAP);
        global $wpdb;
        $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
        $before = (array) Repo::brand($id);
        if (!$before) {
            UI::redirect(self::PAGE, 'error');
        }
        $color = sanitize_text_field(wp_unslash($_POST['accent_color'] ?? ''));
        if ($color && !preg_match('/^#[0-9a-fA-F]{3,8}$/', $color)) {
            $color = $before['accent_color'];
        }
        $data = [
            'name'               => sanitize_text_field(wp_unslash($_POST['name'] ?? '')),
            'accent_color'       => $color,
            'logo_url'           => esc_url_raw(wp_unslash($_POST['logo_url'] ?? '')),
            'email_from_name'    => sanitize_text_field(wp_unslash($_POST['email_from_name'] ?? '')),
            'email_from_address' => sanitize_email(wp_unslash($_POST['email_from_address'] ?? '')),
        ];
        $wpdb->update(Install::table('brands'), $data, ['id' => $id]);
        Audit::log('brand', $id, 'update', $before, $data);
        UI::redirect(self::PAGE, 'saved');
    }
}
