<?php
namespace CCSPortal\Frontend;

use CCSPortal\Data\Repo;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * The React SaaS app, rendered by [ccs_portal_app] on a login-gated page.
 * Super admins manage everything; centre managers see their scoped estimates,
 * leads and reports. React + htm are vendored locally (no build step).
 */
class PortalApp {

    const SHORTCODE = 'ccs_portal_app';

    public function register() {
        add_shortcode(self::SHORTCODE, [$this, 'render']);
        add_action('wp_enqueue_scripts', [$this, 'maybe_enqueue']);
    }

    public function maybe_enqueue() {
        if (!is_singular()) {
            return;
        }
        $post = get_post();
        if (!$post || !has_shortcode($post->post_content, self::SHORTCODE)) {
            return;
        }
        if (!is_user_logged_in() || !current_user_can('ccsp_use_portal')) {
            return;
        }

        $v = CCSP_VERSION;
        wp_enqueue_style('ccsp-app', CCSP_URL . 'assets/css/app.css', [], $v);
        wp_enqueue_script('ccsp-react', CCSP_URL . 'assets/vendor/react.production.min.js', [], '18.3.1', true);
        wp_enqueue_script('ccsp-react-dom', CCSP_URL . 'assets/vendor/react-dom.production.min.js', ['ccsp-react'], '18.3.1', true);
        wp_enqueue_script('ccsp-htm', CCSP_URL . 'assets/vendor/htm.umd.js', [], '3.1.1', true);
        wp_enqueue_script('ccsp-app', CCSP_URL . 'assets/js/app.js', ['ccsp-react', 'ccsp-react-dom', 'ccsp-htm'], $v, true);

        wp_localize_script('ccsp-app', 'CCSP_APP', [
            'root'  => esc_url_raw(rest_url('ccsp/v1/')),
            'nonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public function render() {
        if (!is_user_logged_in()) {
            return '<div class="ccsp-app-gate"><h2>Staff sign-in required</h2><p>Please sign in to access the portal.</p>'
                . wp_login_form(['echo' => false, 'redirect' => get_permalink()]) . '</div>';
        }
        if (!current_user_can('ccsp_use_portal')) {
            return '<div class="ccsp-app-gate"><h2>No portal access</h2><p>Your account is not set up to use the CCS Portal. Please contact your administrator.</p></div>';
        }
        return '<div id="ccsp-app-root" class="ccsp-app-root"><div class="ccsp-app-loading">Loading portal…</div></div>';
    }
}
